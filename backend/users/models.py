import datetime

from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    DEPENDENCIA = "dependencia", "Dependencia"
    RESIDENTE = "residente", "Residente"
    SUPERINTENDENTE = "superintendente", "Superintendente"
    SUPERVISION = "supervision", "Supervisión"
    FINANZAS = "finanzas", "Finanzas"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    initials = models.CharField(max_length=4, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class Contratista(models.Model):
    """Empresa contratista registrada por la Dependencia al asignar un contrato."""

    nombre = models.CharField(max_length=255)
    rfc = models.CharField(max_length=13, help_text="RFC ficticio, alcance académico.")
    representante = models.CharField(max_length=255, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    correo = models.EmailField(blank=True)
    # RN-CIERRE-010 (plan-cierre.md §4/§10): inhabilitación real (no solo
    # informativa) tras la 3ª rescisión administrativa finiquitada con
    # `se_rescinde=True` — se pone automáticamente, ver `cierre/views.py`.
    inhabilitado = models.BooleanField(default=False)
    fecha_fin_inhabilitacion = models.DateField(null=True, blank=True)
    motivo_inhabilitacion = models.TextField(blank=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    @property
    def inhabilitado_vigente(self):
        if not self.inhabilitado:
            return False
        if self.fecha_fin_inhabilitacion is None:
            return True
        return datetime.date.today() <= self.fecha_fin_inhabilitacion


class EmpresaSupervision(models.Model):
    """Empresa que provee al personal de supervisión de un contrato."""

    nombre = models.CharField(max_length=255)
    rfc = models.CharField(max_length=13, help_text="RFC ficticio, alcance académico.")
    representante = models.CharField(max_length=255, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    correo = models.EmailField(blank=True)

    class Meta:
        verbose_name = "Empresa de supervisión"
        verbose_name_plural = "Empresas de supervisión"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Persona(models.Model):
    """
    Persona física ligada a un contrato: superintendente (de un Contratista),
    supervisor (de una EmpresaSupervision) o residente (de la Dependencia).
    A lo más una de las dos FKs de empresa está poblada, según el rol que
    vaya a desempeñar; ninguna de las dos si es residente.
    """

    nombre = models.CharField(max_length=255)
    rfc = models.CharField(max_length=13, help_text="RFC ficticio, alcance académico.")
    telefono = models.CharField(max_length=20, blank=True)
    correo = models.EmailField(blank=True)

    empresa_contratista = models.ForeignKey(
        Contratista,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="superintendentes",
    )
    empresa_supervision = models.ForeignKey(
        EmpresaSupervision,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervisores",
    )
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="persona",
    )

    class Meta:
        verbose_name_plural = "Personas"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre
