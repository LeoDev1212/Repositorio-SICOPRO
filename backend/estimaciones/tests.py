from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase
from rest_framework.test import APIClient

from contracts.models import Contract, ContractStatus
from estimaciones.models import Estimacion, EstimacionStatus
from users.models import Contratista, EmpresaSupervision, Persona, Role, User


class EstimacionPagoApiTests(TestCase):
	@classmethod
	def setUpTestData(cls):
		cls.users = {
			role: User.objects.create_user(
				username=f"{role}-test",
				email=f"{role}-test@example.test",
				password="test-password-only",
				role=role,
			)
			for role in (Role.DEPENDENCIA, Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION, Role.FINANZAS)
		}
		contractor = Contratista.objects.create(
			nombre="Contratista de prueba", rfc="CON010101AAA"
		)
		supervision_company = EmpresaSupervision.objects.create(
			nombre="Supervisión de prueba", rfc="SUP010101AAA"
		)
		cls.people = {
			role: Persona.objects.create(
				nombre=f"Persona {role}",
				rfc=f"RFC{index:010d}",
				user=cls.users[role],
				empresa_contratista=contractor if role == Role.SUPERINTENDENTE else None,
				empresa_supervision=supervision_company if role == Role.SUPERVISION else None,
			)
			for index, role in enumerate(
				(Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION), start=1
			)
		}
		cls.contract = Contract.objects.create(
			no_contrato=f"PAYMENT-TEST-{uuid4().hex[:8]}",
			monto=Decimal("250000.00"),
			objeto="Contrato de prueba de pago",
			plazo_dias=90,
			fecha_inicio=date.today(),
			ubicacion="Entorno de pruebas",
			status=ContractStatus.ACTIVO,
			contratista=contractor,
			empresa_supervision=supervision_company,
			residente=cls.people[Role.RESIDENTE],
			supervisor=cls.people[Role.SUPERVISION],
			superintendente=cls.people[Role.SUPERINTENDENTE],
			creado_por=cls.users[Role.DEPENDENCIA],
		)
		cls.estimacion = Estimacion.objects.create(
			contrato=cls.contract,
			mes_programa=1,
			periodo_inicio=date.today(),
			periodo_fin=date.today(),
			status=EstimacionStatus.FIRMADA,
			creado_por=cls.users[Role.SUPERINTENDENTE],
		)

	def authenticated_client(self, role):
		client = APIClient(enforce_csrf_checks=True)
		client.defaults["HTTP_HOST"] = "localhost"
		client.defaults["SERVER_NAME"] = "localhost"
		client.get("/api/auth/csrf/")
		response = client.post(
			"/api/auth/login/",
			{"email": self.users[role].email, "password": "test-password-only"},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		client.credentials(
			HTTP_X_CSRFTOKEN=client.cookies["gacm_csrf"].value
		)
		return client

	def test_finanzas_can_toggle_payment_for_signed_estimate(self):
		client = self.authenticated_client(Role.FINANZAS)

		response = client.patch(
			f"/api/estimaciones/{self.estimacion.id}/pago/",
			{"pagada": True},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data["pagada"])
		self.assertEqual(response.data["status"], EstimacionStatus.FIRMADA)

	def test_only_finanzas_can_change_payment_flag(self):
		client = self.authenticated_client(Role.RESIDENTE)

		response = client.patch(
			f"/api/estimaciones/{self.estimacion.id}/pago/",
			{"pagada": True},
			format="json",
		)

		self.assertEqual(response.status_code, 403)

	def test_payment_flag_requires_signed_estimate(self):
		self.estimacion.status = EstimacionStatus.BORRADOR
		self.estimacion.save(update_fields=["status"])
		client = self.authenticated_client(Role.FINANZAS)

		response = client.patch(
			f"/api/estimaciones/{self.estimacion.id}/pago/",
			{"pagada": True},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Estimacion.objects.get(pk=self.estimacion.id).pagada)
