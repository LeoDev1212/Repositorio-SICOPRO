from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import Role, User


class CookieJWTAuthenticationCsrfTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="finance-test",
            email="finance-test@example.test",
            password="test-password-only",
            role=Role.FINANZAS,
        )

    def authenticated_client(self):
        client = APIClient(enforce_csrf_checks=True)
        client.defaults["HTTP_HOST"] = "localhost"
        client.defaults["SERVER_NAME"] = "localhost"
        csrf_response = client.get("/api/auth/csrf/")
        self.assertEqual(csrf_response.status_code, 204)

        login_response = client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "test-password-only"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        return client

    def test_authenticated_mutation_requires_csrf_token(self):
        client = self.authenticated_client()

        response = client.post(
            "/api/notificaciones/marcar_todas_leidas/", {}, format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_authenticated_mutation_accepts_csrf_cookie_token(self):
        client = self.authenticated_client()
        csrf_token = client.cookies[settings.CSRF_COOKIE_NAME].value

        response = client.post(
            "/api/notificaciones/marcar_todas_leidas/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 200)