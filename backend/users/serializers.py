import secrets

from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework import serializers

from .models import Contratista, EmpresaSupervision, Persona, Role, User
from .utils import generate_unique_username


class ContratistaSerializer(serializers.ModelSerializer):
    inhabilitado_vigente = serializers.ReadOnlyField()

    class Meta:
        model = Contratista
        fields = [
            "id",
            "nombre",
            "rfc",
            "representante",
            "telefono",
            "correo",
            "inhabilitado",
            "fecha_fin_inhabilitacion",
            "motivo_inhabilitacion",
            "inhabilitado_vigente",
        ]
        read_only_fields = ["inhabilitado", "fecha_fin_inhabilitacion", "motivo_inhabilitacion"]


class EmpresaSupervisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpresaSupervision
        fields = ["id", "nombre", "rfc", "representante", "telefono", "correo"]


class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = [
            "id",
            "nombre",
            "rfc",
            "telefono",
            "correo",
            "empresa_contratista",
            "empresa_supervision",
        ]


ASSIGNABLE_ROLES = [Role.RESIDENTE, Role.SUPERINTENDENTE, Role.SUPERVISION]


class PersonaWriteSerializer(serializers.ModelSerializer):
    """
    Used by PersonaViewSet.create. Optionally provisions a login for the new
    Persona with a random one-time password instead of a shared/guessable
    default, returned only in this creation response (see temp_password).
    """

    crear_usuario = serializers.BooleanField(write_only=True, default=False)
    role = serializers.ChoiceField(
        choices=ASSIGNABLE_ROLES, write_only=True, required=False
    )
    temp_password = serializers.SerializerMethodField()

    class Meta:
        model = Persona
        fields = [
            "id",
            "nombre",
            "rfc",
            "telefono",
            "correo",
            "empresa_contratista",
            "empresa_supervision",
            "crear_usuario",
            "role",
            "temp_password",
            "user",
        ]
        read_only_fields = ["id", "user"]

    def get_temp_password(self, obj):
        return getattr(obj, "_temp_password", None)

    def validate(self, attrs):
        if attrs.get("crear_usuario"):
            if not attrs.get("role"):
                raise serializers.ValidationError(
                    {"role": "Requerido si crear_usuario es true."}
                )
            correo = attrs.get("correo")
            if not correo:
                raise serializers.ValidationError(
                    {"correo": "Requerido para crear una cuenta de acceso."}
                )
            if User.objects.filter(email=correo).exists():
                raise serializers.ValidationError(
                    {"correo": "Ya existe una cuenta con este correo."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        crear_usuario = validated_data.pop("crear_usuario", False)
        role = validated_data.pop("role", None)
        persona = Persona.objects.create(**validated_data)

        if crear_usuario:
            password = secrets.token_urlsafe(9)
            username = generate_unique_username(persona.correo)
            nombres = persona.nombre.split(" ", 1)
            user = User.objects.create(
                username=username,
                email=persona.correo,
                first_name=nombres[0],
                last_name=nombres[1] if len(nombres) > 1 else "",
                role=role,
                password=make_password(password),
            )
            persona.user = user
            persona.save(update_fields=["user"])
            persona._temp_password = password

        return persona


class MeSerializer(serializers.ModelSerializer):
    persona = PersonaSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "initials", "persona"]
