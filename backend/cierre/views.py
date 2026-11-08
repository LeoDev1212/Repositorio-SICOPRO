import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from bitacora.models import BitacoraStatus, NotaBitacora, NotaClasificacion
from contracts.models import ContractStatus
from documentos.models import Anticipo
from estimaciones.models import Estimacion, EstimacionStatus
from notificaciones.models import Notificacion
from notificaciones.services import crear_notificaciones
from users.models import Role, User
from users.permissions import AssignmentScopedQuerySetMixin, RoleScopedPermission

from .models import Cierre, CierreEvento, Suspension
from .serializers import CierreEventoSerializer, CierreSerializer, SuspensionSerializer

ALL_ROLES = {Role.DEPENDENCIA, Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION, Role.FINANZAS}
GESTIONAN_SUSPENSION = {Role.RESIDENTE, Role.DEPENDENCIA}


def _personas_contrato(contrato):
    """Users de Residente/Superintendente asignados al contrato (o lista
    vacía si no tienen User vinculado) — se repite en varios puntos de
    disparo de notificaciones de este módulo (plan-cierre.md §8)."""
    destinatarios = []
    if contrato.residente_id and contrato.residente.user_id:
        destinatarios.append(contrato.residente.user)
    if contrato.superintendente_id and contrato.superintendente.user_id:
        destinatarios.append(contrato.superintendente.user)
    return destinatarios


def _nota_bitacora_cierre(contrato, cierre, descripcion, actor):
    """RN-BIT-009-style (plan-cierre.md §3): deja constancia del cierre en
    la bitácora, igual que Estimaciones al presentar. Mismo guard
    defensivo que en estimaciones/views.py: la bitácora no existe hasta
    que hay fecha de inicio de obra."""
    if contrato.fecha_inicio_obra is not None and contrato.bitacora.estado == BitacoraStatus.ABIERTA:
        NotaBitacora.objects.create(
            bitacora=contrato.bitacora,
            clasificacion=NotaClasificacion.CIERRE,
            descripcion=descripcion,
            cierre=cierre,
            autor=actor,
        )


class SuspensionPermission(RoleScopedPermission):
    """RN-CIERRE-012: Residente o Dependencia registran y marcan
    indeterminada; resolver además exige ser quien la registró o
    Dependencia (chequeo a nivel de objeto, ver `resolver()`)."""

    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": GESTIONAN_SUSPENSION,
        "update": GESTIONAN_SUSPENSION,
        "partial_update": GESTIONAN_SUSPENSION,
        "resolver": GESTIONAN_SUSPENSION,
        "marcar_indeterminada": GESTIONAN_SUSPENSION,
    }


class CierrePermission(RoleScopedPermission):
    """RN-CIERRE-002: quién puede crear depende del `tipo` (validado en el
    serializer, aquí solo se listan todos los roles que algún tipo permite).
    Las demás acciones son específicas de un solo rol."""

    action_roles = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": {Role.SUPERINTENDENTE, Role.RESIDENTE, Role.DEPENDENCIA},
        "eventos": ALL_ROLES,
        "acta_entrega": {Role.RESIDENTE, Role.DEPENDENCIA},
        "vincular_liquidacion": {Role.SUPERINTENDENTE},
        "notificar_inicio": {Role.DEPENDENCIA},
        "descartar": {Role.DEPENDENCIA},
        "alegatos": {Role.SUPERINTENDENTE},
        "resolver_rescision": {Role.DEPENDENCIA},
        "acta_circunstanciada": {Role.RESIDENTE, Role.DEPENDENCIA},
        "aceptar": {Role.DEPENDENCIA},
        "rechazar": {Role.DEPENDENCIA},
        "finiquitar": {Role.DEPENDENCIA},
    }


class ContratoScopedMixin(AssignmentScopedQuerySetMixin):
    """Mismo patrón que en `estimaciones`/`bitacora`."""

    unrestricted_roles = {Role.DEPENDENCIA}
    contrato_lookup_prefix = "contrato"

    @property
    def assignment_lookups(self):
        prefix = self.contrato_lookup_prefix
        return {
            Role.RESIDENTE: f"{prefix}__residente__user",
            Role.SUPERVISION: f"{prefix}__supervisor__user",
            Role.SUPERINTENDENTE: f"{prefix}__superintendente__user",
        }

    def get_queryset(self):
        qs = super().get_queryset()
        contrato_id = self.request.query_params.get("contrato")
        if contrato_id:
            qs = qs.filter(**{f"{self.contrato_lookup_prefix}_id": contrato_id})
        return qs


class SuspensionViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = Suspension.objects.select_related("contrato", "registrada_por", "resuelta_por")
    serializer_class = SuspensionSerializer
    permission_classes = [SuspensionPermission]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_create(self, serializer):
        suspension = serializer.save(registrada_por=self.request.user)
        crear_notificaciones(
            _personas_contrato(suspension.contrato)
            + list(User.objects.filter(role=Role.DEPENDENCIA)),
            Notificacion.Tipo.SUSPENSION_REGISTRADA,
            f"Suspensión registrada para {suspension.contrato.no_contrato} "
            f"({suspension.get_causal_display()}).",
            enlace=f"/cierre?contrato={suspension.contrato_id}",
        )

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        suspension = self.get_object()
        if not suspension.activa:
            return Response({"detail": "Esta suspensión ya fue resuelta."}, status=400)
        if request.user.role != Role.DEPENDENCIA and request.user.id != suspension.registrada_por_id:
            return Response(
                {"detail": "Solo quien la registró o Dependencia puede resolverla (RN-CIERRE-012)."},
                status=403,
            )
        fecha_fin_raw = request.data.get("fecha_fin")
        if not fecha_fin_raw:
            return Response({"fecha_fin": "Requerida."}, status=400)
        try:
            fecha_fin = datetime.date.fromisoformat(fecha_fin_raw)
        except ValueError:
            return Response({"fecha_fin": "Formato inválido, usa AAAA-MM-DD."}, status=400)
        if fecha_fin < suspension.fecha_inicio:
            return Response({"fecha_fin": "No puede ser anterior a la fecha de inicio."}, status=400)

        suspension.fecha_fin = fecha_fin
        suspension.resuelta_por = request.user
        suspension.fecha_resolucion = timezone.now()
        suspension.save(update_fields=["fecha_fin", "resuelta_por", "fecha_resolucion"])
        crear_notificaciones(
            _personas_contrato(suspension.contrato)
            + list(User.objects.filter(role=Role.DEPENDENCIA)),
            Notificacion.Tipo.SUSPENSION_RESUELTA,
            f"Suspensión de {suspension.contrato.no_contrato} resuelta — trabajos reanudados.",
            enlace=f"/cierre?contrato={suspension.contrato_id}",
        )
        return Response(self.get_serializer(suspension).data)

    @action(detail=True, methods=["post"])
    def marcar_indeterminada(self, request, pk=None):
        suspension = self.get_object()
        if not suspension.activa:
            return Response(
                {"detail": "Solo se puede marcar mientras la suspensión sigue activa."}, status=400
            )
        suspension.es_indeterminada = True
        suspension.save(update_fields=["es_indeterminada"])
        return Response(self.get_serializer(suspension).data)


class CierreViewSet(ContratoScopedMixin, viewsets.ModelViewSet):
    queryset = Cierre.objects.select_related("contrato", "iniciado_por", "estimacion_liquidacion")
    serializer_class = CierreSerializer
    permission_classes = [CierrePermission]
    http_method_names = ["get", "post", "head", "options"]

    @transaction.atomic
    def perform_create(self, serializer):
        # plan-cierre.md §5: rescision_administrativa creada por Residente
        # nace en `propuesta` — todavía no tiene efectos legales, el
        # contrato sigue activo, nada se congela (RN-CIERRE-001). Los demás
        # casos (terminacion_cumplimiento siempre; rescision_administrativa
        # creada directo por Dependencia) nacen en `en_proceso`: su creación
        # ya es el acto formal.
        tipo = serializer.validated_data["tipo"]
        if tipo == Cierre.Tipo.RESCISION_ADMINISTRATIVA and self.request.user.role == Role.RESIDENTE:
            cierre = serializer.save(status=Cierre.Status.PROPUESTA, iniciado_por=self.request.user)
            CierreEvento.objects.create(
                cierre=cierre, tipo=CierreEvento.Tipo.PROPUESTO, actor=self.request.user
            )
            crear_notificaciones(
                User.objects.filter(role=Role.DEPENDENCIA),
                Notificacion.Tipo.CIERRE_PROPUESTA,
                f"Propuesta de rescisión administrativa registrada para {cierre.contrato.no_contrato}.",
                enlace=f"/cierre/{cierre.id}",
            )
            return

        ahora = timezone.now()
        cierre = serializer.save(
            status=Cierre.Status.EN_PROCESO,
            iniciado_por=self.request.user,
            notificado_por=self.request.user,
            fecha_notificacion_inicio=ahora,
        )
        if tipo == Cierre.Tipo.RESCISION_ADMINISTRATIVA:
            cierre.fecha_notificacion_incumplimiento = ahora
            cierre.save(update_fields=["fecha_notificacion_incumplimiento"])

        contrato = cierre.contrato
        contrato.status = ContractStatus.EN_CIERRE
        contrato.save(update_fields=["status"])
        # rescision_judicial: la creación misma registra un hecho ya resuelto
        # (el Tribunal ya decidió), no un "inicio" — evento distinto para que
        # el historial lo describa con precisión.
        evento_tipo = (
            CierreEvento.Tipo.RESOLUCION_JUDICIAL_REGISTRADA
            if tipo == Cierre.Tipo.RESCISION_JUDICIAL
            else CierreEvento.Tipo.INICIADO
        )
        CierreEvento.objects.create(cierre=cierre, tipo=evento_tipo, actor=self.request.user)

        _nota_bitacora_cierre(
            contrato,
            cierre,
            f"Inicio de {cierre.get_tipo_display().lower()} notificado — el contrato queda en "
            "proceso de cierre.",
            self.request.user,
        )
        destinatarios = _personas_contrato(contrato)
        if self.request.user.role != Role.DEPENDENCIA:
            destinatarios += list(User.objects.filter(role=Role.DEPENDENCIA))
        crear_notificaciones(
            destinatarios,
            Notificacion.Tipo.CIERRE_INICIADO,
            f"Inicio de {cierre.get_tipo_display().lower()} notificado para "
            f"{contrato.no_contrato}.",
            enlace=f"/cierre/{cierre.id}",
        )

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def notificar_inicio(self, request, pk=None):
        """RN-CIERRE-001: Dependencia formaliza una propuesta de rescisión
        administrativa — es aquí, no al crearla, donde el contrato se
        congela (RN-CIERRE-009)."""
        cierre = self.get_object()
        if cierre.status != Cierre.Status.PROPUESTA:
            return Response(
                {"detail": "Solo se puede notificar el inicio de una propuesta."}, status=400
            )
        ahora = timezone.now()
        cierre.status = Cierre.Status.EN_PROCESO
        cierre.notificado_por = request.user
        cierre.fecha_notificacion_inicio = ahora
        cierre.fecha_notificacion_incumplimiento = ahora
        cierre.save(
            update_fields=[
                "status",
                "notificado_por",
                "fecha_notificacion_inicio",
                "fecha_notificacion_incumplimiento",
            ]
        )

        contrato = cierre.contrato
        contrato.status = ContractStatus.EN_CIERRE
        contrato.save(update_fields=["status"])

        CierreEvento.objects.create(
            cierre=cierre, tipo=CierreEvento.Tipo.NOTIFICADO_INICIO, actor=request.user
        )

        _nota_bitacora_cierre(
            contrato,
            cierre,
            "Inicio de rescisión administrativa notificado — el contrato queda en proceso de "
            "cierre.",
            request.user,
        )
        crear_notificaciones(
            _personas_contrato(contrato),
            Notificacion.Tipo.CIERRE_INICIADO,
            f"Inicio de rescisión administrativa notificado para {contrato.no_contrato}.",
            enlace=f"/cierre/{cierre.id}",
        )
        return Response(self.get_serializer(cierre).data)

    @action(detail=True, methods=["post"])
    def descartar(self, request, pk=None):
        """Dependencia decide no formalizar una propuesta todavía no
        notificada — el contrato nunca llegó a congelarse, así que no hay
        nada que revertir en él."""
        cierre = self.get_object()
        if cierre.status != Cierre.Status.PROPUESTA:
            return Response(
                {
                    "detail": "Solo se puede descartar una propuesta todavía no notificada — "
                    "una rescisión ya notificada se resuelve con `resolver_rescision`."
                },
                status=400,
            )
        cierre.status = Cierre.Status.DESCARTADO
        cierre.save(update_fields=["status"])
        CierreEvento.objects.create(
            cierre=cierre,
            tipo=CierreEvento.Tipo.DESCARTADO,
            actor=request.user,
            comentario=request.data.get("comentario", ""),
        )
        return Response(self.get_serializer(cierre).data)

    @action(detail=True, methods=["post"])
    def alegatos(self, request, pk=None):
        cierre = self.get_object()
        if cierre.tipo != Cierre.Tipo.RESCISION_ADMINISTRATIVA:
            return Response({"detail": "Solo aplica a rescisión administrativa."}, status=400)
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        if cierre.fecha_resolucion is not None:
            return Response({"detail": "Ya se resolvió — no se pueden capturar alegatos."}, status=400)
        if cierre.fecha_alegatos is not None:
            return Response({"detail": "Ya se capturaron los alegatos (RN-CIERRE-005)."}, status=400)
        alegatos = (request.data.get("alegatos") or "").strip()
        if not alegatos:
            return Response({"alegatos": "Requerido."}, status=400)

        cierre.alegatos_contratista = alegatos
        cierre.fecha_alegatos = timezone.now()
        cierre.save(update_fields=["alegatos_contratista", "fecha_alegatos"])
        CierreEvento.objects.create(
            cierre=cierre, tipo=CierreEvento.Tipo.ALEGATOS_RECIBIDOS, actor=request.user
        )
        return Response(self.get_serializer(cierre).data)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def resolver_rescision(self, request, pk=None):
        cierre = self.get_object()
        if cierre.tipo != Cierre.Tipo.RESCISION_ADMINISTRATIVA:
            return Response({"detail": "Solo aplica a rescisión administrativa."}, status=400)
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        if cierre.fecha_resolucion is not None:
            return Response({"detail": "Ya se resolvió."}, status=400)
        # RN-CIERRE-005: exige alegatos ya capturados, o que haya vencido su
        # plazo sin que el Superintendente los presentara.
        if cierre.fecha_alegatos is None:
            limite = cierre.fecha_limite_alegatos
            if limite is None or datetime.date.today() <= limite:
                return Response(
                    {
                        "detail": "Todavía no se puede resolver: faltan los alegatos o no ha "
                        "vencido su plazo (RN-CIERRE-005)."
                    },
                    status=400,
                )
        se_rescinde_raw = request.data.get("se_rescinde")
        if se_rescinde_raw is None:
            return Response({"se_rescinde": "Requerido (true/false)."}, status=400)
        se_rescinde = str(se_rescinde_raw).lower() in ("true", "1")
        comentario = request.data.get("comentario", "")

        cierre.se_rescinde = se_rescinde
        cierre.fecha_resolucion = timezone.now()
        cierre.save(update_fields=["se_rescinde", "fecha_resolucion"])
        CierreEvento.objects.create(
            cierre=cierre,
            tipo=CierreEvento.Tipo.RESOLUCION_RESCISION,
            actor=request.user,
            comentario=comentario,
        )

        if not se_rescinde:
            # RN-CIERRE-006: no procede — descartado, el contrato regresa a activo.
            cierre.status = Cierre.Status.DESCARTADO
            cierre.save(update_fields=["status"])
            contrato = cierre.contrato
            contrato.status = ContractStatus.ACTIVO
            contrato.save(update_fields=["status"])
            CierreEvento.objects.create(
                cierre=cierre, tipo=CierreEvento.Tipo.DESCARTADO, actor=request.user
            )

        crear_notificaciones(
            _personas_contrato(cierre.contrato),
            Notificacion.Tipo.CIERRE_RESOLUCION_RESCISION,
            f"Rescisión administrativa de {cierre.contrato.no_contrato} resuelta: "
            f"{'se rescinde' if se_rescinde else 'no procede'}.",
            enlace=f"/cierre/{cierre.id}",
        )
        return Response(self.get_serializer(cierre).data)

    @action(detail=True, methods=["post"])
    def acta_circunstanciada(self, request, pk=None):
        cierre = self.get_object()
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        if cierre.tipo == Cierre.Tipo.RESCISION_ADMINISTRATIVA and cierre.se_rescinde is not True:
            return Response(
                {"detail": "Solo aplica una vez que la rescisión se resolvió afirmativamente."},
                status=400,
            )
        documento = request.FILES.get("documento")
        if not documento:
            return Response({"detail": "Se requiere el documento."}, status=400)

        cierre.documento_acta_circunstanciada = documento
        cierre.save()
        CierreEvento.objects.create(
            cierre=cierre, tipo=CierreEvento.Tipo.ACTA_CIRCUNSTANCIADA, actor=request.user
        )
        return Response(self.get_serializer(cierre).data)

    @action(detail=True, methods=["post"])
    def aceptar(self, request, pk=None):
        """RN-CIERRE-013: Dependencia formaliza la aceptación de una
        terminación anticipada antes de que opere la afirmativa ficta —
        no cambia el `status` (sigue `en_proceso`), solo deja constancia
        explícita para no depender de la propiedad informativa."""
        cierre = self.get_object()
        if cierre.tipo != Cierre.Tipo.TERMINACION_ANTICIPADA:
            return Response({"detail": "Solo aplica a terminación anticipada."}, status=400)
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        if cierre.fecha_resolucion is not None:
            return Response({"detail": "Ya se resolvió."}, status=400)

        cierre.se_rescinde = True
        cierre.fecha_resolucion = timezone.now()
        cierre.save(update_fields=["se_rescinde", "fecha_resolucion"])
        CierreEvento.objects.create(
            cierre=cierre,
            tipo=CierreEvento.Tipo.RESOLUCION_TERMINACION,
            actor=request.user,
            comentario=request.data.get("comentario", ""),
        )
        return Response(self.get_serializer(cierre).data)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        """RN-CIERRE-013: Dependencia rechaza la solicitud de terminación
        anticipada dentro de los 15 días naturales — después de ese plazo
        opera la afirmativa ficta y ya no se puede rechazar."""
        cierre = self.get_object()
        if cierre.tipo != Cierre.Tipo.TERMINACION_ANTICIPADA:
            return Response({"detail": "Solo aplica a terminación anticipada."}, status=400)
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        if cierre.fecha_resolucion is not None:
            return Response({"detail": "Ya se resolvió."}, status=400)
        if cierre.aceptada_tacitamente:
            return Response(
                {
                    "detail": "Vencieron los 15 días naturales — ya no se puede rechazar "
                    "(afirmativa ficta)."
                },
                status=400,
            )

        cierre.se_rescinde = False
        cierre.fecha_resolucion = timezone.now()
        cierre.status = Cierre.Status.DESCARTADO
        cierre.save(update_fields=["se_rescinde", "fecha_resolucion", "status"])
        CierreEvento.objects.create(
            cierre=cierre,
            tipo=CierreEvento.Tipo.RESOLUCION_TERMINACION,
            actor=request.user,
            comentario=request.data.get("comentario", ""),
        )
        contrato = cierre.contrato
        contrato.status = ContractStatus.ACTIVO
        contrato.save(update_fields=["status"])
        CierreEvento.objects.create(
            cierre=cierre, tipo=CierreEvento.Tipo.DESCARTADO, actor=request.user
        )
        return Response(self.get_serializer(cierre).data)

    @action(detail=True, methods=["get"])
    def eventos(self, request, pk=None):
        cierre = self.get_object()
        serializer = CierreEventoSerializer(cierre.eventos.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def acta_entrega(self, request, pk=None):
        cierre = self.get_object()
        if cierre.tipo != Cierre.Tipo.TERMINACION_CUMPLIMIENTO:
            return Response(
                {"detail": "El acta de entrega-recepción solo aplica a terminación por cumplimiento."},
                status=400,
            )
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        documento = request.FILES.get("documento")
        fecha_raw = request.data.get("fecha_acta_entrega_recepcion")
        if not documento or not fecha_raw:
            return Response({"detail": "Se requiere fecha y documento."}, status=400)
        try:
            fecha = datetime.date.fromisoformat(fecha_raw)
        except ValueError:
            return Response({"fecha_acta_entrega_recepcion": "Formato inválido."}, status=400)

        cierre.fecha_acta_entrega_recepcion = fecha
        cierre.documento_acta_entrega = documento
        cierre.save()
        CierreEvento.objects.create(
            cierre=cierre, tipo=CierreEvento.Tipo.ACTA_ENTREGA_RECEPCION, actor=request.user
        )
        return Response(self.get_serializer(cierre).data)

    @action(detail=True, methods=["post"])
    def vincular_liquidacion(self, request, pk=None):
        cierre = self.get_object()
        if cierre.tipo != Cierre.Tipo.TERMINACION_CUMPLIMIENTO:
            return Response(
                {"detail": "La estimación de liquidación solo aplica a terminación por cumplimiento."},
                status=400,
            )
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "El cierre no está en proceso."}, status=400)
        estimacion_id = request.data.get("estimacion")
        try:
            estimacion = Estimacion.objects.get(pk=estimacion_id, contrato_id=cierre.contrato_id)
        except (Estimacion.DoesNotExist, ValueError, TypeError):
            return Response(
                {"estimacion": "No existe o no pertenece a este contrato."}, status=400
            )

        cierre.estimacion_liquidacion = estimacion
        cierre.save(update_fields=["estimacion_liquidacion"])
        CierreEvento.objects.create(
            cierre=cierre,
            tipo=CierreEvento.Tipo.LIQUIDACION_VINCULADA,
            actor=request.user,
            comentario=f"Estimación {estimacion.numero}",
        )
        return Response(self.get_serializer(cierre).data)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def finiquitar(self, request, pk=None):
        cierre = self.get_object()
        if cierre.status != Cierre.Status.EN_PROCESO:
            return Response({"detail": "Solo se puede finiquitar un cierre en proceso."}, status=400)

        if cierre.tipo == Cierre.Tipo.TERMINACION_CUMPLIMIENTO:
            # RN-CIERRE-008: sin saldos pendientes antes de firmar el finiquito.
            if cierre.estimacion_liquidacion is None or cierre.estimacion_liquidacion.status != (
                EstimacionStatus.FIRMADA
            ):
                return Response(
                    {
                        "detail": "La estimación de liquidación debe estar firmada "
                        "(RN-CIERRE-008)."
                    },
                    status=400,
                )
            pendientes = Estimacion.objects.filter(
                contrato_id=cierre.contrato_id,
                status__in=[EstimacionStatus.BORRADOR, EstimacionStatus.EN_REVISION_RESIDENTE],
            ).exclude(pk=cierre.estimacion_liquidacion_id)
            if pendientes.exists():
                return Response(
                    {"detail": "Hay otras estimaciones sin resolver en el contrato (RN-CIERRE-008)."},
                    status=400,
                )
            try:
                saldo = cierre.contrato.anticipo.saldo_pendiente
            except Anticipo.DoesNotExist:
                saldo = Decimal("0")
            if saldo != 0:
                return Response(
                    {"detail": "El anticipo tiene saldo pendiente de amortizar (RN-CIERRE-008)."},
                    status=400,
                )
        else:
            # RN-CIERRE-006/008/011: los tipos que no usan estimacion_liquidacion
            # capturan su propio balance de finiquito aquí mismo, junto con el
            # documento — no hay una acción dedicada solo para los montos.
            if cierre.tipo == Cierre.Tipo.RESCISION_ADMINISTRATIVA:
                if cierre.se_rescinde is not True:
                    return Response(
                        {
                            "detail": "La rescisión debe resolverse afirmativamente antes de "
                            "finiquitar (RN-CIERRE-006)."
                        },
                        status=400,
                    )
                if not cierre.documento_acta_circunstanciada:
                    return Response(
                        {"detail": "Falta el acta circunstanciada (RN-CIERRE-006)."}, status=400
                    )
            elif cierre.tipo == Cierre.Tipo.RESCISION_JUDICIAL:
                if not cierre.documento_acta_circunstanciada:
                    return Response(
                        {"detail": "Falta el acta circunstanciada (RN-CIERRE-006)."}, status=400
                    )

            monto_trabajos_raw = request.data.get("monto_trabajos_ejecutados")
            if monto_trabajos_raw is None:
                return Response(
                    {"monto_trabajos_ejecutados": "Requerido (RN-CIERRE-008)."}, status=400
                )
            try:
                monto_trabajos = Decimal(str(monto_trabajos_raw))
            except InvalidOperation:
                return Response(
                    {"monto_trabajos_ejecutados": "Debe ser un número."}, status=400
                )
            if monto_trabajos <= 0:
                return Response(
                    {"monto_trabajos_ejecutados": "Debe ser mayor a 0 (RN-CIERRE-008)."}, status=400
                )

            def _decimal_opcional(campo):
                raw = request.data.get(campo)
                if raw in (None, ""):
                    return Decimal("0")
                try:
                    return Decimal(str(raw))
                except InvalidOperation:
                    return Decimal("0")

            cierre.monto_trabajos_ejecutados = monto_trabajos
            cierre.monto_penas_convencionales = _decimal_opcional("monto_penas_convencionales")
            cierre.monto_gastos_no_recuperables = _decimal_opcional("monto_gastos_no_recuperables")

        documento = request.FILES.get("documento")
        if not documento:
            return Response({"detail": "Se requiere el documento de finiquito."}, status=400)

        cierre.documento_finiquito = documento
        cierre.fecha_finiquito = timezone.now()
        cierre.finiquitado_por = request.user
        cierre.status = Cierre.Status.FINIQUITADO
        cierre.save()

        contrato = cierre.contrato
        contrato.status = ContractStatus.CERRADO
        contrato.save(update_fields=["status"])

        CierreEvento.objects.create(
            cierre=cierre, tipo=CierreEvento.Tipo.FINIQUITADO, actor=request.user
        )

        _nota_bitacora_cierre(
            contrato,
            cierre,
            f"Cierre finiquitado ({cierre.get_tipo_display()}) — el contrato queda cerrado.",
            request.user,
        )
        crear_notificaciones(
            _personas_contrato(contrato)
            + list(User.objects.filter(role__in=[Role.DEPENDENCIA, Role.FINANZAS])),
            Notificacion.Tipo.CIERRE_FINIQUITADO,
            f"Cierre de {contrato.no_contrato} finiquitado ({cierre.get_tipo_display()}).",
            enlace=f"/cierre/{cierre.id}",
        )

        # RN-CIERRE-010: inhabilitación real (no solo informativa) en la 3ª
        # rescisión administrativa finiquitada afirmativamente del mismo
        # Contratista, contando todos sus contratos en GACM.
        if cierre.tipo == Cierre.Tipo.RESCISION_ADMINISTRATIVA and cierre.se_rescinde:
            contratista = contrato.contratista
            total_rescisiones = Cierre.objects.filter(
                contrato__contratista=contratista,
                tipo=Cierre.Tipo.RESCISION_ADMINISTRATIVA,
                status=Cierre.Status.FINIQUITADO,
                se_rescinde=True,
            ).count()
            if total_rescisiones >= 3:
                contratista.inhabilitado = True
                contratista.fecha_fin_inhabilitacion = timezone.localdate() + datetime.timedelta(
                    days=730
                )
                contratista.motivo_inhabilitacion = (
                    f"3ª rescisión administrativa finiquitada (contrato {contrato.no_contrato})."
                )
                contratista.save(
                    update_fields=[
                        "inhabilitado",
                        "fecha_fin_inhabilitacion",
                        "motivo_inhabilitacion",
                    ]
                )
                crear_notificaciones(
                    User.objects.filter(role=Role.DEPENDENCIA),
                    Notificacion.Tipo.CONTRATISTA_INHABILITADO,
                    f"{contratista.nombre} quedó inhabilitado hasta "
                    f"{contratista.fecha_fin_inhabilitacion.isoformat()} tras su 3ª rescisión "
                    "administrativa finiquitada (RN-CIERRE-010).",
                )

        return Response(self.get_serializer(cierre).data)
