from .models import Notificacion


def crear_notificaciones(destinatarios, tipo, mensaje, enlace=""):
    """Punto único de creación (plan §3) — llamado desde las acciones de
    otras apps (estimaciones, documentos) en sus puntos de disparo.
    `destinatarios` puede traer None (p. ej. un rol sin Persona asignada
    todavía) — se filtran antes de escribir."""
    Notificacion.objects.bulk_create(
        [
            Notificacion(destinatario=usuario, tipo=tipo, mensaje=mensaje, enlace=enlace)
            for usuario in destinatarios
            if usuario is not None
        ]
    )
