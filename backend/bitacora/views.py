from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.models import Role
from users.permissions import AssignmentScopedQuerySetMixin, RoleScopedPermission

from .models import Bitacora, BitacoraStatus, NotaBitacora, NotaClasificacion
from .serializers import BitacoraSerializer, NotaBitacoraSerializer

ALL_ROLES = {Role.DEPENDENCIA, Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION}
AUTORES_NOTA = {Role.RESIDENTE, Role.SUPERVISION, Role.SUPERINTENDENTE}


class BitacoraPermission(RoleScopedPermission):
    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": {Role.RESIDENTE},
        "cerrar": {Role.RESIDENTE},
    }


class NotaBitacoraPermission(RoleScopedPermission):
    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": AUTORES_NOTA,
    }


class ContratoScopedMixin(AssignmentScopedQuerySetMixin):
    """Mismo patrón que `estimaciones.views.ContratoScopedMixin` — Finanzas
    no tiene ningún rol en este módulo, así que basta con no incluirlo en
    `unrestricted_roles` ni en `assignment_lookups` para que quede en
    default-deny (qs.none())."""

    unrestricted_roles = {Role.DEPENDENCIA}
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


class BitacoraViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = Bitacora.objects.select_related("contrato", "abierta_por", "cerrada_por")
    serializer_class = BitacoraSerializer
    permission_classes = [BitacoraPermission]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        bitacora = serializer.save(abierta_por=self.request.user)
        NotaBitacora.objects.create(
            bitacora=bitacora,
            clasificacion=NotaClasificacion.APERTURA,
            descripcion=(
                f"Apertura de bitácora del contrato {bitacora.contrato.no_contrato}. "
                f"Fecha de apertura: {bitacora.fecha_apertura.isoformat()}."
            ),
            autor=self.request.user,
        )

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        bitacora = self.get_object()
        if bitacora.estado != BitacoraStatus.ABIERTA:
            return Response(
                {"detail": "Solo se puede cerrar una bitácora abierta."}, status=400
            )
        motivo = (request.data.get("motivo") or "").strip()
        if not motivo:
            return Response(
                {"motivo": "El motivo/resumen de cierre es obligatorio (RN-BIT-007)."}, status=400
            )

        bitacora.estado = BitacoraStatus.CERRADA
        bitacora.fecha_cierre = timezone.localdate()
        bitacora.cerrada_por = request.user
        bitacora.save(update_fields=["estado", "fecha_cierre", "cerrada_por"])
        NotaBitacora.objects.create(
            bitacora=bitacora,
            clasificacion=NotaClasificacion.CIERRE,
            descripcion=motivo,
            autor=request.user,
        )
        return Response(self.get_serializer(bitacora).data)


class NotaBitacoraViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = NotaBitacora.objects.select_related(
        "bitacora", "bitacora__contrato", "autor", "nota_referencia"
    )
    serializer_class = NotaBitacoraSerializer
    permission_classes = [NotaBitacoraPermission]
    http_method_names = ["get", "post", "head", "options"]
    contrato_lookup_prefix = "bitacora__contrato"

    def get_queryset(self):
        qs = super().get_queryset()
        bitacora_id = self.request.query_params.get("bitacora")
        if bitacora_id:
            qs = qs.filter(bitacora_id=bitacora_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)


