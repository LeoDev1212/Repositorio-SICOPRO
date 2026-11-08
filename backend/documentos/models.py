import datetime
import hashlib

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from contracts.models import Contract


class ConceptoCatalogo(models.Model):
    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="conceptos")
    clave = models.CharField(max_length=50)
    descripcion = models.CharField(max_length=500)
    unidad = models.CharField(max_length=20)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2)
    importe = models.DecimalField(max_digits=16, decimal_places=2, editable=False)
    no_sujeto_ajuste_costos = models.BooleanField(default=False)

    class Meta:
        unique_together = ("contrato", "clave")
        ordering = ["clave"]

    def __str__(self):
        return f"{self.clave} — {self.descripcion}"

    def clean(self):
        # Corre en el alta manual (ConceptoCatalogoSerializer.validate_*,
        # duplicado ahí a propósito con el mismo mensaje) y en la carga
        # masiva por CSV/XLSX (`bulk_upload`, que llama full_clean()
        # directamente) — sin esto, un CSV con cantidad/precio negativos
        # pasaba sin ningún aviso.
        errores = {}
        if self.cantidad is not None and self.cantidad <= 0:
            errores["cantidad"] = "Debe ser mayor a 0."
        if self.precio_unitario is not None and self.precio_unitario <= 0:
            errores["precio_unitario"] = "Debe ser mayor a 0."
        if errores:
            raise ValidationError(errores)

    @property
    def numero_generador(self):
        return f"{self.contrato.no_contrato}-{self.clave}"

    @property
    def cantidad_vigente(self):
        """Tope real contra el que se valida RN-EST-003: la cantidad
        original más los `cantidad_delta` de convenios modificatorios ya
        aprobados sobre este concepto (RN-CONV-002)."""
        delta = self.convenio_deltas.filter(convenio__status=ConvenioModificatorioStatus.APROBADO).aggregate(
            total=models.Sum("cantidad_delta")
        )["total"]
        return self.cantidad + (delta or 0)

    def save(self, *args, **kwargs):
        self.importe = (self.cantidad or 0) * (self.precio_unitario or 0)
        super().save(*args, **kwargs)


class ProgramaConceptoMes(models.Model):
    concepto = models.ForeignKey(
        ConceptoCatalogo, on_delete=models.CASCADE, related_name="programa_meses"
    )
    mes = models.PositiveIntegerField()
    cantidad_programada = models.DecimalField(max_digits=14, decimal_places=3)

    class Meta:
        unique_together = ("concepto", "mes")
        ordering = ["concepto", "mes"]

    def clean(self):
        contrato = self.concepto.contrato
        meses_totales = max(1, -(-contrato.plazo_dias // 30))
        if self.mes < 1 or self.mes > meses_totales:
            raise ValidationError(
                {"mes": f"El contrato solo tiene {meses_totales} mes(es) de plazo."}
            )


def _default_dias_alerta():
    return [30, 15, 5]


class Garantia(models.Model):
    class Tipo(models.TextChoices):
        CUMPLIMIENTO = "cumplimiento", "Cumplimiento"
        ANTICIPO = "anticipo", "Anticipo"
        VICIOS_OCULTOS = "vicios_ocultos", "Vicios ocultos"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="garantias")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    numero_fianza = models.CharField(max_length=100)
    institucion_afianzadora = models.CharField(max_length=255)
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    porcentaje_cobertura = models.DecimalField(max_digits=5, decimal_places=2)
    fecha_emision = models.DateField()
    fecha_vigencia = models.DateField()
    dias_alerta = models.JSONField(default=_default_dias_alerta)

    class Meta:
        unique_together = ("contrato", "tipo")
        verbose_name_plural = "Garantías"

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.contrato.no_contrato}"

    @property
    def estado(self):
        dias_restantes = (self.fecha_vigencia - datetime.date.today()).days
        if dias_restantes < 0:
            return "vencida"
        umbral_maximo = max(self.dias_alerta) if self.dias_alerta else 0
        if dias_restantes <= umbral_maximo:
            return "por_vencer"
        return "vigente"


class Anticipo(models.Model):
    contrato = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name="anticipo")
    monto_otorgado = models.DecimalField(max_digits=14, decimal_places=2)
    porcentaje_retencion_por_estimacion = models.DecimalField(max_digits=5, decimal_places=2)
    monto_amortizado = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    def __str__(self):
        return f"Anticipo — {self.contrato.no_contrato}"

    @property
    def saldo_pendiente(self):
        return self.monto_otorgado - self.monto_amortizado


def documento_upload_path(instance, filename):
    return f"contratos/{instance.contrato_id}/{instance.bloque}/{filename}"


class ContractDocument(models.Model):
    class Bloque(models.TextChoices):
        CATALOGO = "catalogo", "Catálogo de conceptos"
        PROGRAMA = "programa", "Programa de obra"
        GARANTIAS = "garantias", "Garantías"
        AMORTIZACION = "amortizacion", "Amortización del anticipo"
        JURIDICO = "juridico", "Información jurídica"
        CONTRATO = "contrato", "Contrato digitalizado"

    class Estado(models.TextChoices):
        VIGENTE = "vigente", "Vigente"
        SUSTITUIDO = "sustituido", "Sustituido"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="documentos")
    bloque = models.CharField(max_length=20, choices=Bloque.choices)
    nombre = models.CharField(max_length=255)
    archivo = models.FileField(upload_to=documento_upload_path)
    formato = models.CharField(max_length=10, editable=False, blank=True)
    tamano = models.PositiveIntegerField(editable=False, default=0)
    hash_sha256 = models.CharField(max_length=64, editable=False, blank=True)
    estado = models.CharField(
        max_length=15, choices=Estado.choices, default=Estado.VIGENTE
    )
    version_anterior = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="version_nueva",
    )
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="documentos_subidos"
    )
    ip_origen = models.GenericIPAddressField(null=True, blank=True)
    fecha_carga = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_carga"]

    def __str__(self):
        return f"{self.nombre} ({self.get_bloque_display()})"

    def save(self, *args, **kwargs):
        if self.archivo:
            name = self.archivo.name
            self.formato = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            self.archivo.seek(0)
            content = self.archivo.read()
            self.tamano = len(content)
            self.hash_sha256 = hashlib.sha256(content).hexdigest()
            self.archivo.seek(0)
        super().save(*args, **kwargs)


class ConvenioModificatorioStatus(models.TextChoices):
    BORRADOR = "borrador", "Borrador"
    APROBADO = "aprobado", "Aprobado"
    RECHAZADO = "rechazado", "Rechazado"


def convenio_upload_path(instance, filename):
    return f"contratos/{instance.contrato_id}/convenios/{filename}"


class ConvenioModificatorio(models.Model):
    """Convenio modificatorio de contrato (plan de Estimaciones §2.1).

    Vive en `documentos` y no en `contracts` para no crear un import
    circular: `ConvenioModificatorioConcepto.concepto` apunta a
    `ConceptoCatalogo`, que ya vive aquí y depende de `contracts.Contract`
    (no al revés).
    """

    class Tipo(models.TextChoices):
        AMPLIACION_CANTIDAD = "ampliacion_cantidad", "Ampliación de cantidad"
        AMPLIACION_MONTO = "ampliacion_monto", "Ampliación de monto"
        AMPLIACION_PLAZO = "ampliacion_plazo", "Ampliación de plazo"
        MIXTO = "mixto", "Mixto"

    contrato = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name="convenios")
    numero = models.PositiveIntegerField(editable=False, default=0)
    tipo = models.CharField(max_length=25, choices=Tipo.choices)
    justificacion = models.TextField()
    # RN-CONV-002/RN-CONV-004: solo tienen efecto (y solo se exigen al
    # aprobar) cuando `tipo` incluye ampliación de monto/plazo — pueden
    # ser negativos (reducción). El delta de cantidad por concepto sigue
    # viviendo en ConvenioModificatorioConcepto.cantidad_delta, no aquí.
    monto_delta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    dias_delta = models.IntegerField(default=0)
    documento = models.FileField(upload_to=convenio_upload_path, null=True, blank=True)
    formato = models.CharField(max_length=10, editable=False, blank=True)
    tamano = models.PositiveIntegerField(editable=False, default=0)
    hash_sha256 = models.CharField(max_length=64, editable=False, blank=True)
    status = models.CharField(
        max_length=15,
        choices=ConvenioModificatorioStatus.choices,
        default=ConvenioModificatorioStatus.BORRADOR,
    )
    motivo_rechazo = models.TextField(blank=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="convenios_creados"
    )
    aprobado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="convenios_aprobados",
    )
    fecha_aprobacion = models.DateTimeField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("contrato", "numero")
        ordering = ["contrato", "-numero"]

    def __str__(self):
        return f"{self.contrato.no_contrato} — Convenio {self.numero}"

    def save(self, *args, **kwargs):
        if not self.numero:
            ultimo = ConvenioModificatorio.objects.filter(contrato=self.contrato).aggregate(
                models.Max("numero")
            )["numero__max"]
            self.numero = (ultimo or 0) + 1
        if self.documento:
            name = self.documento.name
            self.formato = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            self.documento.seek(0)
            content = self.documento.read()
            self.tamano = len(content)
            self.hash_sha256 = hashlib.sha256(content).hexdigest()
            self.documento.seek(0)
        super().save(*args, **kwargs)


class ConvenioModificatorioConcepto(models.Model):
    convenio = models.ForeignKey(
        ConvenioModificatorio, on_delete=models.CASCADE, related_name="conceptos"
    )
    concepto = models.ForeignKey(
        ConceptoCatalogo, on_delete=models.PROTECT, related_name="convenio_deltas"
    )
    cantidad_delta = models.DecimalField(max_digits=14, decimal_places=3)

    class Meta:
        unique_together = ("convenio", "concepto")

    def __str__(self):
        return f"{self.convenio} — {self.concepto.clave} ({self.cantidad_delta:+})"

    def clean(self):
        if self.concepto.contrato_id != self.convenio.contrato_id:
            raise ValidationError(
                {"concepto": "El concepto debe pertenecer al mismo contrato del convenio."}
            )
