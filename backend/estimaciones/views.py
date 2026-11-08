from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from bitacora.models import BitacoraStatus, NotaBitacora, NotaClasificacion
from cierre.models import Cierre
from contracts.models import ContractStatus
from documentos.models import Anticipo
from notificaciones.models import Notificacion
from notificaciones.services import crear_notificaciones
from users.models import Role, User
from users.permissions import AssignmentScopedQuerySetMixin, RoleScopedPermission

from .models import (
    Estimacion,
    EstimacionConcepto,
    EstimacionEvento,
    EstimacionStatus,
    EvidenciaFotografica,
    Firma,
    GeneradorElemento,
)
from .serializers import (
    EstimacionConceptoSerializer,
    EstimacionCreateSerializer,
    EstimacionDeduccionesSerializer,
    EstimacionEventoSerializer,
    EstimacionPagoSerializer,
    EstimacionSerializer,
    EvidenciaFotograficaSerializer,
    FirmaSerializer,
    GeneradorElementoSerializer,
)


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _mes_mas_antiguo_pendiente(contrato):
    """RN-EST-021 (relocada a presentar(), plan §4.1 Fase 8): menor
    mes_programa que todavía no se ha presentado con éxito — nunca se creó,
    o existe pero sigue en borrador (incluye el caso de una re-presentación
    tras rechazo, que también vuelve a borrador)."""
    presentados = set(
        Estimacion.objects.filter(contrato=contrato)
        .exclude(status=EstimacionStatus.BORRADOR)
        .values_list("mes_programa", flat=True)
    )
    mes = 1
    while mes in presentados:
        mes += 1
    return mes


ALL_ROLES = {
    Role.DEPENDENCIA,
    Role.RESIDENTE,
    Role.SUPERINTENDENTE,
    Role.SUPERVISION,
    Role.FINANZAS,
}


class EstimacionPermission(RoleScopedPermission):
    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": {Role.SUPERINTENDENTE},
        "update": {Role.SUPERINTENDENTE},
        "partial_update": {Role.SUPERINTENDENTE},
        "destroy": {Role.SUPERINTENDENTE},
        "eventos": ALL_ROLES,
        "presentar": {Role.SUPERINTENDENTE},
        "aprobar_residente": {Role.RESIDENTE},
        "rechazar_residente": {Role.RESIDENTE},
        "firmar": {Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION},
        "deducciones": {Role.RESIDENTE},
        "pago": {Role.FINANZAS},
    }


class ContratoScopedMixin(AssignmentScopedQuerySetMixin):
    """Mismo patrón que `documentos.views.ContratoScopedMixin`, resuelto vía
    la FK (o cadena de FKs) `contrato` de cada modelo de esta app."""

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


class EstimacionViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = Estimacion.objects.select_related("contrato", "creado_por")
    permission_classes = [EstimacionPermission]

    def get_serializer_class(self):
        if self.action == "create":
            return EstimacionCreateSerializer
        return EstimacionSerializer

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=["get"])
    def eventos(self, request, pk=None):
        estimacion = self.get_object()
        serializer = EstimacionEventoSerializer(estimacion.eventos.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"])
    def deducciones(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.status != EstimacionStatus.EN_REVISION_RESIDENTE:
            return Response(
                {
                    "detail": "Las deducciones solo se capturan mientras el Residente está "
                    "revisando la estimación."
                },
                status=400,
            )
        serializer = EstimacionDeduccionesSerializer(
            estimacion, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(estimacion).data)

    @action(detail=True, methods=["patch"])
    def pago(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.status != EstimacionStatus.FIRMADA:
            return Response(
                {"detail": "El pago solo se puede registrar en una estimación firmada."},
                status=400,
            )
        serializer = EstimacionPagoSerializer(estimacion, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(estimacion).data)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def presentar(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.status != EstimacionStatus.BORRADOR:
            return Response(
                {"detail": "Solo se puede presentar una estimación en borrador."}, status=400
            )

        conceptos_reportados = list(estimacion.conceptos.filter(cantidad_ejecutada__gt=0))
        if not conceptos_reportados:
            return Response(
                {
                    "detail": "Necesitas al menos un concepto con cantidad ejecutada mayor a "
                    "cero para presentar (RN-EST-005)."
                },
                status=400,
            )
        sin_evidencia = [
            c.concepto.clave for c in conceptos_reportados if not c.evidencias.exists()
        ]
        if sin_evidencia:
            return Response(
                {
                    "detail": "Falta evidencia fotográfica en: "
                    f"{', '.join(sin_evidencia)} (RN-EST-006)."
                },
                status=400,
            )

        contrato = estimacion.contrato
        # RN-CIERRE-009 (plan-cierre.md §6): la estimación de liquidación de
        # un cierre por terminación por cumplimiento en curso es un
        # settlement final, no una estimación mensual más — se presenta
        # aunque el contrato ya no esté activo, y sin las reglas de
        # ventana/FIFO (RN-EST-020/021) que solo tienen sentido para el
        # ciclo mensual ordinario que este cierre ya dejó atrás.
        es_liquidacion = Cierre.objects.filter(
            contrato=contrato,
            tipo=Cierre.Tipo.TERMINACION_CUMPLIMIENTO,
            status=Cierre.Status.EN_PROCESO,
            estimacion_liquidacion=estimacion,
        ).exists()

        if not es_liquidacion:
            if contrato.status != ContractStatus.ACTIVO:
                return Response(
                    {
                        "detail": "No se puede presentar: el contrato ya no está activo "
                        "(RN-CIERRE-009)."
                    },
                    status=400,
                )
            if contrato.fecha_inicio_obra is None:
                return Response(
                    {
                        "detail": "No se puede presentar: el contrato todavía no tiene una "
                        "bitácora abierta, requerida para calcular la ventana de presentación "
                        "(RN-EST-020)."
                    },
                    status=400,
                )
            if not contrato.ventana_presentacion_abierta:
                return Response(
                    {
                        "detail": "Fuera de la ventana de presentación vigente (6 días naturales "
                        "tras la fecha de corte del mes en curso del contrato) (RN-EST-020)."
                    },
                    status=400,
                )
            mes_pendiente = _mes_mas_antiguo_pendiente(contrato)
            if estimacion.mes_programa != mes_pendiente:
                return Response(
                    {
                        "detail": "No se puede presentar todavía: falta presentar primero la "
                        f"estimación del mes {mes_pendiente} de este contrato (RN-EST-021)."
                    },
                    status=400,
                )

        estimacion.status = EstimacionStatus.EN_REVISION_RESIDENTE
        estimacion.fecha_presentacion = timezone.now()
        estimacion.save(update_fields=["status", "fecha_presentacion"])
        EstimacionEvento.objects.create(
            estimacion=estimacion, tipo=EstimacionEvento.Tipo.PRESENTADA, actor=request.user
        )

        # RN-BIT-009 (plan-bitacora.md §5): se hace constar la presentación
        # como nota automática. Antes, la bitácora estaba garantizada por el
        # check de RN-EST-020 de arriba (fecha_inicio_obra no era None) —
        # ahora que la excepción de RN-CIERRE-009 puede saltarse ese check
        # (estimación de liquidación), hay que volver a comprobar que existe
        # antes de tocar `contrato.bitacora` (si no, `Bitacora.DoesNotExist`).
        if contrato.fecha_inicio_obra is not None and contrato.bitacora.estado == BitacoraStatus.ABIERTA:
            NotaBitacora.objects.create(
                bitacora=contrato.bitacora,
                clasificacion=NotaClasificacion.AVANCE,
                descripcion=(
                    f"Estimación {estimacion.numero} presentada el "
                    f"{timezone.localtime(estimacion.fecha_presentacion).date().isoformat()}."
                ),
                estimacion=estimacion,
                autor=request.user,
            )

        return Response(self.get_serializer(estimacion).data)

    @action(detail=True, methods=["post"])
    def aprobar_residente(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.status != EstimacionStatus.EN_REVISION_RESIDENTE:
            return Response(
                {"detail": "Solo se puede aprobar una estimación en revisión."}, status=400
            )

        ahora = timezone.now()
        estimacion.status = EstimacionStatus.PENDIENTE_FIRMA
        estimacion.fecha_decision_residente = ahora
        estimacion.fecha_notificacion_dependencia = ahora
        estimacion.save(
            update_fields=["status", "fecha_decision_residente", "fecha_notificacion_dependencia"]
        )
        EstimacionEvento.objects.create(
            estimacion=estimacion,
            tipo=EstimacionEvento.Tipo.APROBADA_RESIDENTE,
            actor=request.user,
        )
        # RN-NOTIF-004 (plan-notificaciones.md §3): Dependencia "se entera
        # del resultado" (RN-EST-011) vía una notificación real, no solo el
        # timestamp fecha_notificacion_dependencia.
        crear_notificaciones(
            User.objects.filter(role=Role.DEPENDENCIA),
            Notificacion.Tipo.ESTIMACION_APROBADA,
            f"La estimación {estimacion.numero} del contrato "
            f"{estimacion.contrato.no_contrato} fue aprobada por el Residente.",
            enlace=f"/estimaciones/{estimacion.id}",
        )
        return Response(self.get_serializer(estimacion).data)

    @action(detail=True, methods=["post"])
    def rechazar_residente(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.status != EstimacionStatus.EN_REVISION_RESIDENTE:
            return Response(
                {"detail": "Solo se puede rechazar una estimación en revisión."}, status=400
            )
        motivo = (request.data.get("motivo") or "").strip()
        if not motivo:
            return Response(
                {"motivo": "El motivo de rechazo es obligatorio (RN-EST-010)."}, status=400
            )

        ahora = timezone.now()
        estimacion.status = EstimacionStatus.BORRADOR
        estimacion.motivo_rechazo = motivo
        estimacion.fecha_decision_residente = ahora
        estimacion.fecha_notificacion_dependencia = ahora
        estimacion.save(
            update_fields=[
                "status",
                "motivo_rechazo",
                "fecha_decision_residente",
                "fecha_notificacion_dependencia",
            ]
        )
        EstimacionEvento.objects.create(
            estimacion=estimacion,
            tipo=EstimacionEvento.Tipo.RECHAZADA_RESIDENTE,
            actor=request.user,
            comentario=motivo,
        )
        destinatarios = list(User.objects.filter(role=Role.DEPENDENCIA))
        if estimacion.contrato.superintendente and estimacion.contrato.superintendente.user_id:
            destinatarios.append(estimacion.contrato.superintendente.user)
        crear_notificaciones(
            destinatarios,
            Notificacion.Tipo.ESTIMACION_RECHAZADA,
            f"La estimación {estimacion.numero} del contrato "
            f"{estimacion.contrato.no_contrato} fue rechazada: {motivo}",
            enlace=f"/estimaciones/{estimacion.id}",
        )
        return Response(self.get_serializer(estimacion).data)

    @action(detail=True, methods=["post"])
    def firmar(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.status != EstimacionStatus.PENDIENTE_FIRMA:
            return Response(
                {"detail": "Solo se puede firmar una estimación pendiente de firma."}, status=400
            )

        _firma, creada = Firma.objects.get_or_create(
            estimacion=estimacion,
            firmante=request.user,
            defaults={"rol": request.user.role},
        )
        if not creada:
            return Response({"detail": "Ya firmaste esta estimación."}, status=400)

        contrato = estimacion.contrato
        firmantes_requeridos = {
            uid
            for uid in (
                contrato.residente.user_id if contrato.residente else None,
                contrato.superintendente.user_id if contrato.superintendente else None,
                contrato.supervisor.user_id if contrato.supervisor else None,
            )
            if uid is not None
        }
        firmantes_actuales = set(
            estimacion.firmas.values_list("firmante_id", flat=True)
        )
        if firmantes_requeridos and firmantes_requeridos.issubset(firmantes_actuales):
            monto_amortizar = estimacion.amortizacion_anticipo
            estimacion.status = EstimacionStatus.FIRMADA
            estimacion.fecha_firma_completa = timezone.now()
            estimacion.save(update_fields=["status", "fecha_firma_completa"])
            if monto_amortizar:
                try:
                    anticipo = contrato.anticipo
                except Anticipo.DoesNotExist:
                    anticipo = None
                if anticipo:
                    anticipo.monto_amortizado = anticipo.monto_amortizado + monto_amortizar
                    anticipo.save(update_fields=["monto_amortizado"])
            EstimacionEvento.objects.create(
                estimacion=estimacion, tipo=EstimacionEvento.Tipo.FIRMADA, actor=request.user
            )
            crear_notificaciones(
                User.objects.filter(role=Role.FINANZAS),
                Notificacion.Tipo.ESTIMACION_FIRMADA,
                f"La estimación {estimacion.numero} del contrato {contrato.no_contrato} "
                "está firmada y lista para registrar su pago.",
                enlace=f"/estimaciones/{estimacion.id}",
            )
        return Response(self.get_serializer(estimacion).data)


class EstimacionConceptoViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = EstimacionConcepto.objects.select_related(
        "estimacion", "estimacion__contrato", "concepto"
    )
    serializer_class = EstimacionConceptoSerializer
    permission_classes = [EstimacionPermission]
    http_method_names = ["get", "post", "patch", "head", "options"]
    contrato_lookup_prefix = "estimacion__contrato"

    def get_queryset(self):
        qs = super().get_queryset()
        estimacion_id = self.request.query_params.get("estimacion")
        if estimacion_id:
            qs = qs.filter(estimacion_id=estimacion_id)
        return qs


class GeneradorElementoViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = GeneradorElemento.objects.select_related(
        "estimacion_concepto", "estimacion_concepto__estimacion__contrato"
    )
    serializer_class = GeneradorElementoSerializer
    permission_classes = [EstimacionPermission]
    contrato_lookup_prefix = "estimacion_concepto__estimacion__contrato"

    def get_queryset(self):
        qs = super().get_queryset()
        estimacion_concepto_id = self.request.query_params.get("estimacion_concepto")
        if estimacion_concepto_id:
            qs = qs.filter(estimacion_concepto_id=estimacion_concepto_id)
        estimacion_id = self.request.query_params.get("estimacion")
        if estimacion_id:
            qs = qs.filter(estimacion_concepto__estimacion_id=estimacion_id)
        return qs


class EvidenciaFotograficaViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = EvidenciaFotografica.objects.select_related(
        "estimacion_concepto", "estimacion_concepto__estimacion__contrato", "subido_por"
    )
    serializer_class = EvidenciaFotograficaSerializer
    permission_classes = [EstimacionPermission]
    http_method_names = ["get", "post", "delete", "head", "options"]
    contrato_lookup_prefix = "estimacion_concepto__estimacion__contrato"

    def get_queryset(self):
        qs = super().get_queryset()
        estimacion_concepto_id = self.request.query_params.get("estimacion_concepto")
        if estimacion_concepto_id:
            qs = qs.filter(estimacion_concepto_id=estimacion_concepto_id)
        estimacion_id = self.request.query_params.get("estimacion")
        if estimacion_id:
            qs = qs.filter(estimacion_concepto__estimacion_id=estimacion_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(subido_por=self.request.user, ip_origen=_client_ip(self.request))


