from rest_framework import serializers

from .models import Notificacion


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = ["id", "tipo", "mensaje", "enlace", "leida", "fecha_creacion"]
        read_only_fields = ["id", "tipo", "mensaje", "enlace", "fecha_creacion"]
