from django.contrib import admin

from .models import Contract


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("no_contrato", "objeto", "status", "contratista", "residente")
    list_filter = ("status",)
    search_fields = ("no_contrato", "objeto")
