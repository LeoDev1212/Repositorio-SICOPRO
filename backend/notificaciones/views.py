from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.models import Role
from users.permissions import RoleScopedPermission

from .models import Notificacion
from .serializers import NotificacionSerializer

ALL_ROLES = {Role.DEPENDENCIA, Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION, Role.FINANZAS}


class NotificacionPermission(RoleScopedPermission):
    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "partial_update": ALL_ROLES,
        "marcar_todas_leidas": ALL_ROLES,
    }


class NotificacionViewSet(viewsets.ModelViewSet):
    """Sin ContratoScopedMixin: el alcance es directo por destinatario
    (RN-NOTIF-002), no por asignación de contrato — igual para los 5 roles,
    ni siquiera Dependencia ve las de otros."""

    serializer_class = NotificacionSerializer
    permission_classes = [NotificacionPermission]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        return Notificacion.objects.filter(destinatario=self.request.user)

    @action(detail=False, methods=["post"])
    def marcar_todas_leidas(self, request):
        self.get_queryset().filter(leida=False).update(leida=True)
        return Response({"detail": "Notificaciones marcadas como leídas."})
