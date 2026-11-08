import datetime

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from users.serializers import ContratistaSerializer, EmpresaSupervisionSerializer, PersonaSerializer

from .models import Contract


class ContractSerializer(serializers.ModelSerializer):
    no_contrato = serializers.CharField(
        max_length=50,
        validators=[
            UniqueValidator(
                queryset=Contract.objects.all(),
                message="Ya existe un contrato registrado con este número.",
            )
        ],
    )
    contratista_detalle = ContratistaSerializer(source="contratista", read_only=True)
    empresa_supervision_detalle = EmpresaSupervisionSerializer(
        source="empresa_supervision", read_only=True
    )
    residente_detalle = PersonaSerializer(source="residente", read_only=True)
    supervisor_detalle = PersonaSerializer(source="supervisor", read_only=True)
    superintendente_detalle = PersonaSerializer(source="superintendente", read_only=True)
    monto_vigente = serializers.ReadOnlyField()
    plazo_vigente_dias = serializers.ReadOnlyField()
    fecha_termino_vigente = serializers.ReadOnlyField()
    fondo_garantia_acumulado = serializers.ReadOnlyField()

    def validate_monto(self, value):
        if value <= 10000:
            raise serializers.ValidationError("Debe ser mayor a $10,000.00 (RN-CONTRATO-001).")
        return value

    def validate_plazo_dias(self, value):
        if value < 30:
            raise serializers.ValidationError(
                "Debe ser de al menos 30 días (un mes) (RN-CONTRATO-002)."
            )
        return value

    class Meta:
        model = Contract
        fields = [
            "id",
            "no_contrato",
            "monto",
            "objeto",
            "descripcion",
            "plazo_dias",
            "fecha_inicio",
            "fecha_termino",
            "ubicacion",
            "es_retroactivo",
            "status",
            "contratista",
            "contratista_detalle",
            "empresa_supervision",
            "empresa_supervision_detalle",
            "residente",
            "residente_detalle",
            "supervisor",
            "supervisor_detalle",
            "superintendente",
            "superintendente_detalle",
            "creado_por",
            "fecha_creacion",
            "fecha_activacion",
            "monto_vigente",
            "plazo_vigente_dias",
            "fecha_termino_vigente",
            "fondo_garantia_acumulado",
        ]
        read_only_fields = [
            "id",
            "fecha_termino",
            "status",
            "creado_por",
            "fecha_creacion",
            "fecha_activacion",
        ]

    def validate(self, attrs):
        fecha_inicio = attrs.get(
            "fecha_inicio", getattr(self.instance, "fecha_inicio", None)
        )
        es_retroactivo = attrs.get(
            "es_retroactivo", getattr(self.instance, "es_retroactivo", False)
        )
        if fecha_inicio and not es_retroactivo and fecha_inicio < datetime.date.today():
            raise serializers.ValidationError(
                {
                    "fecha_inicio": "No puede ser anterior a hoy salvo que el contrato "
                    "sea retroactivo."
                }
            )

        # RN-CIERRE-010: bloquea asignar un contratista inhabilitado a un
        # contrato nuevo (enforcement real, no solo informativo).
        contratista = attrs.get("contratista", getattr(self.instance, "contratista", None))
        if contratista and contratista.inhabilitado_vigente:
            hasta = (
                f" hasta {contratista.fecha_fin_inhabilitacion.isoformat()}"
                if contratista.fecha_fin_inhabilitacion
                else " (sin fecha de término registrada)"
            )
            raise serializers.ValidationError(
                {"contratista": f"Este contratista está inhabilitado para contratar{hasta}."}
            )
        return attrs
