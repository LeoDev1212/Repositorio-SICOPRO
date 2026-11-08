import logging

from .models import AuditoriaEvento

logger = logging.getLogger(__name__)

METODOS_AUDITABLES = {"POST", "PUT", "PATCH", "DELETE"}


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditoriaMiddleware:
    """Registra toda mutación (POST/PUT/PATCH/DELETE) bajo `/api/` hecha
    por un usuario autenticado, exitosa o no (plan-auditoria.md §1.2).

    A diferencia del `AuditoriaMiddleware` del proyecto de referencia
    externo (`Sistema_de_contratos/backend/common/middleware.py`), no
    parsea el path a mano para adivinar módulo/acción/objeto_id — usa
    `request.resolver_match`, que Django ya calculó, así que funciona
    igual sin importar la profundidad del path (rutas anidadas como
    `/api/bitacora/notas/7/` no rompen nada) y sin asumir ningún formato
    de pk (la referencia asumía UUIDs de 36 caracteres; GACM usa enteros)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._registrar(request, response)
        except Exception:
            # A diferencia de la referencia (`except Exception: pass`),
            # el fallo queda visible en los logs — la auditoría nunca debe
            # poder tumbar la petición real, pero tampoco quedarse ciega
            # en silencio para siempre.
            logger.exception("No se pudo registrar el evento de auditoría")
        return response

    @staticmethod
    def _resolver_modelo(viewset_cls, accion):
        """Encuentra el modelo de dominio detrás de un ViewSet, sin asumir
        cuál de las dos formas habituales de DRF se usó para declararlo —
        ambas existen en este proyecto:

        1. `queryset = Modelo.objects...` como atributo de clase (la mayoría
           de los ViewSets, incluido `EstimacionViewSet`).
        2. `serializer_class = ModeloSerializer` como atributo de clase, sin
           `queryset` estático — solo `get_queryset()` (`NotificacionViewSet`,
           `ContratistaViewSet`, `EmpresaSupervisionViewSet`).

        `PersonaViewSet` no tiene NINGUNO de los dos como atributo estático
        (decide el serializer en `get_serializer_class()` según la acción,
        `PersonaWriteSerializer` para crear) — para ese caso, y cualquier
        otro igual de dinámico, se instancia el ViewSet y se llama al
        método real, con `self.action` puesto a mano (lo único que esos
        métodos necesitan) para no reimplementar su lógica aquí."""
        if viewset_cls is None:
            return None

        queryset = getattr(viewset_cls, "queryset", None)
        if queryset is not None:
            return queryset.model

        serializer_cls = getattr(viewset_cls, "serializer_class", None)
        modelo = getattr(getattr(serializer_cls, "Meta", None), "model", None)
        if modelo is not None:
            return modelo

        try:
            instancia = viewset_cls()
            instancia.action = accion
            serializer_cls = instancia.get_serializer_class()
        except Exception:
            return None
        return getattr(getattr(serializer_cls, "Meta", None), "model", None)

    def _registrar(self, request, response):
        if request.method not in METODOS_AUDITABLES:
            return
        if not request.path.startswith("/api/"):
            return
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return

        match = request.resolver_match
        if match is None:
            return

        viewset_cls = getattr(match.func, "cls", None)
        actions = getattr(match.func, "actions", None) or {}
        accion = actions.get(request.method.lower(), request.method)
        modelo = self._resolver_modelo(viewset_cls, accion)
        if modelo is None:
            # Vistas planas (login/logout/refresh/csrf) no son un
            # ModelViewSet — no hay un recurso de dominio que auditar aquí.
            return

        AuditoriaEvento.objects.create(
            actor=user,
            metodo=request.method,
            accion=accion,
            modulo=modelo._meta.app_label,
            recurso=modelo._meta.model_name,
            objeto_id=match.kwargs.get("pk"),
            ruta=request.path,
            status_code=response.status_code,
            ip=_client_ip(request),
        )
