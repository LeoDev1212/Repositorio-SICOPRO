from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from users.models import Contratista, EmpresaSupervision, Persona, Role, User


class Command(BaseCommand):
    help = (
        "Crea un usuario de prueba por rol (idempotente, vía get_or_create). "
        "Solo debe ejecutarse en entornos de desarrollo/demo — ver SEED_DEMO_DATA en entrypoint.sh."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        password_hash = make_password(settings.DEFAULT_USER_PASSWORD)

        dependencia_user, _ = User.objects.get_or_create(
            email="dependencia@gacm.mx",
            defaults=dict(
                username="dependencia",
                first_name="Dependencia",
                last_name="Demo",
                role=Role.DEPENDENCIA,
                initials="DEP",
                password=password_hash,
            ),
        )

        contratista, _ = Contratista.objects.get_or_create(
            rfc="CON010101AAA",
            defaults=dict(
                nombre="Constructora Demo S.A. de C.V.",
                representante="Juan Pérez",
                telefono="5555555555",
                correo="contacto@constructorademo.mx",
            ),
        )
        empresa_supervision, _ = EmpresaSupervision.objects.get_or_create(
            rfc="SUP010101AAA",
            defaults=dict(
                nombre="Supervisión Técnica Demo S.C.",
                representante="Ana Gómez",
                telefono="5555555556",
                correo="contacto@supervisiondemo.mx",
            ),
        )

        superintendente_user, _ = User.objects.get_or_create(
            email="superintendente@gacm.mx",
            defaults=dict(
                username="superintendente",
                first_name="Superintendente",
                last_name="Demo",
                role=Role.SUPERINTENDENTE,
                initials="SPT",
                password=password_hash,
            ),
        )
        Persona.objects.get_or_create(
            rfc="PESU800101AA1",
            defaults=dict(
                nombre="Superintendente Demo",
                telefono="5555555557",
                correo="superintendente@gacm.mx",
                empresa_contratista=contratista,
                user=superintendente_user,
            ),
        )

        supervision_user, _ = User.objects.get_or_create(
            email="supervision@gacm.mx",
            defaults=dict(
                username="supervision",
                first_name="Supervisión",
                last_name="Demo",
                role=Role.SUPERVISION,
                initials="SUP",
                password=password_hash,
            ),
        )
        Persona.objects.get_or_create(
            rfc="PESV800101AA1",
            defaults=dict(
                nombre="Supervisor Demo",
                telefono="5555555558",
                correo="supervision@gacm.mx",
                empresa_supervision=empresa_supervision,
                user=supervision_user,
            ),
        )

        residente_user, _ = User.objects.get_or_create(
            email="residente@gacm.mx",
            defaults=dict(
                username="residente",
                first_name="Residente",
                last_name="Demo",
                role=Role.RESIDENTE,
                initials="RES",
                password=password_hash,
            ),
        )
        Persona.objects.get_or_create(
            rfc="PERE800101AA1",
            defaults=dict(
                nombre="Residente Demo",
                telefono="5555555559",
                correo="residente@gacm.mx",
                user=residente_user,
            ),
        )

        User.objects.get_or_create(
            email="finanzas@gacm.mx",
            defaults=dict(
                username="finanzas",
                first_name="Finanzas",
                last_name="Demo",
                role=Role.FINANZAS,
                initials="FIN",
                password=password_hash,
            ),
        )

        self.stdout.write(self.style.SUCCESS("Usuarios y actores de prueba listos."))
