from rest_framework.routers import DefaultRouter

from .views import (
    AnticipoViewSet,
    ConceptoCatalogoViewSet,
    ContractDocumentViewSet,
    ConvenioModificatorioConceptoViewSet,
    ConvenioModificatorioViewSet,
    GarantiaViewSet,
    ProgramaConceptoMesViewSet,
)

router = DefaultRouter()
router.register("conceptos", ConceptoCatalogoViewSet, basename="concepto")
router.register("programa", ProgramaConceptoMesViewSet, basename="programa")
router.register("garantias", GarantiaViewSet, basename="garantia")
router.register("anticipo", AnticipoViewSet, basename="anticipo")
router.register("archivos", ContractDocumentViewSet, basename="documento")
router.register("convenios", ConvenioModificatorioViewSet, basename="convenio")
router.register(
    "convenio-conceptos", ConvenioModificatorioConceptoViewSet, basename="convenio-concepto"
)

urlpatterns = router.urls
