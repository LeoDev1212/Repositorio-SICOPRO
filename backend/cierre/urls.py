from rest_framework.routers import DefaultRouter

from .views import CierreViewSet, SuspensionViewSet

router = DefaultRouter()
# Prefijo con nombre antes que "" — mismo motivo que estimaciones/bitacora:
# la ruta de detalle de Cierre (^(?P<pk>[^/.]+)/$) matchearía "suspensiones/"
# como si fuera un pk si se registrara después.
router.register("suspensiones", SuspensionViewSet, basename="suspension")
router.register("", CierreViewSet, basename="cierre")

urlpatterns = router.urls
