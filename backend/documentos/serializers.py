from rest_framework import serializers

from contracts.models import ContractStatus

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


class ConceptoCatalogoSerializer(serializers.ModelSerializer):
    numero_generador = serializers.ReadOnlyField()
    cantidad_vigente = serializers.ReadOnlyField()

    class Meta:
        model = ConceptoCatalogo
        fields = [
            "id",
            "contrato",
            "clave",
            "descripcion",
            "unidad",
            "cantidad",
            "precio_unitario",
            "importe",
            "no_sujeto_ajuste_costos",
            "numero_generador",
            "cantidad_vigente",
        ]
        read_only_fields = ["id", "importe"]

    def validate_cantidad(self, value):
        if value <= 0:
            raise serializers.ValidationError("Debe ser mayor a 0.")
        return value

    def validate_precio_unitario(self, value):
        if value <= 0:
            raise serializers.ValidationError("Debe ser mayor a 0.")
        return value


class ProgramaConceptoMesSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramaConceptoMes
        fields = ["id", "concepto", "mes", "cantidad_programada"]
        read_only_fields = ["id"]

    def validate_cantidad_programada(self, value):
        if value < 0:
            raise serializers.ValidationError("No puede ser negativa.")
        return value

    def validate(self, attrs):
        concepto = attrs.get("concepto", getattr(self.instance, "concepto", None))
        mes = attrs.get("mes", getattr(self.instance, "mes", None))
        if concepto and mes:
            meses_totales = max(1, -(-concepto.contrato.plazo_dias // 30))
            if mes < 1 or mes > meses_totales:
                raise serializers.ValidationError(
                    {"mes": f"El contrato solo tiene {meses_totales} mes(es) de plazo."}
                )
        return attrs


class GarantiaSerializer(serializers.ModelSerializer):
    estado = serializers.ReadOnlyField()

    class Meta:
        model = Garantia
        fields = [
            "id",
            "contrato",
            "tipo",
            "numero_fianza",
            "institucion_afianzadora",
            "monto",
            "porcentaje_cobertura",
            "fecha_emision",
            "fecha_vigencia",
            "dias_alerta",
            "estado",
        ]
        read_only_fields = ["id"]

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError("Debe ser mayor a 0.")
        return value

    def validate(self, attrs):
        tipo = attrs.get("tipo", getattr(self.instance, "tipo", None))
        porcentaje = attrs.get(
            "porcentaje_cobertura", getattr(self.instance, "porcentaje_cobertura", None)
        )
        if porcentaje is not None and not (0 < porcentaje <= 100):
            raise serializers.ValidationError(
                {"porcentaje_cobertura": "Debe ser mayor a 0% y hasta 100%."}
            )
        if tipo == "cumplimiento" and porcentaje is not None and not (5 <= porcentaje <= 100):
            raise serializers.ValidationError(
                {
                    "porcentaje_cobertura": "La fianza de cumplimiento debe cubrir entre 5% "
                    "y 100% del monto del contrato."
                }
            )

        fecha_emision = attrs.get("fecha_emision", getattr(self.instance, "fecha_emision", None))
        fecha_vigencia = attrs.get(
            "fecha_vigencia", getattr(self.instance, "fecha_vigencia", None)
        )
        if fecha_emision and fecha_vigencia and fecha_vigencia <= fecha_emision:
            raise serializers.ValidationError(
                {"fecha_vigencia": "Debe ser posterior a la fecha de emisión."}
            )
        return attrs


class AnticipoSerializer(serializers.ModelSerializer):
    saldo_pendiente = serializers.ReadOnlyField()

    class Meta:
        model = Anticipo
        fields = [
            "id",
            "contrato",
            "monto_otorgado",
            "porcentaje_retencion_por_estimacion",
            "monto_amortizado",
            "saldo_pendiente",
        ]
        read_only_fields = ["id", "monto_amortizado"]

    def validate_porcentaje_retencion_por_estimacion(self, value):
        if not (0 < value <= 100):
            raise serializers.ValidationError("Debe estar entre 0 y 100.")
        return value

    def validate(self, attrs):
        contrato = attrs.get("contrato", getattr(self.instance, "contrato", None))
        monto_otorgado = attrs.get(
            "monto_otorgado", getattr(self.instance, "monto_otorgado", None)
        )
        if monto_otorgado is not None and monto_otorgado <= 0:
            raise serializers.ValidationError({"monto_otorgado": "Debe ser mayor a 0."})
        if contrato and monto_otorgado is not None and monto_otorgado > contrato.monto:
            raise serializers.ValidationError(
                {"monto_otorgado": "No puede ser mayor al monto del contrato."}
            )
        return attrs


ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "dwg", "xml"}
MAX_ARCHIVO_BYTES = 50 * 1024 * 1024  # 50 MB, ver RN-030 (recortada: solo tipo y tamaño)


class ContractDocumentSerializer(serializers.ModelSerializer):
    def validate_archivo(self, value):
        extension = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Formato no permitido. Usa: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
            )
        if value.size > MAX_ARCHIVO_BYTES:
            raise serializers.ValidationError("El archivo no puede pesar más de 50 MB.")
        return value

    class Meta:
        model = ContractDocument
        fields = [
            "id",
            "contrato",
            "bloque",
            "nombre",
            "archivo",
            "formato",
            "tamano",
            "hash_sha256",
            "estado",
            "version_anterior",
            "subido_por",
            "ip_origen",
            "fecha_carga",
        ]
        read_only_fields = [
            "id",
            "formato",
            "tamano",
            "hash_sha256",
            "estado",
            "version_anterior",
            "subido_por",
            "ip_origen",
            "fecha_carga",
        ]


class ConvenioModificatorioConceptoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvenioModificatorioConcepto
        fields = ["id", "convenio", "concepto", "cantidad_delta"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        convenio = attrs.get("convenio", getattr(self.instance, "convenio", None))
        concepto = attrs.get("concepto", getattr(self.instance, "concepto", None))
        if convenio and convenio.status != ConvenioModificatorioStatus.BORRADOR:
            raise serializers.ValidationError(
                "Solo se puede editar el detalle de un convenio en borrador (RN-CONV-005)."
            )
        if convenio and concepto and concepto.contrato_id != convenio.contrato_id:
            raise serializers.ValidationError(
                {"concepto": "El concepto no pertenece al contrato del convenio."}
            )
        return attrs


class ConvenioModificatorioSerializer(serializers.ModelSerializer):
    conceptos = ConvenioModificatorioConceptoSerializer(many=True, read_only=True)
    contrato_no = serializers.CharField(source="contrato.no_contrato", read_only=True)

    class Meta:
        model = ConvenioModificatorio
        fields = [
            "id",
            "contrato",
            "contrato_no",
            "numero",
            "tipo",
            "justificacion",
            "monto_delta",
            "dias_delta",
            "documento",
            "formato",
            "tamano",
            "hash_sha256",
            "status",
            "motivo_rechazo",
            "creado_por",
            "aprobado_por",
            "fecha_aprobacion",
            "fecha_creacion",
            "conceptos",
        ]
        read_only_fields = [
            "id",
            "numero",
            "formato",
            "tamano",
            "hash_sha256",
            "status",
            "motivo_rechazo",
            "creado_por",
            "aprobado_por",
            "fecha_aprobacion",
            "fecha_creacion",
            "conceptos",
        ]

    def validate(self, attrs):
        if self.instance and self.instance.status != ConvenioModificatorioStatus.BORRADOR:
            raise serializers.ValidationError(
                "Solo se puede editar un convenio mientras está en borrador (RN-CONV-005)."
            )
        # RN-CIERRE-009 (plan-cierre.md §6): gap encontrado al diseñar Cierre
        # — este chequeo nunca existió. Solo aplica a la creación (no hay
        # excepción tipo "estimación de liquidación" para Convenios: una vez
        # que el contrato entra en cierre, no hay ningún convenio que deba
        # seguir generándose).
        if self.instance is None:
            contrato = attrs.get("contrato")
            if contrato and contrato.status != ContractStatus.ACTIVO:
                raise serializers.ValidationError(
                    {
                        "contrato": "Solo se pueden crear convenios modificatorios sobre un "
                        "contrato activo (RN-CIERRE-009)."
                    }
                )
        return attrs
