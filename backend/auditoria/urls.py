from rest_framework.routers import DefaultRouter

from .views import AuditoriaEventoViewSet

router = DefaultRouter()
router.register("", AuditoriaEventoViewSet, basename="auditoria-evento")

urlpatterns = router.urls
