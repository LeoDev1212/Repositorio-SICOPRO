from django.conf import settings
from django.contrib.auth import authenticate
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Contratista, EmpresaSupervision, Persona, Role
from .permissions import RoleScopedPermission
from .serializers import (
    ContratistaSerializer,
    EmpresaSupervisionSerializer,
    MeSerializer,
    PersonaSerializer,
    PersonaWriteSerializer,
)


def _cookie_kwargs():
    return {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": "/",
    }


def _set_auth_cookies(response, access_token, refresh_token):
    response.set_cookie(settings.AUTH_COOKIE_ACCESS, str(access_token), **_cookie_kwargs())
    response.set_cookie(settings.AUTH_COOKIE_REFRESH, str(refresh_token), **_cookie_kwargs())


def _clear_auth_cookies(response):
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/")


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfPrimeView(APIView):
    """GET this once on app load so the browser has a gacm_csrf cookie to echo back."""

    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)
        return Response(status=204)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "")
        password = request.data.get("password", "")
        user = authenticate(request, username=email, password=password)
        if user is None or not user.is_active:
            return Response({"detail": "Credenciales inválidas."}, status=401)

        refresh = RefreshToken.for_user(user)
        response = Response(MeSerializer(user).data, status=200)
        _set_auth_cookies(response, refresh.access_token, refresh)
        get_token(request)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw_refresh is None:
            return Response({"detail": "No hay sesión activa."}, status=401)

        try:
            refresh = RefreshToken(raw_refresh)
            if jwt_settings.ROTATE_REFRESH_TOKENS:
                if jwt_settings.BLACKLIST_AFTER_ROTATION:
                    try:
                        refresh.blacklist()
                    except AttributeError:
                        pass
                refresh.set_jti()
                refresh.set_exp()
                refresh.set_iat()
            access = refresh.access_token
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        response = Response(status=200)
        _set_auth_cookies(response, access, refresh)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass

        response = Response(status=204)
        _clear_auth_cookies(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class ActorPermission(RoleScopedPermission):
    """Only Dependencia registers/looks up actors — used while running the
    contract wizard. Other actions stay unmapped (denied) until an edit
    screen for these registries exists."""

    action_roles = {
        "list": {Role.DEPENDENCIA},
        "create": {Role.DEPENDENCIA},
    }


class ContratistaViewSet(viewsets.ModelViewSet):
    serializer_class = ContratistaSerializer
    permission_classes = [ActorPermission]

    def get_queryset(self):
        qs = Contratista.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(nombre__icontains=search) | Q(rfc__icontains=search))
        return qs


class EmpresaSupervisionViewSet(viewsets.ModelViewSet):
    serializer_class = EmpresaSupervisionSerializer
    permission_classes = [ActorPermission]

    def get_queryset(self):
        qs = EmpresaSupervision.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(nombre__icontains=search) | Q(rfc__icontains=search))
        return qs


class PersonaViewSet(viewsets.ModelViewSet):
    permission_classes = [ActorPermission]

    def get_serializer_class(self):
        if self.action == "create":
            return PersonaWriteSerializer
        return PersonaSerializer

    def get_queryset(self):
        qs = Persona.objects.all()
        params = self.request.query_params
        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(nombre__icontains=search)
                | Q(rfc__icontains=search)
                | Q(correo__icontains=search)
            )
        role = params.get("role")
        if role:
            qs = qs.filter(user__role=role)
        empresa_contratista = params.get("empresa_contratista")
        if empresa_contratista:
            qs = qs.filter(empresa_contratista_id=empresa_contratista)
        empresa_supervision = params.get("empresa_supervision")
        if empresa_supervision:
            qs = qs.filter(empresa_supervision_id=empresa_supervision)
        return qs
