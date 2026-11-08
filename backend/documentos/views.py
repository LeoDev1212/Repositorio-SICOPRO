import csv
import io
from decimal import Decimal, InvalidOperation

import openpyxl
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from contracts.models import Contract
from notificaciones.models import Notificacion
from notificaciones.services import crear_notificaciones
from users.models import Role
from users.permissions import AssignmentScopedQuerySetMixin, RoleScopedPermission

from django.utils import timezone

from .models import (
    Anticipo,
    ConceptoCatalogo,
    ContractDocument,
    ConvenioModificatorio,
    ConvenioModificatorioConcepto,
    ConvenioModificatorioStatus,
    Garantia,
    ProgramaConceptoMes,
)
from .serializers import (
    AnticipoSerializer,
    ConceptoCatalogoSerializer,
    ContractDocumentSerializer,
    ConvenioModificatorioConceptoSerializer,
    ConvenioModificatorioSerializer,
    GarantiaSerializer,
    ProgramaConceptoMesSerializer,
)

ALL_ROLES = {
    Role.DEPENDENCIA,
    Role.RESIDENTE,
    Role.SUPERINTENDENTE,
    Role.SUPERVISION,
    Role.FINANZAS,
}


class DocumentoPermission(RoleScopedPermission):
    """Todos los actores asignados pueden consultar; solo Residente escribe."""

    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": {Role.RESIDENTE},
        "update": {Role.RESIDENTE},
        "partial_update": {Role.RESIDENTE},
        "destroy": {Role.RESIDENTE},
        "bulk_upload": {Role.RESIDENTE},
        "upsert_matriz": {Role.RESIDENTE},
        "sustituir": {Role.RESIDENTE},
    }


class ConvenioPermission(RoleScopedPermission):
    """RN-CONV-001: Residente/Dependencia capturan, solo Dependencia
    aprueba o rechaza (RN-CONV-003)."""

    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": {Role.RESIDENTE, Role.DEPENDENCIA},
        "update": {Role.RESIDENTE, Role.DEPENDENCIA},
        "partial_update": {Role.RESIDENTE, Role.DEPENDENCIA},
        "destroy": {Role.RESIDENTE, Role.DEPENDENCIA},
        "aprobar": {Role.DEPENDENCIA},
        "rechazar": {Role.DEPENDENCIA},
    }


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class ContratoScopedMixin(AssignmentScopedQuerySetMixin):
    """
    Comparte el patrón de alcance por asignación ya usado por Contract, pero
    resuelto vía la FK contrato de cada modelo (o una cadena de FKs, para
    ProgramaConceptoMes cuyo contrato vive en concepto.contrato).
    Además soporta acotar por ?contrato=<id>, usado por el frontend para
    pedir solo los datos de un contrato a la vez.
    """

    unrestricted_roles = {Role.DEPENDENCIA, Role.FINANZAS}
    contrato_lookup_prefix = "contrato"

    @property
    def assignment_lookups(self):
        prefix = self.contrato_lookup_prefix
        return {
            Role.RESIDENTE: f"{prefix}__residente__user",
            Role.SUPERVISION: f"{prefix}__supervisor__user",
            Role.SUPERINTENDENTE: f"{prefix}__superintendente__user",
        }

    def get_queryset(self):
        qs = super().get_queryset()
        contrato_id = self.request.query_params.get("contrato")
        if contrato_id:
            qs = qs.filter(**{f"{self.contrato_lookup_prefix}_id": contrato_id})
        return qs


class ConceptoCatalogoViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = ConceptoCatalogo.objects.select_related("contrato")
    serializer_class = ConceptoCatalogoSerializer
    permission_classes = [DocumentoPermission]

    @action(detail=False, methods=["post"])
    def bulk_upload(self, request):
        contrato_id = request.data.get("contrato")
        archivo = request.FILES.get("archivo")
        if not contrato_id or not archivo:
            return Response({"detail": "Se requiere contrato y archivo."}, status=400)
        contrato = get_object_or_404(Contract, pk=contrato_id)

        filename = archivo.name.lower()
        try:
            if filename.endswith(".csv"):
                decoded = archivo.read().decode("utf-8-sig")
                rows = list(csv.DictReader(io.StringIO(decoded)))
            elif filename.endswith(".xlsx"):
                workbook = openpyxl.load_workbook(archivo, read_only=True, data_only=True)
                sheet = workbook.active
                rows_iter = sheet.iter_rows(values_only=True)
                headers = [str(h).strip().lower() if h else "" for h in next(rows_iter)]
                rows = []
                for values in rows_iter:
                    if values is None or all(v is None for v in values):
                        continue
                    rows.append(dict(zip(headers, values)))
            else:
                return Response(
                    {"detail": "Formato no soportado. Usa CSV o XLSX."}, status=400
                )
        except (UnicodeDecodeError, csv.Error, KeyError, StopIteration):
            return Response({"detail": "No se pudo leer el archivo."}, status=400)

        created = []
        errors = []
        with transaction.atomic():
            for index, row in enumerate(rows, start=2):
                clave = str(row.get("clave") or "").strip()
                if not clave:
                    continue
                try:
                    concepto = ConceptoCatalogo(
                        contrato=contrato,
                        clave=clave,
                        descripcion=str(row.get("descripcion") or "").strip(),
                        unidad=str(row.get("unidad") or "").strip(),
                        cantidad=Decimal(str(row.get("cantidad") or "0")),
                        precio_unitario=Decimal(str(row.get("precio_unitario") or "0")),
                        no_sujeto_ajuste_costos=str(
                            row.get("no_sujeto_ajuste_costos") or ""
                        ).strip().lower()
                        in ("true", "1", "si", "sí"),
                    )
                    concepto.full_clean(exclude=["importe"])
                    concepto.save()
                    created.append(concepto)
                except (DjangoValidationError, InvalidOperation, TypeError) as exc:
                    errors.append({"fila": index, "error": str(exc)})
            if errors:
                transaction.set_rollback(True)

        if errors:
            return Response({"creados": 0, "errores": errors}, status=400)

        suma_importes = sum((c.importe for c in created), Decimal("0"))
        tolerancia = contrato.monto * Decimal("0.005")
        coincide = abs(suma_importes - contrato.monto) <= tolerancia
        return Response(
            {
                "creados": len(created),
                "suma_importes": str(suma_importes),
                "monto_contrato": str(contrato.monto),
                "coincide_monto": coincide,
            },
            status=201,
        )


class ProgramaConceptoMesViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = ProgramaConceptoMes.objects.select_related("concepto", "concepto__contrato")
    serializer_class = ProgramaConceptoMesSerializer
    permission_classes = [DocumentoPermission]
    contrato_lookup_prefix = "concepto__contrato"

    @action(detail=False, methods=["post"])
    def upsert_matriz(self, request):
        filas = request.data.get("filas", [])
        errores = []
        resultados = []
        for index, fila in enumerate(filas):
            serializer = ProgramaConceptoMesSerializer(data=fila)
            if not serializer.is_valid():
                errores.append({"fila": index, "errores": serializer.errors})
                continue
            data = serializer.validated_data
            instance, _created = ProgramaConceptoMes.objects.update_or_create(
                concepto=data["concepto"],
                mes=data["mes"],
                defaults={"cantidad_programada": data["cantidad_programada"]},
            )
            resultados.append(ProgramaConceptoMesSerializer(instance).data)
        if errores:
            return Response({"errores": errores}, status=400)
        return Response(resultados, status=200)


class GarantiaViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = Garantia.objects.select_related("contrato")
    serializer_class = GarantiaSerializer
    permission_classes = [DocumentoPermission]


class AnticipoViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = Anticipo.objects.select_related("contrato")
    serializer_class = AnticipoSerializer
    permission_classes = [DocumentoPermission]


class ContractDocumentViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = ContractDocument.objects.select_related("contrato", "subido_por")
    serializer_class = ContractDocumentSerializer
    permission_classes = [DocumentoPermission]
    # RN-032: nunca se borra físicamente, solo se sustituye (ver acción `sustituir`).
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        bloque = self.request.query_params.get("bloque")
        if bloque:
            qs = qs.filter(bloque=bloque)
        return qs

    def perform_create(self, serializer):
        serializer.save(subido_por=self.request.user, ip_origen=_client_ip(self.request))

    @action(detail=True, methods=["post"])
    def sustituir(self, request, pk=None):
        anterior = self.get_object()
        serializer = ContractDocumentSerializer(
            data={
                "contrato": anterior.contrato_id,
                "bloque": anterior.bloque,
                "nombre": request.data.get("nombre", anterior.nombre),
                "archivo": request.FILES.get("archivo"),
            }
        )
        serializer.is_valid(raise_exception=True)
        nuevo = serializer.save(
            version_anterior=anterior,
            subido_por=request.user,
            ip_origen=_client_ip(request),
        )
        anterior.estado = ContractDocument.Estado.SUSTITUIDO
        anterior.save(update_fields=["estado"])
        return Response(ContractDocumentSerializer(nuevo).data, status=201)


class ConvenioModificatorioViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = ConvenioModificatorio.objects.select_related("contrato", "creado_por").prefetch_related(
        "conceptos"
    )
    serializer_class = ConvenioModificatorioSerializer
    permission_classes = [ConvenioPermission]

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        convenio = self.get_object()
        if convenio.status != ConvenioModificatorioStatus.BORRADOR:
            return Response({"detail": "Solo se puede aprobar un convenio en borrador."}, status=400)

        # RN-CONV-004: el convenio debe tener contenido real para lo que su
        # `tipo` declara — antes de que existieran monto_delta/dias_delta,
        # esto solo revisaba conceptos, lo que habría bloqueado para siempre
        # cualquier convenio de ampliación de monto/plazo puro (sin
        # conceptos que capturar).
        Tipo = ConvenioModificatorio.Tipo
        if convenio.tipo in (Tipo.AMPLIACION_CANTIDAD, Tipo.MIXTO) and not convenio.conceptos.exists():
            return Response(
                {"detail": "El convenio no tiene conceptos capturados (RN-CONV-004)."}, status=400
            )
        if convenio.tipo in (Tipo.AMPLIACION_MONTO, Tipo.MIXTO) and convenio.monto_delta == 0:
            return Response(
                {"detail": "El convenio no tiene un monto adicional/deductivo capturado (RN-CONV-004)."},
                status=400,
            )
        if convenio.tipo in (Tipo.AMPLIACION_PLAZO, Tipo.MIXTO) and convenio.dias_delta == 0:
            return Response(
                {"detail": "El convenio no tiene días adicionales/deducidos capturados (RN-CONV-004)."},
                status=400,
            )

        convenio.status = ConvenioModificatorioStatus.APROBADO
        convenio.aprobado_por = request.user
        convenio.fecha_aprobacion = timezone.now()
        convenio.save(update_fields=["status", "aprobado_por", "fecha_aprobacion"])

        contrato = convenio.contrato
        destinatarios = []
        if contrato.residente and contrato.residente.user_id:
            destinatarios.append(contrato.residente.user)
        if contrato.superintendente and contrato.superintendente.user_id:
            destinatarios.append(contrato.superintendente.user)
        crear_notificaciones(
            destinatarios,
            Notificacion.Tipo.CONVENIO_APROBADO,
            f"El convenio modificatorio {convenio.numero} del contrato "
            f"{contrato.no_contrato} fue aprobado.",
            enlace=f"/contratos/{contrato.id}",
        )
        return Response(self.get_serializer(convenio).data)

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        convenio = self.get_object()
        if convenio.status != ConvenioModificatorioStatus.BORRADOR:
            return Response({"detail": "Solo se puede rechazar un convenio en borrador."}, status=400)
        motivo = (request.data.get("motivo") or "").strip()
        if not motivo:
            return Response(
                {"motivo": "El motivo de rechazo es obligatorio (RN-CONV-003)."}, status=400
            )

        # RN-CONV-003: a diferencia de Estimaciones, rechazado es terminal
        # (no vuelve a borrador) — Convenios no tiene la restricción FIFO
        # que motiva ese diseño ahí; para reintentar se crea un convenio
        # nuevo (numero consecutivo).
        convenio.status = ConvenioModificatorioStatus.RECHAZADO
        convenio.motivo_rechazo = motivo
        convenio.save(update_fields=["status", "motivo_rechazo"])

        contrato = convenio.contrato
        destinatarios = []
        if contrato.residente and contrato.residente.user_id:
            destinatarios.append(contrato.residente.user)
        if contrato.superintendente and contrato.superintendente.user_id:
            destinatarios.append(contrato.superintendente.user)
        crear_notificaciones(
            destinatarios,
            Notificacion.Tipo.CONVENIO_RECHAZADO,
            f"El convenio modificatorio {convenio.numero} del contrato "
            f"{contrato.no_contrato} fue rechazado: {motivo}",
            enlace=f"/contratos/{contrato.id}",
        )
        return Response(self.get_serializer(convenio).data)


class ConvenioModificatorioConceptoViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = ConvenioModificatorioConcepto.objects.select_related("convenio", "concepto")
    serializer_class = ConvenioModificatorioConceptoSerializer
    permission_classes = [ConvenioPermission]
    contrato_lookup_prefix = "convenio__contrato"

    def get_queryset(self):
        qs = super().get_queryset()
        convenio_id = self.request.query_params.get("convenio")
        if convenio_id:
            qs = qs.filter(convenio_id=convenio_id)
        return qs
