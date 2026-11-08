from decimal import Decimal

from django.db import models
from rest_framework import serializers

from cierre.models import Cierre
from contracts.models import ContractStatus
from documentos.models import ProgramaConceptoMes
from users.models import Role

from .models import (
    Estimacion,
    EstimacionConcepto,
    EstimacionEvento,
    EstimacionStatus,
    EvidenciaFotografica,
    Firma,
    GeneradorElemento,
)


def _nombre_usuario(user):
    return user.get_full_name() or user.username


def _puede_operar_con_contrato_en_cierre(contrato, estimacion=None):
    """RN-CIERRE-009 (plan-cierre.md §6): excepción al congelamiento — se
    permite crear/editar la estimación de liquidación de un cierre por
    terminación por cumplimiento en curso, aunque el contrato ya no esté
    `activo`. Sin `estimacion` (crear) exige que el cierre todavía no tenga
    ninguna vinculada; con `estimacion` (editar) exige que sea justo esa.
    Sin esto, el propio flujo de cierre normal sería imposible de completar."""
    qs = Cierre.objects.filter(
        contrato=contrato,
        tipo=Cierre.Tipo.TERMINACION_CUMPLIMIENTO,
        status=Cierre.Status.EN_PROCESO,
    )
    if estimacion is not None:
        return qs.filter(estimacion_liquidacion=estimacion).exists()
    return qs.filter(estimacion_liquidacion__isnull=True).exists()


ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}
MAX_IMAGEN_BYTES = 50 * 1024 * 1024  # 50 MB, mismo límite que ContractDocument


def _usuario_asignado_al_contrato(request, contrato):
    """RN-EST-007/019: un Superintendente solo puede escribir sobre
    contratos donde él mismo está asignado, no solo con el rol correcto."""
    if request is None or request.user.role != Role.SUPERINTENDENTE:
        return True
    return (
        contrato.superintendente_id is not None
        and contrato.superintendente.user_id == request.user.id
    )


class EstimacionConceptoSerializer(serializers.ModelSerializer):
    cantidad_acumulada = serializers.ReadOnlyField()
    cantidad_pendiente = serializers.ReadOnlyField()

    class Meta:
        model = EstimacionConcepto
        fields = [
            "id",
            "estimacion",
            "concepto",
            "cantidad_acumulada_anterior",
            "cantidad_ejecutada",
            "precio_unitario",
            "importe",
            "cantidad_acumulada",
            "cantidad_pendiente",
        ]
        read_only_fields = [
            "id",
            "cantidad_acumulada_anterior",
            "precio_unitario",
            "importe",
        ]

    def validate_cantidad_ejecutada(self, value):
        if value < 0:
            raise serializers.ValidationError("No puede ser negativa.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        estimacion = attrs.get("estimacion", getattr(self.instance, "estimacion", None))
        concepto = attrs.get("concepto", getattr(self.instance, "concepto", None))
        cantidad_ejecutada = attrs.get(
            "cantidad_ejecutada", getattr(self.instance, "cantidad_ejecutada", None)
        )

        if estimacion and not _usuario_asignado_al_contrato(request, estimacion.contrato):
            raise serializers.ValidationError(
                {"estimacion": "No tienes asignado el contrato de esta estimación."}
            )

        if estimacion and estimacion.status != EstimacionStatus.BORRADOR:
            raise serializers.ValidationError(
                {"estimacion": "Solo se puede editar el cuadro de cantidades en borrador."}
            )

        if concepto and estimacion and concepto.contrato_id != estimacion.contrato_id:
            raise serializers.ValidationError(
                {"concepto": "El concepto no pertenece al contrato de la estimación."}
            )

        if (
            self.instance
            and "cantidad_ejecutada" in attrs
            and self.instance.generador.exists()
        ):
            raise serializers.ValidationError(
                {
                    "cantidad_ejecutada": "Este concepto tiene número generador: edita las filas "
                    "de generador, la cantidad ejecutada se recalcula sola."
                }
            )

        if concepto and estimacion and cantidad_ejecutada is not None:
            acumulada_anterior = (
                self.instance.cantidad_acumulada_anterior
                if self.instance
                else EstimacionConcepto.cantidad_acumulada_previa(concepto, estimacion)
            )
            if acumulada_anterior + cantidad_ejecutada > concepto.cantidad_vigente:
                raise serializers.ValidationError(
                    {
                        "cantidad_ejecutada": "La cantidad acumulada no puede exceder la "
                        "cantidad vigente del concepto (RN-EST-003)."
                    }
                )
        return attrs


class GeneradorElementoSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneradorElemento
        fields = [
            "id",
            "estimacion_concepto",
            "elemento",
            "cantidad_n",
            "largo",
            "ancho",
            "alto",
            "parcial",
            "observaciones",
            "orden",
        ]
        read_only_fields = ["id", "parcial"]

    def validate_cantidad_n(self, value):
        if value < 0:
            raise serializers.ValidationError("No puede ser negativa.")
        return value

    def validate_largo(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return value

    def validate_ancho(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return value

    def validate_alto(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        estimacion_concepto = attrs.get(
            "estimacion_concepto", getattr(self.instance, "estimacion_concepto", None)
        )
        if estimacion_concepto:
            estimacion = estimacion_concepto.estimacion
            if not _usuario_asignado_al_contrato(request, estimacion.contrato):
                raise serializers.ValidationError(
                    {"estimacion_concepto": "No tienes asignado el contrato de esta estimación."}
                )
            if estimacion.status != EstimacionStatus.BORRADOR:
                raise serializers.ValidationError(
                    {
                        "estimacion_concepto": "Solo se puede editar el número generador en "
                        "borrador."
                    }
                )

            # RN-EST-003 también aplica aquí: el generador no debe poder
            # rebasar el tope, solo porque no se captura como cantidad directa.
            def _o_uno(campo):
                valor = attrs.get(campo, getattr(self.instance, campo, None))
                return valor if valor is not None else Decimal("1")

            nuevo_parcial = _o_uno("cantidad_n") * _o_uno("largo") * _o_uno("ancho") * _o_uno(
                "alto"
            )
            otras_filas = estimacion_concepto.generador.all()
            if self.instance:
                otras_filas = otras_filas.exclude(pk=self.instance.pk)
            suma_otras = otras_filas.aggregate(total=models.Sum("parcial"))["total"] or Decimal(
                "0"
            )
            nueva_cantidad_ejecutada = suma_otras + nuevo_parcial
            tope = estimacion_concepto.concepto.cantidad_vigente
            if estimacion_concepto.cantidad_acumulada_anterior + nueva_cantidad_ejecutada > tope:
                raise serializers.ValidationError(
                    "La cantidad resultante del generador no puede exceder la cantidad "
                    "vigente del concepto (RN-EST-003)."
                )
        return attrs


class EvidenciaFotograficaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenciaFotografica
        fields = [
            "id",
            "estimacion_concepto",
            "imagen",
            "formato",
            "tamano",
            "hash_sha256",
            "momento",
            "subido_por",
            "ip_origen",
            "fecha_carga",
        ]
        read_only_fields = [
            "id",
            "formato",
            "tamano",
            "hash_sha256",
            "subido_por",
            "ip_origen",
            "fecha_carga",
        ]

    def validate_imagen(self, value):
        extension = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        if extension not in ALLOWED_IMAGE_EXTENSIONS:
            raise serializers.ValidationError(
                f"Formato no permitido. Usa: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}."
            )
        if value.size > MAX_IMAGEN_BYTES:
            raise serializers.ValidationError("La imagen no puede pesar más de 50 MB.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        estimacion_concepto = attrs.get(
            "estimacion_concepto", getattr(self.instance, "estimacion_concepto", None)
        )
        if estimacion_concepto:
            estimacion = estimacion_concepto.estimacion
            if not _usuario_asignado_al_contrato(request, estimacion.contrato):
                raise serializers.ValidationError(
                    {"estimacion_concepto": "No tienes asignado el contrato de esta estimación."}
                )
            if estimacion.status != EstimacionStatus.BORRADOR:
                raise serializers.ValidationError(
                    {
                        "estimacion_concepto": "Solo se pueden subir evidencias mientras la "
                        "estimación está en borrador."
                    }
                )
        return attrs


class FirmaSerializer(serializers.ModelSerializer):
    firmante_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Firma
        fields = ["id", "firmante", "firmante_nombre", "rol", "fecha_firma"]
        read_only_fields = fields

    def get_firmante_nombre(self, obj):
        return _nombre_usuario(obj.firmante)


class EstimacionEventoSerializer(serializers.ModelSerializer):
    actor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EstimacionEvento
        fields = ["id", "tipo", "actor", "actor_nombre", "comentario", "fecha"]
        read_only_fields = fields

    def get_actor_nombre(self, obj):
        return _nombre_usuario(obj.actor)


class EstimacionSerializer(serializers.ModelSerializer):
    subtotal = serializers.ReadOnlyField()
    iva = serializers.ReadOnlyField()
    importe_bruto = serializers.ReadOnlyField()
    amortizacion_anticipo = serializers.ReadOnlyField()
    fondo_garantia = serializers.ReadOnlyField()
    retencion_cinco_al_millar = serializers.ReadOnlyField()
    importe_neto = serializers.ReadOnlyField()
    firmas = FirmaSerializer(many=True, read_only=True)

    def validate_iva_tasa(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("Debe estar entre 0 y 100.")
        return value

    def validate_porcentaje_fondo_garantia(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("Debe estar entre 0 y 100.")
        return value

    def validate_porcentaje_cinco_al_millar(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("Debe estar entre 0 y 100.")
        return value

    class Meta:
        model = Estimacion
        fields = [
            "id",
            "contrato",
            "numero",
            "mes_programa",
            "periodo_inicio",
            "periodo_fin",
            "status",
            "pagada",
            "iva_tasa",
            "porcentaje_fondo_garantia",
            "porcentaje_cinco_al_millar",
            "penalizaciones",
            "motivo_penalizacion",
            "otras_deducciones",
            "motivo_otras_deducciones",
            "motivo_rechazo",
            "creado_por",
            "fecha_presentacion",
            "fecha_decision_residente",
            "fecha_notificacion_dependencia",
            "fecha_firma_completa",
            "fecha_creacion",
            "subtotal",
            "iva",
            "importe_bruto",
            "amortizacion_anticipo",
            "fondo_garantia",
            "retencion_cinco_al_millar",
            "importe_neto",
            "firmas",
        ]
        read_only_fields = [
            "id",
            "numero",
            "periodo_inicio",
            "periodo_fin",
            "status",
            # Las deducciones son "captura manual del Residente" (plan §3):
            # el Superintendente no las toca vía el update general — solo
            # el Residente, vía la acción `deducciones` (RN de fase 6).
            "penalizaciones",
            "motivo_penalizacion",
            "otras_deducciones",
            "motivo_otras_deducciones",
            "motivo_rechazo",
            "creado_por",
            "fecha_presentacion",
            "fecha_decision_residente",
            "fecha_notificacion_dependencia",
            "fecha_firma_completa",
            "fecha_creacion",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        contrato = attrs.get("contrato", getattr(self.instance, "contrato", None))

        if contrato and not _usuario_asignado_al_contrato(request, contrato):
            raise serializers.ValidationError(
                {"contrato": "No tienes asignado este contrato como Superintendente."}
            )

        if contrato and contrato.status != ContractStatus.ACTIVO:
            if not _puede_operar_con_contrato_en_cierre(contrato, estimacion=self.instance):
                raise serializers.ValidationError(
                    {
                        "contrato": "Solo se pueden crear o editar estimaciones sobre un "
                        "contrato activo (o, si está en cierre, la estimación de liquidación "
                        "ya vinculada) — RN-CIERRE-009."
                    }
                )

        if self.instance and self.instance.status != EstimacionStatus.BORRADOR:
            raise serializers.ValidationError(
                "Solo se puede editar una estimación mientras está en borrador."
            )

        mes_programa = attrs.get("mes_programa", getattr(self.instance, "mes_programa", None))
        if contrato and mes_programa:
            meses_totales = max(1, -(-contrato.plazo_dias // 30))
            if mes_programa < 1 or mes_programa > meses_totales:
                raise serializers.ValidationError(
                    {"mes_programa": f"El contrato solo tiene {meses_totales} mes(es) de plazo."}
                )

            cambia_mes = self.instance is None or mes_programa != self.instance.mes_programa
            if cambia_mes:
                # El orden FIFO (RN-EST-021) ya no se valida aquí, al crear —
                # se reubicó a EstimacionViewSet.presentar() contra estimaciones
                # *presentadas*, no *creadas* (plan §4.1, Fase 8): el
                # Superintendente puede capturar meses por adelantado, pero
                # solo puede *presentarlos* en orden. Aquí solo queda la
                # unicidad: nunca dos estimaciones para el mismo mes.
                otras = Estimacion.objects.filter(contrato=contrato)
                if self.instance:
                    otras = otras.exclude(pk=self.instance.pk)
                if otras.filter(mes_programa=mes_programa).exists():
                    raise serializers.ValidationError(
                        {"mes_programa": "Ya existe una estimación para este mes en el contrato."}
                    )
        return attrs


class EstimacionDeduccionesSerializer(serializers.ModelSerializer):
    """Fase 6: único punto de escritura para las deducciones, reservado al
    Residente (ver EstimacionSerializer.Meta.read_only_fields)."""

    class Meta:
        model = Estimacion
        fields = [
            "penalizaciones",
            "motivo_penalizacion",
            "otras_deducciones",
            "motivo_otras_deducciones",
        ]

    def validate_penalizaciones(self, value):
        if value < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return value

    def validate_otras_deducciones(self, value):
        if value < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return value


class EstimacionCreateSerializer(EstimacionSerializer):
    """Además de crear la estimación, siembra el cuadro de cantidades con
    la sugerencia del programa de obra del mes (RN de fase 1: "sugerencia
    desde el programa")."""

    def create(self, validated_data):
        estimacion = super().create(validated_data)
        programa = ProgramaConceptoMes.objects.filter(
            concepto__contrato_id=estimacion.contrato_id, mes=estimacion.mes_programa
        ).select_related("concepto")
        for entrada in programa:
            EstimacionConcepto.objects.create(
                estimacion=estimacion,
                concepto=entrada.concepto,
                cantidad_ejecutada=entrada.cantidad_programada,
            )
        return estimacion


class EstimacionPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estimacion
        fields = ["pagada"]
