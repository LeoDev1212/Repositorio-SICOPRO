from django.contrib import admin

from .models import Cierre, CierreEvento, Suspension


@admin.register(Suspension)
class SuspensionAdmin(admin.ModelAdmin):
    list_display = ("contrato", "causal", "fecha_inicio", "fecha_fin", "es_indeterminada")
    list_filter = ("causal", "es_indeterminada")
    search_fields = ("contrato__no_contrato",)


@admin.register(Cierre)
class CierreAdmin(admin.ModelAdmin):
    list_display = ("contrato", "tipo", "status", "fecha_creacion")
    list_filter = ("tipo", "status")
    search_fields = ("contrato__no_contrato",)


admin.site.register(CierreEvento)
