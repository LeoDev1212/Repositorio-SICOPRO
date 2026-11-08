import datetime
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from contracts.models import Contract


class BitacoraStatus(models.TextChoices):
    ABIERTA = "abierta", "Abierta"
    CERRADA = "cerrada", "Cerrada"


class Bitacora(models.Model):
    """Una por contrato — crearla es el acto legal de abrirla (plan §3):
    no existe un estado intermedio "sin abrir"."""

    contrato = models.OneToOneField(Contract, on_delete=models.PROTECT, related_name="bitacora")
    estado = models.CharField(
        max_length=10, choices=BitacoraStatus.choices, default=BitacoraStatus.ABIERTA
    )
    fecha_apertura = models.DateField(default=datetime.date.today)
    fecha_cierre = models.DateField(null=True, blank=True)
    abierta_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bitacoras_abiertas"
    )
    cerrada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="bitacoras_cerradas",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Bitácoras"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"Bitácora — {self.contrato.no_contrato}"

    def clean(self):
        if self.fecha_apertura and self.fecha_apertura > datetime.date.today():
            raise ValidationError({"fecha_apertura": "No puede ser una fecha futura."})


class NotaClasificacion(models.TextChoices):
    APERTURA = "apertura", "Apertura"
    AVANCE = "avance", "Avance"
    MODIFICACION = "modificacion", "Modificación"
    INCIDENCIA = "incidencia", "Incidencia"
    CALIDAD = "calidad", "Calidad"
    SEGURIDAD = "seguridad", "Seguridad"
    COMUNICACION = "comunicacion", "Comunicación"
    CIERRE = "cierre", "Cierre"


class NotaBitacora(models.Model):
    """Cuerpo del módulo — campos mínimos del Art. 94 RLOPSRM que no están
    ya cubiertos por otro modelo del sistema (plan §3). Inmutable tras
    crearse (RN-BIT-005): no hay update/partial_update en el ViewSet."""

    bitacora = models.ForeignKey(Bitacora, on_delete=models.CASCADE, related_name="notas")
    numero = models.PositiveIntegerField(editable=False, default=0)
    clasificacion = models.CharField(max_length=15, choices=NotaClasificacion.choices)
    descripcion = models.TextField()
    ubicacion = models.CharField(max_length=255, blank=True)
    causa = models.TextField(blank=True)
    solucion = models.TextField(blank=True)
    prevencion = models.TextField(blank=True)
    consecuencia_economica = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    responsable = models.CharField(max_length=255, blank=True)
    fecha_atencion = models.DateField(null=True, blank=True)
    nota_referencia = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="respuestas"
    )
    # Poblado solo por la nota automática de RN-BIT-009 (Fase 4) cuando una
    # Estimacion se presenta; en Fase 1 siempre queda null.
    estimacion = models.ForeignKey(
        "estimaciones.Estimacion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notas_bitacora",
    )
    # Poblado solo por la nota automática RN-BIT-009-style (plan-cierre.md
    # §3/Fase 7) al notificar el inicio de un Cierre y al finiquitarlo.
    cierre = models.ForeignKey(
        "cierre.Cierre",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notas_bitacora",
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="notas_bitacora"
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("bitacora", "numero")
        ordering = ["bitacora", "numero"]

    def __str__(self):
        return f"{self.bitacora} — Nota {self.numero}"

    def save(self, *args, **kwargs):
        if not self.numero:
            ultimo = NotaBitacora.objects.filter(bitacora=self.bitacora).aggregate(
                models.Max("numero")
            )["numero__max"]
            self.numero = (ultimo or 0) + 1
        super().save(*args, **kwargs)


def adjunto_upload_path(instance, filename):
    nota = instance.nota
    return f"bitacora/{nota.bitacora.contrato_id}/{nota.bitacora_id}/{nota.numero}/{filename}"


