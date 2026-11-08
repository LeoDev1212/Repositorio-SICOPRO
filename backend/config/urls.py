from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/actores/", include("users.actor_urls")),
    path("api/", include("contracts.urls")),
    path("api/documentos/", include("documentos.urls")),
    path("api/estimaciones/", include("estimaciones.urls")),
    path("api/bitacora/", include("bitacora.urls")),
    path("api/notificaciones/", include("notificaciones.urls")),
    path("api/cierre/", include("cierre.urls")),
    path("api/auditoria/", include("auditoria.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
