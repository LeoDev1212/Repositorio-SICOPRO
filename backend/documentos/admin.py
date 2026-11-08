from django.contrib import admin

from .models import (
    Anticipo,
    ConceptoCatalogo,
    ContractDocument,
    ConvenioModificatorio,
    ConvenioModificatorioConcepto,
    Garantia,
    ProgramaConceptoMes,
)

admin.site.register(ConceptoCatalogo)
admin.site.register(ProgramaConceptoMes)
admin.site.register(Garantia)
admin.site.register(Anticipo)
admin.site.register(ContractDocument)
admin.site.register(ConvenioModificatorio)
admin.site.register(ConvenioModificatorioConcepto)
