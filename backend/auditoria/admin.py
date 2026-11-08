from django.contrib import admin

from .models import AuditoriaEvento


@admin.register(AuditoriaEvento)
class AuditoriaEventoAdmin(admin.ModelAdmin):
    list_display = ("fecha", "actor", "metodo", "accion", "modulo", "recurso", "status_code")
    list_filter = ("modulo", "metodo", "status_code")
    search_fields = ("actor__username", "ruta")
