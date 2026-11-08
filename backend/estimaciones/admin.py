from django.contrib import admin

from .models import (
    Estimacion,
    EstimacionConcepto,
    EstimacionEvento,
    EvidenciaFotografica,
    Firma,
    GeneradorElemento,
)


@admin.register(Estimacion)
class EstimacionAdmin(admin.ModelAdmin):
    list_display = ("contrato", "numero", "mes_programa", "status")
    list_filter = ("status",)
    search_fields = ("contrato__no_contrato",)


admin.site.register(EstimacionConcepto)
admin.site.register(GeneradorElemento)
admin.site.register(EvidenciaFotografica)
admin.site.register(EstimacionEvento)
admin.site.register(Firma)
