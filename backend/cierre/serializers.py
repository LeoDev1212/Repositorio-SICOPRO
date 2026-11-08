import datetime

from rest_framework import serializers

from contracts.models import ContractStatus
from users.models import Role

from .models import Cierre, CierreEvento, Suspension


def _nombre_usuario(user):
    return user.get_full_name() or user.username


def _usuario_asignado_al_contrato(request, contrato, roles_relevantes):
    """Mismo patrón usado en bitacora/estimaciones/documentos: valida que
    el usuario esté asignado al contrato, no solo que tenga el rol correcto."""
    if request is None or request.user.role not in roles_relevantes:
        return True
    role = request.user.role
    if role == Role.RESIDENTE:
        return contrato.residente_id is not None and contrato.residente.user_id == request.user.id
    if role == Role.SUPERINTENDENTE:
        return (
            contrato.superintendente_id is not None
            and contrato.superintendente.user_id == request.user.id
        )
    return True


class SuspensionSerializer(serializers.ModelSerializer):
    contrato_no = serializers.CharField(source="contrato.no_contrato", read_only=True)
    dias_suspendidos = serializers.ReadOnlyField()
    activa = serializers.ReadOnlyField()

    class Meta:
        model = Suspension
        fields = [
            "id",
            "contrato",
            "contrato_no",
            "causal",
            "motivo",
            "fecha_inicio",
            "fecha_fin",
            "es_indeterminada",
            "monto_gastos_no_recuperables",
            "registrada_por",
            "fecha_registro",
            "resuelta_por",
            "fecha_resolucion",
            "dias_suspendidos",
            "activa",
        ]
        read_only_fields = [
            "id",
            "contrato_no",
            "fecha_fin",
            "es_indeterminada",
            "registrada_por",
            "fecha_registro",
            "resuelta_por",
            "fecha_resolucion",
            "dias_suspendidos",
            "activa",
        ]

    def validate(self, attrs):
        contrato = attrs.get("contrato", getattr(self.instance, "contrato", None))

        if self.instance and not self.instance.activa:
            raise serializers.ValidationError(
                "No se puede editar una suspensión ya resuelta."
            )

        if self.instance is None and contrato:
            if contrato.status != ContractStatus.ACTIVO:
                raise serializers.ValidationError(
                    {"contrato": "Solo se puede suspender un contrato activo."}
                )
            if Suspension.objects.filter(contrato=contrato, fecha_fin__isnull=True).exists():
                raise serializers.ValidationError(
                    {"contrato": "Este contrato ya tiene una suspensión activa (RN-CIERRE-012)."}
                )
        return attrs


class CierreEventoSerializer(serializers.ModelSerializer):
    actor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = CierreEvento
        fields = ["id", "tipo", "actor", "actor_nombre", "comentario", "fecha"]
        read_only_fields = fields

    def get_actor_nombre(self, obj):
        return _nombre_usuario(obj.actor)


TIPOS_DISPONIBLES = {
    Cierre.Tipo.TERMINACION_CUMPLIMIENTO,
    Cierre.Tipo.RESCISION_ADMINISTRATIVA,
    Cierre.Tipo.TERMINACION_ANTICIPADA,
    Cierre.Tipo.RESCISION_JUDICIAL,
}


class CierreSerializer(serializers.ModelSerializer):
    contrato_no = serializers.CharField(source="contrato.no_contrato", read_only=True)
    fecha_limite_alegatos = serializers.ReadOnlyField()
    fecha_limite_resolucion_rescision = serializers.ReadOnlyField()
    aceptada_tacitamente = serializers.ReadOnlyField()
    anticipo_no_amortizado = serializers.ReadOnlyField()
    importe_neto_finiquito = serializers.ReadOnlyField()

    class Meta:
        model = Cierre
        fields = [
            "id",
            "contrato",
            "contrato_no",
            "tipo",
            "status",
            "motivo",
            "suspension_origen",
            "iniciado_por",
            "fecha_inicio",
            "notificado_por",
            "fecha_notificacion_inicio",
            "estimacion_liquidacion",
            "fecha_acta_entrega_recepcion",
            "documento_acta_entrega",
            "acta_entrega_formato",
            "acta_entrega_tamano",
            "acta_entrega_hash_sha256",
            "fecha_notificacion_incumplimiento",
            "alegatos_contratista",
            "fecha_alegatos",
            "se_rescinde",
            "fecha_resolucion",
            "documento_acta_circunstanciada",
            "acta_circunstanciada_formato",
            "acta_circunstanciada_tamano",
            "acta_circunstanciada_hash_sha256",
            "fecha_resolucion_judicial",
            "monto_resolucion_judicial",
            "monto_trabajos_ejecutados",
            "monto_penas_convencionales",
            "monto_gastos_no_recuperables",
            "fecha_finiquito",
            "documento_finiquito",
            "finiquito_formato",
            "finiquito_tamano",
            "finiquito_hash_sha256",
            "finiquitado_por",
            "fecha_creacion",
            "fecha_limite_alegatos",
            "fecha_limite_resolucion_rescision",
            "aceptada_tacitamente",
            "anticipo_no_amortizado",
            "importe_neto_finiquito",
        ]
        read_only_fields = [
            "id",
            "contrato_no",
            "status",
            "iniciado_por",
            "fecha_inicio",
            "notificado_por",
            "fecha_notificacion_inicio",
            "estimacion_liquidacion",
            "fecha_acta_entrega_recepcion",
            "documento_acta_entrega",
            "acta_entrega_formato",
            "acta_entrega_tamano",
            "acta_entrega_hash_sha256",
            "fecha_notificacion_incumplimiento",
            "alegatos_contratista",
            "fecha_alegatos",
            "se_rescinde",
            "fecha_resolucion",
            "documento_acta_circunstanciada",
            "acta_circunstanciada_formato",
            "acta_circunstanciada_tamano",
            "acta_circunstanciada_hash_sha256",
            "monto_trabajos_ejecutados",
            "monto_penas_convencionales",
            "monto_gastos_no_recuperables",
            "fecha_finiquito",
            "documento_finiquito",
            "finiquito_formato",
            "finiquito_tamano",
            "finiquito_hash_sha256",
            "finiquitado_por",
            "fecha_creacion",
        ]

    def validate(self, attrs):
        if self.instance is not None:
            raise serializers.ValidationError(
                "Un cierre no se edita directamente — usa las acciones de flujo."
            )
        request = self.context.get("request")
        tipo = attrs.get("tipo")
        contrato = attrs.get("contrato")

        if tipo not in TIPOS_DISPONIBLES:
            raise serializers.ValidationError(
                {"tipo": "Este tipo de cierre no está disponible todavía."}
            )

        roles_por_tipo = {
            Cierre.Tipo.TERMINACION_CUMPLIMIENTO: {Role.SUPERINTENDENTE},
            Cierre.Tipo.RESCISION_ADMINISTRATIVA: {Role.RESIDENTE, Role.DEPENDENCIA},
            Cierre.Tipo.TERMINACION_ANTICIPADA: {
                Role.RESIDENTE,
                Role.DEPENDENCIA,
                Role.SUPERINTENDENTE,
            },
            Cierre.Tipo.RESCISION_JUDICIAL: {Role.DEPENDENCIA},
        }
        if request and request.user.role not in roles_por_tipo[tipo]:
            raise serializers.ValidationError(
                {"tipo": "Tu rol no puede iniciar este tipo de cierre (RN-CIERRE-002)."}
            )
        if contrato and contrato.status != ContractStatus.ACTIVO:
            raise serializers.ValidationError(
                {"contrato": "Solo se puede iniciar un cierre sobre un contrato activo."}
            )
        if contrato and Cierre.objects.filter(
            contrato=contrato, status__in=[Cierre.Status.PROPUESTA, Cierre.Status.EN_PROCESO]
        ).exists():
            raise serializers.ValidationError(
                {"contrato": "Este contrato ya tiene un cierre en curso (RN-CIERRE-001/007)."}
            )
        if contrato and not _usuario_asignado_al_contrato(
            request, contrato, {Role.SUPERINTENDENTE, Role.RESIDENTE}
        ):
            raise serializers.ValidationError(
                {"contrato": "No tienes asignado este contrato."}
            )

        # RN-CIERRE-002: suspension_origen solo aplica a terminacion_anticipada,
        # debe pertenecer al mismo contrato y estar marcada como indeterminada.
        suspension_origen = attrs.get("suspension_origen")
        if suspension_origen is not None:
            if tipo != Cierre.Tipo.TERMINACION_ANTICIPADA:
                raise serializers.ValidationError(
                    {"suspension_origen": "Solo aplica a terminación anticipada."}
                )
            if contrato is None or suspension_origen.contrato_id != contrato.id:
                raise serializers.ValidationError(
                    {"suspension_origen": "Debe pertenecer al mismo contrato."}
                )
            if not suspension_origen.es_indeterminada:
                raise serializers.ValidationError(
                    {
                        "suspension_origen": "La suspensión debe estar marcada como "
                        "indeterminada."
                    }
                )

        # RN-CIERRE-002: rescision_judicial solo se registra con el hecho ya
        # resuelto — no se modela el litigio (plan-cierre.md §2).
        if tipo == Cierre.Tipo.RESCISION_JUDICIAL:
            fecha_resolucion_judicial = attrs.get("fecha_resolucion_judicial")
            if not fecha_resolucion_judicial:
                raise serializers.ValidationError(
                    {"fecha_resolucion_judicial": "Requerida — se registra el hecho ya resuelto."}
                )
            if fecha_resolucion_judicial > datetime.date.today():
                raise serializers.ValidationError(
                    {"fecha_resolucion_judicial": "No puede ser una fecha futura."}
                )
            if attrs.get("monto_resolucion_judicial") is None:
                raise serializers.ValidationError(
                    {"monto_resolucion_judicial": "Requerido."}
                )
        return attrs
