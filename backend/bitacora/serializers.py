from django.utils import timezone
from rest_framework import serializers

from contracts.models import ContractStatus
from users.models import Role

from .models import Bitacora, BitacoraStatus, NotaBitacora, NotaClasificacion


def _nombre_usuario(user):
    return user.get_full_name() or user.username


def _usuario_asignado_al_contrato(request, contrato, roles_relevantes):
    """RN-BIT-004/011: valida que el usuario esté asignado al contrato, no
    solo que tenga el rol correcto (mismo patrón que Estimaciones)."""
    if request is None or request.user.role not in roles_relevantes:
        return True
    role = request.user.role
    if role == Role.RESIDENTE:
        return contrato.residente_id is not None and contrato.residente.user_id == request.user.id
    if role == Role.SUPERVISION:
        return contrato.supervisor_id is not None and contrato.supervisor.user_id == request.user.id
    if role == Role.SUPERINTENDENTE:
        return (
            contrato.superintendente_id is not None
            and contrato.superintendente.user_id == request.user.id
        )
    return True


class BitacoraSerializer(serializers.ModelSerializer):
    contrato_no = serializers.CharField(source="contrato.no_contrato", read_only=True)
    abierta_por_nombre = serializers.SerializerMethodField()
    cerrada_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Bitacora
        fields = [
            "id",
            "contrato",
            "contrato_no",
            "estado",
            "fecha_apertura",
            "fecha_cierre",
            "abierta_por",
            "abierta_por_nombre",
            "cerrada_por",
            "cerrada_por_nombre",
            "fecha_creacion",
        ]
        read_only_fields = [
            "id",
            "estado",
            "fecha_cierre",
            "abierta_por",
            "abierta_por_nombre",
            "cerrada_por",
            "cerrada_por_nombre",
            "fecha_creacion",
        ]

    def get_abierta_por_nombre(self, obj):
        return _nombre_usuario(obj.abierta_por) if obj.abierta_por_id else None

    def get_cerrada_por_nombre(self, obj):
        return _nombre_usuario(obj.cerrada_por) if obj.cerrada_por_id else None

    def validate(self, attrs):
        request = self.context.get("request")
        contrato = attrs.get("contrato", getattr(self.instance, "contrato", None))
        if contrato is None:
            return attrs

        if not _usuario_asignado_al_contrato(request, contrato, {Role.RESIDENTE}):
            raise serializers.ValidationError(
                {"contrato": "No tienes asignado este contrato como Residente."}
            )
        if contrato.status != ContractStatus.ACTIVO:
            raise serializers.ValidationError(
                {"contrato": "Solo se puede abrir una bitácora sobre un contrato activo (RN-BIT-001)."}
            )
        if self.instance is None and Bitacora.objects.filter(contrato=contrato).exists():
            raise serializers.ValidationError(
                {"contrato": "Este contrato ya tiene una bitácora abierta (RN-BIT-002)."}
            )

        fecha_apertura = attrs.get("fecha_apertura")
        if fecha_apertura and fecha_apertura > timezone.localdate():
            raise serializers.ValidationError({"fecha_apertura": "No puede ser una fecha futura."})
        return attrs


class NotaBitacoraSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = NotaBitacora
        fields = [
            "id",
            "bitacora",
            "numero",
            "clasificacion",
            "descripcion",
            "ubicacion",
            "causa",
            "solucion",
            "prevencion",
            "consecuencia_economica",
            "responsable",
            "fecha_atencion",
            "nota_referencia",
            "estimacion",
            "cierre",
            "autor",
            "autor_nombre",
            "fecha",
        ]
        read_only_fields = ["id", "numero", "estimacion", "cierre", "autor", "autor_nombre", "fecha"]

    def get_autor_nombre(self, obj):
        return _nombre_usuario(obj.autor)

    def validate(self, attrs):
        request = self.context.get("request")
        bitacora = attrs.get("bitacora", getattr(self.instance, "bitacora", None))
        if bitacora is None:
            return attrs

        if self.instance is not None:
            raise serializers.ValidationError("Las notas de bitácora no se pueden editar (RN-BIT-005).")

        if not _usuario_asignado_al_contrato(
            request,
            bitacora.contrato,
            {Role.RESIDENTE, Role.SUPERVISION, Role.SUPERINTENDENTE},
        ):
            raise serializers.ValidationError(
                {"bitacora": "No tienes asignado el contrato de esta bitácora."}
            )
        if bitacora.estado != BitacoraStatus.ABIERTA:
            raise serializers.ValidationError(
                {"bitacora": "La bitácora está cerrada: no admite nuevas notas (RN-BIT-008)."}
            )

        clasificacion = attrs.get("clasificacion")
        if clasificacion in (NotaClasificacion.APERTURA, NotaClasificacion.CIERRE):
            raise serializers.ValidationError(
                {"clasificacion": "Esta clasificación la genera el sistema automáticamente."}
            )

        nota_referencia = attrs.get("nota_referencia")
        if nota_referencia and nota_referencia.bitacora_id != bitacora.id:
            raise serializers.ValidationError(
                {"nota_referencia": "Debe pertenecer a la misma bitácora."}
            )
        return attrs


