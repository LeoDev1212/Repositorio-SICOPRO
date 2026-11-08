from django.conf import settings
from django.db import models


class Notificacion(models.Model):
    """Alerta dentro de la plataforma (plan §1) — sin correo ni tiempo real,
    ambos fuera del alcance del scaffold (ver README, roadmap). Generada
    siempre por el sistema en los puntos de disparo del plan §3, nunca
    capturada a mano (RN-NOTIF-001)."""

    class Tipo(models.TextChoices):
        ESTIMACION_APROBADA = "estimacion_aprobada", "Estimación aprobada"
        ESTIMACION_RECHAZADA = "estimacion_rechazada", "Estimación rechazada"
        ESTIMACION_FIRMADA = "estimacion_firmada", "Estimación firmada"
        ESTIMACION_PAGO = "estimacion_pago", "Orden de pago emitida"
        CONVENIO_APROBADO = "convenio_aprobado", "Convenio aprobado"
        CONVENIO_RECHAZADO = "convenio_rechazado", "Convenio rechazado"
        CIERRE_PROPUESTA = "cierre_propuesta", "Propuesta de rescisión registrada"
        CIERRE_INICIADO = "cierre_iniciado", "Inicio de cierre notificado"
        CIERRE_RESOLUCION_RESCISION = "cierre_resolucion_rescision", "Rescisión administrativa resuelta"
        CIERRE_FINIQUITADO = "cierre_finiquitado", "Cierre finiquitado"
        SUSPENSION_REGISTRADA = "suspension_registrada", "Suspensión registrada"
        SUSPENSION_RESUELTA = "suspension_resuelta", "Suspensión resuelta"
        CONTRATISTA_INHABILITADO = "contratista_inhabilitado", "Contratista inhabilitado"

    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notificaciones"
    )
    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    mensaje = models.TextField()
    enlace = models.CharField(max_length=255, blank=True)
    leida = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.destinatario} — {self.get_tipo_display()}"
