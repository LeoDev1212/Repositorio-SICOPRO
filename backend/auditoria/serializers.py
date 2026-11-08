from rest_framework import serializers

from .models import AuditoriaEvento


def _nombre_usuario(user):
    if user is None:
        return "Sistema"
    return user.get_full_name() or user.username


class AuditoriaEventoSerializer(serializers.ModelSerializer):
    actor_nombre = serializers.SerializerMethodField()
    exitosa = serializers.SerializerMethodField()

    class Meta:
        model = AuditoriaEvento
        fields = [
            "id",
            "actor",
            "actor_nombre",
            "metodo",
            "accion",
            "modulo",
            "recurso",
            "objeto_id",
            "ruta",
            "status_code",
            "exitosa",
            "ip",
            "fecha",
        ]

    def get_actor_nombre(self, obj):
        return _nombre_usuario(obj.actor)

    def get_exitosa(self, obj):
        return obj.status_code < 400
