import datetime
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import models

from users.models import Contratista, EmpresaSupervision, Persona


class ContractStatus(models.TextChoices):
    REGISTRADO = "registrado", "Registrado"
    ACTIVO = "activo", "Activo"
    EN_CIERRE = "en_cierre", "En cierre"
    CERRADO = "cerrado", "Cerrado"


class Contract(models.Model):
    no_contrato = models.CharField(max_length=50, unique=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    objeto = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True)
    plazo_dias = models.PositiveIntegerField()
    fecha_inicio = models.DateField()
    fecha_termino = models.DateField(editable=False)
    ubicacion = models.CharField(max_length=255)
    es_retroactivo = models.BooleanField(
        default=False,
        help_text="Permite fecha_inicio anterior a hoy (contrato formalizado tras iniciar obra).",
    )
    status = models.CharField(
        max_length=20, choices=ContractStatus.choices, default=ContractStatus.REGISTRADO
    )

    contratista = models.ForeignKey(
        Contratista, on_delete=models.PROTECT, related_name="contratos"
    )
    empresa_supervision = models.ForeignKey(
        EmpresaSupervision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="contratos_supervisados",
    )
    residente = models.ForeignKey(
        Persona, on_delete=models.PROTECT, related_name="contratos_como_residente"
    )
    supervisor = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="contratos_como_supervisor",
    )
    superintendente = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="contratos_como_superintendente",
    )
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="contratos_creados"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_activacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return self.no_contrato

    def clean(self):
        if self.fecha_inicio and not self.es_retroactivo:
            if self.fecha_inicio < datetime.date.today():
                raise ValidationError(
                    {
                        "fecha_inicio": "No puede ser anterior a hoy salvo que el contrato "
                        "sea retroactivo."
                    }
                )

    def save(self, *args, **kwargs):
        # `and` sobre estos dos valores trata `plazo_dias=0` como "sin
        # plazo" (0 es falsy) y se saltaba el cálculo, dejando
        # `fecha_termino` en NULL — la constraint NOT NULL de la columna
        # entonces tronaba con un IntegrityError sin manejar (500) en vez
        # de un 400 limpio. `is not None` no tiene ese problema.
        if self.fecha_inicio is not None and self.plazo_dias is not None:
            self.fecha_termino = self.fecha_inicio + datetime.timedelta(days=self.plazo_dias)
        super().save(*args, **kwargs)

    @property
    def fecha_inicio_obra(self):
        """Fecha real de inicio de obra para RN-EST-020/021 (Estimaciones
        plan §4.1): es `Bitacora.fecha_apertura`, no `self.fecha_inicio`
        (que es la fecha contractual, no necesariamente la de campo). No se
        importa el modelo `Bitacora` aquí para evitar un import circular
        (`bitacora.models` ya importa `contracts.models`) — el acceso
        `self.bitacora` funciona vía el descriptor inverso que Django agrega
        automáticamente, sin necesidad de importar la clase. None si el
        contrato todavía no tiene bitácora."""
        try:
            return self.bitacora.fecha_apertura
        except ObjectDoesNotExist:
            return None

    @property
    def mes_obra_actual(self):
        """Meses completos transcurridos desde `fecha_inicio_obra` — None si
        el contrato no tiene bitácora todavía."""
        inicio = self.fecha_inicio_obra
        if inicio is None:
            return None
        dias_transcurridos = (datetime.date.today() - inicio).days
        return max(0, dias_transcurridos // 30)

    def fecha_corte(self, mes):
        """Fecha de corte del mes `mes` (mismo numeración que
        `Estimacion.mes_programa`) — None si el contrato no tiene bitácora."""
        inicio = self.fecha_inicio_obra
        if inicio is None:
            return None
        return inicio + datetime.timedelta(days=mes * 30)

    @property
    def ventana_presentacion_abierta(self):
        """RN-EST-020: True si hoy está estrictamente después de la fecha de
        corte del mes en curso y hasta 6 días naturales después (inclusive).
        False si el contrato no tiene bitácora — sin `fecha_inicio_obra` no
        hay fecha de corte que calcular."""
        mes_actual = self.mes_obra_actual
        if mes_actual is None:
            return False
        corte = self.fecha_corte(mes_actual)
        hoy = datetime.date.today()
        return corte < hoy <= corte + datetime.timedelta(days=6)

    @property
    def monto_vigente(self):
        """Mismo patrón que `ConceptoCatalogo.cantidad_vigente`
        (documentos/models.py): monto original + los `monto_delta` de
        convenios modificatorios ya aprobados (RN-CONV-002). No se importa
        `ConvenioModificatorioStatus` aquí — `documentos` ya importa
        `contracts.models.Contract`, así que la importación inversa crearía
        un ciclo (mismo motivo que `fecha_inicio_obra` de arriba) — se
        compara contra el valor literal `"aprobado"` que ese enum guarda en
        la base de datos."""
        delta = self.convenios.filter(status="aprobado").aggregate(total=models.Sum("monto_delta"))[
            "total"
        ]
        return self.monto + (delta or Decimal("0"))

    @property
    def plazo_vigente_dias(self):
        """Igual patrón que `monto_vigente`, con `dias_delta` de convenios
        aprobados (RN-CONV-002) más los días de todas las suspensiones del
        contrato (RN-CIERRE-012, plan-cierre.md §4) — `Suspension.dias_suspendidos`
        es property de Python (fecha_fin puede ser null = sigue activa), no
        se puede agregar en SQL, así que se suma iterando en vez de con
        `aggregate()`. Sin importar `Suspension` aquí por la misma razón que
        `Bitacora`/`ConvenioModificatorio` arriba (`cierre` ya importa
        `contracts.models.Contract`)."""
        delta = self.convenios.filter(status="aprobado").aggregate(total=models.Sum("dias_delta"))[
            "total"
        ]
        dias_suspendidos = sum((s.dias_suspendidos for s in self.suspensiones.all()), 0)
        return self.plazo_dias + (delta or 0) + dias_suspendidos

    @property
    def fecha_termino_vigente(self):
        return self.fecha_inicio + datetime.timedelta(days=self.plazo_vigente_dias)

    @property
    def fondo_garantia_acumulado(self):
        """RN-EST-016 (plan-estimaciones.md): el fondo de garantía se
        acumula en cada estimación pero no se libera hasta el cierre/
        finiquito — este es el total retenido a la fecha. `fondo_garantia`
        es property de `Estimacion` (no columna), así que no se puede
        agregar en SQL: se suma iterando. Se excluyen `borrador` y
        `rechazada_residente` (literales, mismo motivo que arriba — evitar
        importar `EstimacionStatus` desde `contracts`)."""
        estados_excluidos = {"borrador", "rechazada_residente"}
        return sum(
            (
                e.fondo_garantia
                for e in self.estimaciones.all()
                if e.status not in estados_excluidos
            ),
            Decimal("0"),
        )
