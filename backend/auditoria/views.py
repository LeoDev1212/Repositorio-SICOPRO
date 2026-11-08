from rest_framework import viewsets

from users.models import Role
from users.permissions import RoleScopedPermission

from .models import AuditoriaEvento
from .serializers import AuditoriaEventoSerializer

TOPE_FILAS = 500


class AuditoriaEventoPermission(RoleScopedPermission):
    action_roles = {
        "list": {Role.DEPENDENCIA},
        "retrieve": {Role.DEPENDENCIA},
    }


class AuditoriaEventoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditoriaEvento.objects.select_related("actor")
    serializer_class = AuditoriaEventoSerializer
    permission_classes = [AuditoriaEventoPermission]

    def get_queryset(self):
        qs = super().get_queryset()

        modulo = self.request.query_params.get("modulo")
        if modulo:
            qs = qs.filter(modulo=modulo)

        accion = self.request.query_params.get("accion")
        if accion:
            qs = qs.filter(accion__icontains=accion)

        actor = self.request.query_params.get("actor")
        if actor:
            qs = qs.filter(actor__username__icontains=actor)

        exitosa = self.request.query_params.get("exitosa")
        if exitosa == "true":
            qs = qs.filter(status_code__lt=400)
        elif exitosa == "false":
            qs = qs.filter(status_code__gte=400)

        return qs[:TOPE_FILAS]
