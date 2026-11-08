from rest_framework.routers import DefaultRouter

from .views import BitacoraViewSet, NotaBitacoraViewSet

router = DefaultRouter()
# Igual que en estimaciones/urls.py: el prefijo con nombre debe registrarse
# antes que "" (prefijo vacío) — la ruta de detalle de Bitacora
# (^(?P<pk>[^/.]+)/$) matchearía "notas/" como si fuera un pk
# si se registraran después.
router.register("notas", NotaBitacoraViewSet, basename="nota-bitacora")
router.register("", BitacoraViewSet, basename="bitacora")

urlpatterns = router.urls
