from rest_framework.routers import DefaultRouter

from .views import ContractViewSet

router = DefaultRouter()
router.register("contratos", ContractViewSet, basename="contrato")

urlpatterns = router.urls
