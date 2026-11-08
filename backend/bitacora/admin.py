from django.contrib import admin

from .models import Bitacora, NotaBitacora


@admin.register(Bitacora)
class BitacoraAdmin(admin.ModelAdmin):
    list_display = ("contrato", "estado", "fecha_apertura", "fecha_cierre")
    list_filter = ("estado",)
    search_fields = ("contrato__no_contrato",)


admin.site.register(NotaBitacora)
