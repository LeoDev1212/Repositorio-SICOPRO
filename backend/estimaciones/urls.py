from rest_framework.routers import DefaultRouter

from .views import (
    EstimacionConceptoViewSet,
    EstimacionViewSet,
    EvidenciaFotograficaViewSet,
    GeneradorElementoViewSet,
)

router = DefaultRouter()
# Cualquier prefijo con nombre debe registrarse antes que "" (prefijo vacío):
# la ruta de detalle de Estimacion (^(?P<pk>[^/.]+)/$) matchea "conceptos/" o
# "generador/" como si fueran un pk, y el router resuelve por orden de
# registro — ver el mismo comentario la primera vez que se topó este bug.
router.register("conceptos", EstimacionConceptoViewSet, basename="estimacion-concepto")
router.register("generador", GeneradorElementoViewSet, basename="generador-elemento")
router.register("evidencias", EvidenciaFotograficaViewSet, basename="evidencia-fotografica")
router.register("", EstimacionViewSet, basename="estimacion")

urlpatterns = router.urls
