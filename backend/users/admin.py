from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Contratista, EmpresaSupervision, Persona, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "username", "role", "is_staff")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Rol GACM", {"fields": ("role", "initials")}),
    )


admin.site.register(Contratista)
admin.site.register(EmpresaSupervision)
admin.site.register(Persona)
