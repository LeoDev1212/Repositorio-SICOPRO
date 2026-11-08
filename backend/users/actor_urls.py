from rest_framework.routers import DefaultRouter

from .views import ContratistaViewSet, EmpresaSupervisionViewSet, PersonaViewSet

router = DefaultRouter()
router.register("contratistas", ContratistaViewSet, basename="contratista")
router.register(
    "empresas-supervision", EmpresaSupervisionViewSet, basename="empresa-supervision"
)
router.register("personas", PersonaViewSet, basename="persona")

urlpatterns = router.urls
