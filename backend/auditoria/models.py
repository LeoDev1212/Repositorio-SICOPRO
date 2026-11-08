from django.conf import settings
from django.db import models


class AuditoriaEvento(models.Model):
    """Registro técnico y transversal de quién hizo qué, cuándo y desde
    dónde — complementa (no reemplaza) las tablas de eventos narrativas de
    cada módulo (`EstimacionEvento`, `CierreEvento`, `NotaBitacora`).
    Poblado únicamente por `auditoria.middleware.AuditoriaMiddleware`; sin
    payload de petición/respuesta a propósito (plan-auditoria.md §1) para
    no arriesgarse a guardar datos sensibles como una contraseña temporal."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="eventos_auditoria",
    )
    metodo = models.CharField(max_length=6)
    accion = models.CharField(max_length=50)
    modulo = models.CharField(max_length=50, blank=True)
    recurso = models.CharField(max_length=50, blank=True)
    objeto_id = models.PositiveIntegerField(null=True, blank=True)
    ruta = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField()
    ip = models.GenericIPAddressField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.actor} — {self.metodo} {self.ruta} ({self.status_code})"
