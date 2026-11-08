import datetime
import hashlib
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

from contracts.models import Contract


def _agregar_dias_habiles(fecha_inicio, dias_habiles):
    """Suma días hábiles (lunes a viernes) a una fecha. Sin calendario de
    días festivos oficiales — alcance académico, ver plan-cierre.md §2 (los
    demás plazos del sistema ya usan días naturales; este es el primero en
    días hábiles, RN-CIERRE-005)."""
    fecha = fecha_inicio
    agregados = 0
    while agregados < dias_habiles:
        fecha += datetime.timedelta(days=1)
        if fecha.weekday() < 5:  # 0=lunes … 4=viernes
            agregados += 1
    return fecha


class Suspension(models.Model):
    """Suspensión temporal de los trabajos (Art. 60 LOPSRM) — plan-cierre.md
    §4. Entidad propia con fechas reales (no texto libre): altera el
    cronograma legal del contrato, así que `Contract.plazo_vigente_dias`
    suma `dias_suspendidos` de todas las suspensiones del contrato."""

    class Causal(models.TextChoices):
        INTERES_GENERAL = "interes_general", "Razones de interés general"
        CAUSA_JUSTIFICADA = "causa_justificada", "Causa justificada que impide continuar"
        CASO_FORTUITO = "caso_fortuito", "Caso fortuito o fuerza mayor"

    contrato = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name="suspensiones")
    causal = models.CharField(max_length=20, choices=Causal.choices)
    motivo = models.TextField()
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    # RN-CIERRE-002/plan §4: habilita crear un Cierre tipo terminacion_anticipada
    # que la referencia (Art. 60: "si no es posible determinar la
    # temporalidad, se procede a la terminación anticipada"). Se marca aparte
    # de crearla porque normalmente se descubre después, no al inicio.
    es_indeterminada = models.BooleanField(default=False)
    monto_gastos_no_recuperables = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    registrada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="suspensiones_registradas"
    )
    fecha_registro = models.DateTimeField(auto_now_add=True)
    resuelta_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="suspensiones_resueltas",
    )
    fecha_resolucion = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha_inicio"]

    def __str__(self):
        return f"Suspensión — {self.contrato.no_contrato} ({self.fecha_inicio})"

    @property
    def dias_suspendidos(self):
        fin = self.fecha_fin or datetime.date.today()
        return (fin - self.fecha_inicio).days

    @property
    def activa(self):
        return self.fecha_fin is None


def cierre_upload_path(instance, filename):
    return f"contratos/{instance.contrato_id}/cierre/{filename}"


class Cierre(models.Model):
    """plan-cierre.md §4/§5 — Fase 2: solo se modelan los campos de
    `terminacion_cumplimiento` (los 4 tipos existen en el enum desde ahora,
    mismo criterio que `ConvenioModificatorio.Tipo`, pero los campos
    específicos de rescisión/terminación anticipada/judicial se agregan en
    fases posteriores vía nuevas migraciones, igual que `monto_delta`/
    `dias_delta` se agregaron a Convenios después)."""

    class Tipo(models.TextChoices):
        TERMINACION_CUMPLIMIENTO = "terminacion_cumplimiento", "Terminación por cumplimiento"
        TERMINACION_ANTICIPADA = "terminacion_anticipada", "Terminación anticipada"
        RESCISION_ADMINISTRATIVA = "rescision_administrativa", "Rescisión administrativa"
        RESCISION_JUDICIAL = "rescision_judicial", "Rescisión judicial"

    class Status(models.TextChoices):
        PROPUESTA = "propuesta", "Propuesta"
        EN_PROCESO = "en_proceso", "En proceso"
        FINIQUITADO = "finiquitado", "Finiquitado"
        DESCARTADO = "descartado", "Descartado"

    contrato = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name="cierres")
    tipo = models.CharField(max_length=25, choices=Tipo.choices)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.EN_PROCESO)
    motivo = models.TextField()
    # Solo terminacion_anticipada, cuando nace de una suspensión indeterminada
    # (Art. 60: "si no es posible determinar la temporalidad, se procede a la
    # terminación anticipada") — trazabilidad, no obligatorio: también puede
    # nacer sin suspensión previa (p. ej. interés general directo).
    suspension_origen = models.ForeignKey(
        Suspension,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cierres_terminacion_anticipada",
    )
    iniciado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cierres_iniciados"
    )
    fecha_inicio = models.DateTimeField(auto_now_add=True)
    # Genérico a los 4 tipos: el momento en que el cierre empieza a tener
    # efectos legales (congela el contrato — RN-CIERRE-009, fase 3). Para
    # terminacion_cumplimiento coincide con la creación (su creación ya es
    # el acto formal); en rescisión administrativa (fase 4) es el momento de
    # `notificar_inicio`, distinto de cuándo el Residente la propuso.
    notificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cierres_notificados",
    )
    fecha_notificacion_inicio = models.DateTimeField(null=True, blank=True)

    # --- terminacion_cumplimiento ---
    estimacion_liquidacion = models.ForeignKey(
        "estimaciones.Estimacion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cierres_liquidacion",
    )
    fecha_acta_entrega_recepcion = models.DateField(null=True, blank=True)
    documento_acta_entrega = models.FileField(upload_to=cierre_upload_path, null=True, blank=True)
    acta_entrega_formato = models.CharField(max_length=10, editable=False, blank=True)
    acta_entrega_tamano = models.PositiveIntegerField(editable=False, default=0)
    acta_entrega_hash_sha256 = models.CharField(max_length=64, editable=False, blank=True)

    # --- rescisión administrativa (fecha_notificacion_incumplimiento/alegatos_contratista/
    # fecha_alegatos/se_rescinde/fecha_resolucion) ---
    fecha_notificacion_incumplimiento = models.DateTimeField(null=True, blank=True)
    alegatos_contratista = models.TextField(blank=True)
    fecha_alegatos = models.DateTimeField(null=True, blank=True)
    se_rescinde = models.BooleanField(null=True, blank=True)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    # Compartida entre rescision_administrativa y rescision_judicial.
    documento_acta_circunstanciada = models.FileField(
        upload_to=cierre_upload_path, null=True, blank=True
    )
    acta_circunstanciada_formato = models.CharField(max_length=10, editable=False, blank=True)
    acta_circunstanciada_tamano = models.PositiveIntegerField(editable=False, default=0)
    acta_circunstanciada_hash_sha256 = models.CharField(max_length=64, editable=False, blank=True)

    # --- rescisión judicial: hecho externo (el Tribunal ya resolvió) que
    # Dependencia solo registra — no se modela el litigio (plan-cierre.md §2).
    fecha_resolucion_judicial = models.DateField(null=True, blank=True)
    monto_resolucion_judicial = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )

    # --- balance de finiquito propio (tipos que no usan estimacion_liquidacion:
    # rescision_administrativa, terminacion_anticipada, rescision_judicial) ---
    monto_trabajos_ejecutados = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_penas_convencionales = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_gastos_no_recuperables = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # --- finiquito (común a los 4 tipos) ---
    fecha_finiquito = models.DateTimeField(null=True, blank=True)
    documento_finiquito = models.FileField(upload_to=cierre_upload_path, null=True, blank=True)
    finiquito_formato = models.CharField(max_length=10, editable=False, blank=True)
    finiquito_tamano = models.PositiveIntegerField(editable=False, default=0)
    finiquito_hash_sha256 = models.CharField(max_length=64, editable=False, blank=True)
    finiquitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cierres_finiquitados",
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"Cierre — {self.contrato.no_contrato} ({self.get_tipo_display()})"

    def save(self, *args, **kwargs):
        for campo, prefijo in (
            ("documento_acta_entrega", "acta_entrega"),
            ("documento_acta_circunstanciada", "acta_circunstanciada"),
            ("documento_finiquito", "finiquito"),
        ):
            archivo = getattr(self, campo)
            if archivo:
                name = archivo.name
                setattr(self, f"{prefijo}_formato", name.rsplit(".", 1)[-1].lower() if "." in name else "")
                archivo.seek(0)
                content = archivo.read()
                setattr(self, f"{prefijo}_tamano", len(content))
                setattr(self, f"{prefijo}_hash_sha256", hashlib.sha256(content).hexdigest())
                archivo.seek(0)
        super().save(*args, **kwargs)

    @property
    def fecha_limite_alegatos(self):
        """RN-CIERRE-005: 15 días hábiles desde la notificación de inicio."""
        if self.fecha_notificacion_inicio is None:
            return None
        return _agregar_dias_habiles(self.fecha_notificacion_inicio.date(), 15)

    @property
    def fecha_limite_resolucion_rescision(self):
        """RN-CIERRE-005: 10 días hábiles desde que se capturaron los alegatos."""
        if self.fecha_alegatos is None:
            return None
        return _agregar_dias_habiles(self.fecha_alegatos.date(), 10)

    @property
    def aceptada_tacitamente(self):
        """RN-CIERRE-013 (plan-cierre.md §4): afirmativa ficta — informativa,
        GACM no tiene Celery/cron que dispare nada solo. Pasaron >15 días
        naturales desde que se notificó la solicitud sin que Dependencia
        resolviera (`fecha_resolucion` sigue null)."""
        if self.tipo != self.Tipo.TERMINACION_ANTICIPADA or self.fecha_resolucion is not None:
            return False
        if self.fecha_notificacion_inicio is None:
            return False
        return timezone.now() - self.fecha_notificacion_inicio > datetime.timedelta(days=15)

    @property
    def anticipo_no_amortizado(self):
        try:
            return self.contrato.anticipo.saldo_pendiente
        except ObjectDoesNotExist:
            return Decimal("0")

    @property
    def importe_neto_finiquito(self):
        """RN-CIERRE-011: solo aplica a los tipos que no usan
        `estimacion_liquidacion` (para `terminacion_cumplimiento`, el monto
        a pagar es `estimacion_liquidacion.importe_neto`, ya calculado por
        Estimaciones). Trabajos ejecutados y gastos no recuperables se
        pagan al contratista; anticipo pendiente y penas se descuentan."""
        neto = (
            self.monto_trabajos_ejecutados
            + self.monto_gastos_no_recuperables
            - self.anticipo_no_amortizado
            - self.monto_penas_convencionales
        )
        return max(Decimal("0"), neto)


class CierreEvento(models.Model):
    class Tipo(models.TextChoices):
        PROPUESTO = "propuesto", "Propuesta registrada"
        NOTIFICADO_INICIO = "notificado_inicio", "Inicio notificado"
        INICIADO = "iniciado", "Iniciado"
        ACTA_ENTREGA_RECEPCION = "acta_entrega_recepcion", "Acta de entrega-recepción"
        LIQUIDACION_VINCULADA = "liquidacion_vinculada", "Estimación de liquidación vinculada"
        ALEGATOS_RECIBIDOS = "alegatos_recibidos", "Alegatos recibidos"
        RESOLUCION_RESCISION = "resolucion_rescision", "Resolución de rescisión"
        RESOLUCION_TERMINACION = "resolucion_terminacion", "Resolución de terminación anticipada"
        RESOLUCION_JUDICIAL_REGISTRADA = "resolucion_judicial_registrada", "Resolución judicial registrada"
        ACTA_CIRCUNSTANCIADA = "acta_circunstanciada", "Acta circunstanciada"
        DESCARTADO = "descartado", "Descartado"
        FINIQUITADO = "finiquitado", "Finiquitado"

    cierre = models.ForeignKey(Cierre, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=31, choices=Tipo.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cierre_eventos"
    )
    comentario = models.TextField(blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fecha"]

    def __str__(self):
        return f"{self.cierre} — {self.get_tipo_display()}"
