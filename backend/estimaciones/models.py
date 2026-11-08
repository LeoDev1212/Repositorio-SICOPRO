import datetime
import hashlib
from decimal import Decimal

from django.conf import settings
from django.db import models

from bitacora.models import Bitacora
from contracts.models import Contract
from documentos.models import Anticipo, ConceptoCatalogo


class EstimacionStatus(models.TextChoices):
    BORRADOR = "borrador", "Borrador"
    EN_REVISION_RESIDENTE = "en_revision_residente", "En revisión (Residente)"
    RECHAZADA_RESIDENTE = "rechazada_residente", "Rechazada por Residente"
    APROBADA_RESIDENTE = "aprobada_residente", "Aprobada por Residente"
    PENDIENTE_FIRMA = "pendiente_firma", "Pendiente de firma"
    FIRMADA = "firmada", "Firmada"


class Estimacion(models.Model):
    # Estados a partir de los cuales una cantidad reportada ya cuenta como
    # "acumulada" para el tope de RN-EST-003 (ver EstimacionConcepto) — el
    # Residente ya la validó, así que no se puede volver a rechazar/perder.
    ESTADOS_APROBADOS = {
        EstimacionStatus.APROBADA_RESIDENTE,
        EstimacionStatus.PENDIENTE_FIRMA,
        EstimacionStatus.FIRMADA,
    }

    contrato = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name="estimaciones")
    numero = models.PositiveIntegerField(editable=False, default=0)
    mes_programa = models.PositiveIntegerField()
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    status = models.CharField(
        max_length=25, choices=EstimacionStatus.choices, default=EstimacionStatus.BORRADOR
    )
    pagada = models.BooleanField(default=False)

    iva_tasa = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("16.00"))
    porcentaje_fondo_garantia = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("5.00")
    )
    # RN-EST-022: retención federal de inspección, control y vigilancia
    # (Art. 191 RLOPSRM), conocida coloquialmente como "cinco al millar".
    # Mismo trato que porcentaje_fondo_garantia: tasa informativa/configurable
    # por estimación, no una cantidad capturada a mano (a diferencia de
    # penalizaciones/otras_deducciones).
    porcentaje_cinco_al_millar = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.50")
    )
    penalizaciones = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    motivo_penalizacion = models.TextField(blank=True)
    otras_deducciones = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    motivo_otras_deducciones = models.TextField(blank=True)
    motivo_rechazo = models.TextField(blank=True)

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="estimaciones_creadas"
    )

    fecha_presentacion = models.DateTimeField(null=True, blank=True)
    fecha_decision_residente = models.DateTimeField(null=True, blank=True)
    fecha_notificacion_dependencia = models.DateTimeField(null=True, blank=True)
    fecha_firma_completa = models.DateTimeField(null=True, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("contrato", "numero")
        ordering = ["contrato", "-numero"]

    def __str__(self):
        return f"{self.contrato.no_contrato} — Estimación {self.numero}"

    def save(self, *args, **kwargs):
        if not self.numero:
            ultimo = Estimacion.objects.filter(contrato=self.contrato).aggregate(
                models.Max("numero")
            )["numero__max"]
            self.numero = (ultimo or 0) + 1
        if self._state.adding and not (self.periodo_inicio and self.periodo_fin):
            # El Superintendente no elige el periodo: se deriva del mes_programa,
            # con meses de 30 días (misma convención que ProgramaConceptoMes.clean()).
            # Usa la fecha real de apertura de bitácora (plan-bitacora.md §7) si ya
            # existe; si el contrato todavía no tiene bitácora abierta, cae al
            # interino contrato.fecha_inicio (plan-estimaciones.md §4.1).
            try:
                inicio_obra = self.contrato.bitacora.fecha_apertura
            except Bitacora.DoesNotExist:
                inicio_obra = self.contrato.fecha_inicio
            self.periodo_inicio = inicio_obra + datetime.timedelta(
                days=(self.mes_programa - 1) * 30
            )
            self.periodo_fin = inicio_obra + datetime.timedelta(days=self.mes_programa * 30 - 1)
        super().save(*args, **kwargs)

    @property
    def subtotal(self):
        return self.conceptos.aggregate(total=models.Sum("importe"))["total"] or Decimal("0")

    @property
    def iva(self):
        return (self.subtotal * self.iva_tasa / Decimal("100")).quantize(Decimal("0.01"))

    @property
    def importe_bruto(self):
        return self.subtotal + self.iva

    @property
    def amortizacion_anticipo(self):
        try:
            anticipo = self.contrato.anticipo
        except Anticipo.DoesNotExist:
            return Decimal("0")
        retencion = self.importe_bruto * anticipo.porcentaje_retencion_por_estimacion / Decimal(
            "100"
        )
        tope = max(Decimal("0"), anticipo.saldo_pendiente)
        return min(retencion, tope).quantize(Decimal("0.01"))

    @property
    def fondo_garantia(self):
        return (self.importe_bruto * self.porcentaje_fondo_garantia / Decimal("100")).quantize(
            Decimal("0.01")
        )

    @property
    def retencion_cinco_al_millar(self):
        return (
            self.importe_bruto * self.porcentaje_cinco_al_millar / Decimal("100")
        ).quantize(Decimal("0.01"))

    @property
    def importe_neto(self):
        neto = (
            self.importe_bruto
            - self.amortizacion_anticipo
            - self.fondo_garantia
            - self.retencion_cinco_al_millar
            - self.penalizaciones
            - self.otras_deducciones
        )
        return max(Decimal("0"), neto)


class EstimacionConcepto(models.Model):
    estimacion = models.ForeignKey(Estimacion, on_delete=models.CASCADE, related_name="conceptos")
    concepto = models.ForeignKey(
        ConceptoCatalogo, on_delete=models.PROTECT, related_name="estimacion_conceptos"
    )
    cantidad_acumulada_anterior = models.DecimalField(
        max_digits=14, decimal_places=3, editable=False
    )
    cantidad_ejecutada = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, editable=False)
    importe = models.DecimalField(max_digits=16, decimal_places=2, editable=False)

    class Meta:
        unique_together = ("estimacion", "concepto")
        ordering = ["concepto__clave"]

    def __str__(self):
        return f"{self.estimacion} — {self.concepto.clave}"

    @classmethod
    def cantidad_acumulada_previa(cls, concepto, estimacion, excluir_id=None):
        """Suma de `cantidad_ejecutada` de estimaciones previas ya aprobadas
        (RN-EST-003) del mismo concepto y contrato, sin contar la propia."""
        qs = cls.objects.filter(
            concepto=concepto,
            estimacion__contrato_id=estimacion.contrato_id,
            estimacion__status__in=Estimacion.ESTADOS_APROBADOS,
        ).exclude(estimacion_id=estimacion.pk)
        if excluir_id:
            qs = qs.exclude(pk=excluir_id)
        return qs.aggregate(total=models.Sum("cantidad_ejecutada"))["total"] or Decimal("0")

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.precio_unitario = self.concepto.precio_unitario
            self.cantidad_acumulada_anterior = self.cantidad_acumulada_previa(
                self.concepto, self.estimacion
            )
        self.importe = (self.cantidad_ejecutada or 0) * (self.precio_unitario or 0)
        super().save(*args, **kwargs)

    @property
    def cantidad_acumulada(self):
        return self.cantidad_acumulada_anterior + self.cantidad_ejecutada

    @property
    def cantidad_pendiente(self):
        return max(Decimal("0"), self.concepto.cantidad_vigente - self.cantidad_acumulada)


class GeneradorElemento(models.Model):
    estimacion_concepto = models.ForeignKey(
        EstimacionConcepto, on_delete=models.CASCADE, related_name="generador"
    )
    elemento = models.CharField(max_length=100)
    cantidad_n = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    largo = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    ancho = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    alto = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    parcial = models.DecimalField(max_digits=14, decimal_places=3, editable=False)
    observaciones = models.TextField(blank=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self):
        return f"{self.estimacion_concepto} — {self.elemento}"

    def save(self, *args, **kwargs):
        # Dimensiones no usadas (conceptos por pieza) cuentan como 1, no como 0.
        largo = self.largo if self.largo is not None else Decimal("1")
        ancho = self.ancho if self.ancho is not None else Decimal("1")
        alto = self.alto if self.alto is not None else Decimal("1")
        self.parcial = (self.cantidad_n or Decimal("1")) * largo * ancho * alto
        super().save(*args, **kwargs)
        self._recalcular_cantidad_ejecutada(self.estimacion_concepto)

    def delete(self, *args, **kwargs):
        estimacion_concepto = self.estimacion_concepto
        super().delete(*args, **kwargs)
        self._recalcular_cantidad_ejecutada(estimacion_concepto)

    @staticmethod
    def _recalcular_cantidad_ejecutada(estimacion_concepto):
        """RN de fase 2: si un concepto tiene filas de generador, la fuente
        de verdad de `cantidad_ejecutada` pasa a ser `Σ parcial`."""
        total = estimacion_concepto.generador.aggregate(total=models.Sum("parcial"))["total"]
        if total is None:
            return
        estimacion_concepto.cantidad_ejecutada = total
        estimacion_concepto.save(update_fields=["cantidad_ejecutada", "importe"])


def evidencia_upload_path(instance, filename):
    concepto = instance.estimacion_concepto
    return (
        f"estimaciones/{concepto.estimacion.contrato_id}/{concepto.estimacion_id}/"
        f"{concepto.concepto.clave}/{filename}"
    )


class EvidenciaFotografica(models.Model):
    class Momento(models.TextChoices):
        ANTES = "antes", "Antes"
        DURANTE = "durante", "Durante"
        DESPUES = "despues", "Después"

    estimacion_concepto = models.ForeignKey(
        EstimacionConcepto, on_delete=models.CASCADE, related_name="evidencias"
    )
    imagen = models.FileField(upload_to=evidencia_upload_path)
    formato = models.CharField(max_length=10, editable=False, blank=True)
    tamano = models.PositiveIntegerField(editable=False, default=0)
    hash_sha256 = models.CharField(max_length=64, editable=False, blank=True)
    momento = models.CharField(max_length=10, choices=Momento.choices, blank=True)
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="evidencias_subidas"
    )
    ip_origen = models.GenericIPAddressField(null=True, blank=True)
    fecha_carga = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Evidencias fotográficas"
        ordering = ["-fecha_carga"]

    def __str__(self):
        return f"{self.estimacion_concepto} — {self.get_momento_display() or 'evidencia'}"

    def save(self, *args, **kwargs):
        if self.imagen:
            name = self.imagen.name
            self.formato = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            self.imagen.seek(0)
            content = self.imagen.read()
            self.tamano = len(content)
            self.hash_sha256 = hashlib.sha256(content).hexdigest()
            self.imagen.seek(0)
        super().save(*args, **kwargs)


class EstimacionEvento(models.Model):
    class Tipo(models.TextChoices):
        PRESENTADA = "presentada", "Presentada"
        APROBADA_RESIDENTE = "aprobada_residente", "Aprobada por Residente"
        RECHAZADA_RESIDENTE = "rechazada_residente", "Rechazada por Residente"
        FIRMADA = "firmada", "Firmada"

    estimacion = models.ForeignKey(Estimacion, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=25, choices=Tipo.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="estimacion_eventos"
    )
    comentario = models.TextField(blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fecha"]

    def __str__(self):
        return f"{self.estimacion} — {self.get_tipo_display()}"


class Firma(models.Model):
    estimacion = models.ForeignKey(Estimacion, on_delete=models.CASCADE, related_name="firmas")
    firmante = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="estimaciones_firmadas"
    )
    rol = models.CharField(max_length=20)
    fecha_firma = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("estimacion", "firmante")
        ordering = ["fecha_firma"]

    def __str__(self):
        return f"{self.estimacion} — {self.firmante} ({self.rol})"
