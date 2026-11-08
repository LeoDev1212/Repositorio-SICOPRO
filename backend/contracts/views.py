from decimal import Decimal

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from documentos.models import Anticipo, ConceptoCatalogo, ContractDocument, Garantia, ProgramaConceptoMes
from estimaciones.models import Estimacion, EstimacionStatus
from users.models import Role
from users.permissions import AssignmentScopedQuerySetMixin, RoleScopedPermission

from .models import Contract, ContractStatus
from .serializers import ContractSerializer


ALL_ROLES = {
    Role.DEPENDENCIA,
    Role.RESIDENTE,
    Role.SUPERINTENDENTE,
    Role.SUPERVISION,
    Role.FINANZAS,
}

# Mismo conjunto que frontend/lib/nav.ts ya declaraba para la ruta
# /seguimiento desde el scaffold original — Superintendente y Finanzas
# quedan fuera.
ROLES_SEGUIMIENTO = {Role.DEPENDENCIA, Role.RESIDENTE, Role.SUPERVISION}


class ContractPermission(RoleScopedPermission):
    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "documentacion": ALL_ROLES,
        "seguimiento": ROLES_SEGUIMIENTO,
        "create": {Role.DEPENDENCIA},
        "update": {Role.DEPENDENCIA},
        "partial_update": {Role.DEPENDENCIA},
        "destroy": {Role.DEPENDENCIA},
        "activar": {Role.DEPENDENCIA},
    }


class ContractViewSet(AssignmentScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Contract.objects.select_related(
        "contratista", "empresa_supervision", "residente", "supervisor", "superintendente"
    )
    serializer_class = ContractSerializer
    permission_classes = [ContractPermission]

    unrestricted_roles = {Role.DEPENDENCIA, Role.FINANZAS}
    assignment_lookups = {
        Role.RESIDENTE: "residente__user",
        Role.SUPERVISION: "supervisor__user",
        Role.SUPERINTENDENTE: "superintendente__user",
    }

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    def _documentacion_resumen(self, contrato):
        bloques = {}
        for bloque_value, bloque_label in ContractDocument.Bloque.choices:
            tiene_documento = ContractDocument.objects.filter(
                contrato=contrato,
                bloque=bloque_value,
                estado=ContractDocument.Estado.VIGENTE,
            ).exists()
            bloques[bloque_value] = {"label": bloque_label, "completo": tiene_documento}

        return {
            "bloques": bloques,
            "catalogo_cargado": ConceptoCatalogo.objects.filter(contrato=contrato).exists(),
            "garantias_registradas": Garantia.objects.filter(contrato=contrato).exists(),
            "anticipo_configurado": Anticipo.objects.filter(contrato=contrato).exists(),
            "documentacion_completa": all(b["completo"] for b in bloques.values()),
        }

    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        contrato = self.get_object()
        if contrato.status != ContractStatus.REGISTRADO:
            return Response(
                {"detail": "Solo un contrato registrado puede activarse."}, status=400
            )
        if not self._documentacion_resumen(contrato)["documentacion_completa"]:
            return Response(
                {
                    "detail": "No se puede activar: faltan documentos por cargar en uno o "
                    "más bloques de documentación."
                },
                status=400,
            )
        contrato.status = ContractStatus.ACTIVO
        contrato.fecha_activacion = timezone.now()
        contrato.save(update_fields=["status", "fecha_activacion"])
        return Response(self.get_serializer(contrato).data)

    @action(detail=True, methods=["get"])
    def documentacion(self, request, pk=None):
        contrato = self.get_object()
        return Response(self._documentacion_resumen(contrato))

    def _seguimiento_resumen(self, contrato):
        """Curva S (programado vs. real) + resumen financiero. Sin app ni
        modelo propio (plan-seguimiento.md §1) — todo se deriva de datos que
        ya existen en `documentos` y `estimaciones`, igual que
        `_documentacion_resumen` ya hacía para su propio resumen."""
        meses_totales = max(1, -(-contrato.plazo_vigente_dias // 30))

        programado_por_mes = {mes: Decimal("0") for mes in range(1, meses_totales + 1)}
        for entrada in ProgramaConceptoMes.objects.filter(
            concepto__contrato=contrato
        ).select_related("concepto"):
            if entrada.mes in programado_por_mes:
                programado_por_mes[entrada.mes] += (
                    entrada.cantidad_programada * entrada.concepto.precio_unitario
                )

        # RN-EST-003 ya define este conjunto como "una cantidad reportada ya
        # cuenta como acumulada" — se reutiliza tal cual para que el avance
        # real no cuente estimaciones que el Residente todavía no valida.
        estimaciones = list(contrato.estimaciones.filter(status__in=Estimacion.ESTADOS_APROBADOS))
        real_por_mes = {mes: Decimal("0") for mes in range(1, meses_totales + 1)}
        for est in estimaciones:
            if est.mes_programa in real_por_mes:
                real_por_mes[est.mes_programa] += est.importe_bruto

        curva_s = []
        acumulado_programado = Decimal("0")
        acumulado_real = Decimal("0")
        for mes in range(1, meses_totales + 1):
            acumulado_programado += programado_por_mes[mes]
            acumulado_real += real_por_mes[mes]
            curva_s.append(
                {
                    "mes": mes,
                    "programado_acumulado": acumulado_programado,
                    "real_acumulado": acumulado_real,
                }
            )

        monto_vigente = contrato.monto_vigente
        monto_ejecutado = sum((est.importe_bruto for est in estimaciones), Decimal("0"))
        avance_financiero_porcentaje = (
            float(monto_ejecutado / monto_vigente * 100) if monto_vigente > 0 else 0.0
        )

        anticipo = getattr(contrato, "anticipo", None)
        conteo_por_estatus = {status: 0 for status, _ in EstimacionStatus.choices}
        for est_status in contrato.estimaciones.values_list("status", flat=True):
            conteo_por_estatus[est_status] = conteo_por_estatus.get(est_status, 0) + 1

        return {
            "meses_totales": meses_totales,
            "mes_actual": contrato.mes_obra_actual or 0,
            "resumen": {
                "monto_vigente": monto_vigente,
                "monto_ejecutado": monto_ejecutado,
                "saldo_por_ejercer": monto_vigente - monto_ejecutado,
                "avance_financiero_porcentaje": round(avance_financiero_porcentaje, 2),
                "anticipo_otorgado": anticipo.monto_otorgado if anticipo else Decimal("0"),
                "anticipo_amortizado": anticipo.monto_amortizado if anticipo else Decimal("0"),
                "anticipo_pendiente": anticipo.saldo_pendiente if anticipo else Decimal("0"),
                "fondo_garantia_acumulado": contrato.fondo_garantia_acumulado,
            },
            "curva_s": curva_s,
            "conteo_por_estatus": conteo_por_estatus,
        }

    @action(detail=True, methods=["get"])
    def seguimiento(self, request, pk=None):
        contrato = self.get_object()
        return Response(self._seguimiento_resumen(contrato))
