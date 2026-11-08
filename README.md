SICOPRO — Sistema de Información y Control de Proyectos de Infraestructura
Proyecto académico (alcance no real — las firmas de bitácora son RFCs ficticios) que implementa una plataforma para administrar el ciclo de vida de contratos de obra pública conforme a la Ley de Obras Públicas y Servicios Relacionados con las Mismas (LOPSRM) de México.


Este repositorio es una reimplementación desde cero, inspirada conceptualmente en un proyecto previo (mismo dominio), pero con un stack y una arquitectura de permisos propios — no comparte código con aquel.
Actores y roles
Rol
	Responsabilidad principal
	Dependencia
	Organización gubernamental que registra y activa contratos, aprueba convenios y rescisiones, y tiene visibilidad global.
	Empresa Contratista
	Empresa contratada (entidad registrada, no inicia sesión directamente).
	Superintendente
	Representante de la contratista en la plataforma; presenta estimaciones y convenios, registra avances.
	Empresa de Supervisión
	Empresa que provee al personal de supervisión (entidad registrada).
	Supervisión
	Representante de la empresa de supervisión; valida estimaciones, supervisa el programa, registra incidencias.
	Residente de Obra
	Designado por la Dependencia; gestiona la bitácora, revisa estimaciones, registra cierre.
	Finanzas
	Registra si una estimación firmada está pagada o pendiente.
	Requisitos
Herramienta
	Versión mínima
	Docker Desktop
	24+
	Docker Compose
	v2 (incluido en Docker Desktop)
	Inicio rápido con Docker
# 1. Variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local


# 2. Levantar servicios
docker compose up --build

Al iniciar, el backend siempre corre las migraciones. La carga de usuarios de prueba (seed_users) solo ocurre si SEED_DEMO_DATA=true en backend/.env (activado por defecto en .env.example, para desarrollo local).


Servicio
	URL
	Frontend
	http://localhost:3000
	API backend
	http://localhost:8000/api
	Admin Django
	http://localhost:8000/admin
	Usuarios de prueba
Con SEED_DEMO_DATA=true, seed_users crea un usuario por rol con la contraseña definida en DEFAULT_USER_PASSWORD (ver backend/.env, no versionado):


Email
	Rol
	dependencia@sicopro.mx
	Dependencia
	residente@sicopro.mx
	Residente
	superintendente@sicopro.mx
	Superintendente
	supervision@sicopro.mx
	Supervisión
	finanzas@sicopro.mx
	Finanzas
	

No cambies la contraseña de estos usuarios al probar (ej. set_password por shell) — seed_users es idempotente vía get_or_create y solo fija la contraseña la primera vez que crea cada usuario, así que un cambio posterior no se revierte solo. Si necesitas loguearte como uno de ellos desde un script, usa settings.DEFAULT_USER_PASSWORD (o el valor de backend/.env) tal cual. Si necesitas una identidad nueva para una prueba, crea un actor/usuario dedicado en vez de reutilizar y mutar estos.


No corras npm run build en el contenedor de frontend mientras npm run dev sigue corriendo ahí (ej. para validar con docker compose exec frontend npm run build) — ambos comparten el mismo directorio .next (montado como volumen), y el build de producción dejó la caché de compilación del servidor de desarrollo en un estado que servía páginas viejas (se vio con /seguimiento mostrando el placeholder "en construcción" ya reemplazado). Si pasa, docker compose restart frontend lo resuelve.
Arquitectura de autenticación y permisos
* Cookies httpOnly: los tokens JWT de acceso/refresco (sicopro_access, sicopro_refresh) nunca son legibles por JavaScript en el navegador — el backend los setea vía Set-Cookie en POST /api/auth/login/. El frontend lee la cookie sicopro_csrf (no-httpOnly) y la envía como X-CSRFToken en cada mutación; CookieJWTAuthentication valida el token CSRF en el backend.
* Clave de firma: SECRET_KEY debe tener al menos 32 caracteres cuando DEBUG=False; genera una clave única para cada entorno antes de desplegar.
* Permisos por rol, default-deny (backend/users/permissions.py): RoleScopedPermission exige un mapa explícito acción→roles para cada acción de un ViewSet (incluyendo update/partial_update/destroy); una acción sin mapear se deniega, no se permite implícitamente.
* Alcance por asignación (AssignmentScopedQuerySetMixin): Dependencia ve todos los contratos; Residente/Supervisión/Superintendente solo ven los contratos donde su Persona vinculada está asignada.
Estructura del proyecto
SICOPRO/
├── backend/                 # Django REST Framework
│   ├── config/               # settings, urls
│   ├── users/                # User (roles), Persona, Contratista, EmpresaSupervision,
│   │                           # auth por cookies, framework de permisos
│   └── contracts/            # Contract (registro, activación, estados)
├── frontend/                # Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
│   ├── app/(auth)/login/       # Login
│   ├── app/(dashboard)/        # Shell con sidebar/topbar + módulos
│   ├── components/shell/       # AppSidebar, Topbar, ComingSoon
│   ├── lib/                    # api client, types, nav, roles
│   └── proxy.ts                # Gate de rutas por cookie de sesión
└── docker-compose.yml
Módulos
Todos los módulos del roadmap original están implementados (backend + frontend). Ver docs/plan-*.md para el diseño y las decisiones de cada uno.


Módulo
	Estado
	Plan
	Contratos
	Registro, documentación por bloques, activación.
	—
	Documentación (catálogo, programa, garantías, anticipo, convenios modificatorios)
	Completo.
	docs/plan-estimaciones.md §2
	Estimaciones
	Completo: captura, generador N×L×A×H, evidencia fotográfica, flujo de firmas, deducciones e indicador de pago.
	docs/plan-estimaciones.md
	Bitácora
	Completo: apertura, notas con folio y cierre. Sin adjuntos por alcance académico.
	docs/plan-bitacora.md
	Convenios Modificatorios
	Completo, módulo propio (lista + detalle).
	docs/plan-estimaciones.md §14
	Notificaciones
	Completo (sin correo/tiempo real — solo dentro de la plataforma).
	docs/plan-notificaciones.md
	Cierre y Rescisión
	Completo: las 7 fases (suspensión, terminación por cumplimiento, rescisión administrativa + inhabilitación, terminación anticipada, rescisión judicial).
	docs/plan-cierre.md
	Seguimiento
	Completo: Curva S (programado vs. real) y resumen financiero, sin app/modelo propio — una acción derivada en ContractViewSet.
	docs/plan-seguimiento.md
	Auditoría
	Completo: middleware que registra toda mutación de la API (exitosa o no) como metadato, sin payload.
	docs/plan-auditoria.md
	

Ver docs/prueba-integracion.md para el registro de la prueba de integración de extremo a extremo más reciente (ciclo de vida completo de un contrato) y los hallazgos operativos que dejó.
Roadmap (no incluido en el scaffold inicial)
Estas piezas del stack original se documentan aquí pero no se instalan todavía — se agregan cuando una funcionalidad real las necesite:


* Celery + Redis — para notificaciones asíncronas y generación de reportes.
* Almacenamiento S3 (o MinIO en dev) — para documentos y evidencia fotográfica.
* Kubernetes / ECS — orquestación de producción.
* GitLab CI — pipeline de pruebas/build/deploy.
* Sentry — monitorización de errores.
Exportar el proyecto para revisión en otra máquina
frontend/node_modules y frontend/.next viven en volúmenes nombrados de Docker (frontend_node_modules, frontend_next_cache en docker-compose.yml), no en el disco del host — no aparecen bajo frontend/ y no hace falta excluirlos a mano al copiar la carpeta. backend/.venv sí vive en el host pero está roto en esta máquina (ver nota más abajo) y no lo usa ningún flujo de Docker, así que tampoco hace falta llevarlo.


Para armar un paquete listo para levantar en otra computadora:


1. Verifica que no haya nada roto antes de exportar:


docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx eslint .
docker compose exec frontend npm run build   # y luego `docker compose restart frontend` — ver nota abajo
docker compose config --quiet

2. Comprime la carpeta del proyecto excluyendo .git/, Sistema_de_contratos/ (clon de referencia externo, no es parte de SICOPRO), backend/.venv/ y cualquier __pycache__/. Sí incluye backend/.env y frontend/.env.local — sin secretos reales (SECRET_KEY=change-me-in-production, DEFAULT_USER_PASSWORD=demo123, credenciales de Postgres triviales de desarrollo), así el paquete levanta con un solo comando en la máquina destino, sin configurar nada a mano.
3. En la máquina destino: descomprimir y docker compose up --build. Al no incluir postgres_data (volumen de Docker, nunca vive en el árbol de archivos), la base de datos arranca vacía — las migraciones corren solas y, si SEED_DEMO_DATA=true en backend/.env (por defecto), seed_users crea los 5 usuarios de prueba de la tabla de arriba. No se lleva ningún dato de prueba capturado a mano (contratos, estimaciones, etc. de la máquina de origen) — es exportar el proyecto, no una base de datos.


Nota — no correr npm run build sin reiniciar después: como ya advertía la nota de arriba, correr un build de producción en el mismo contenedor donde sigue vivo npm run dev dejó la caché de compilación en mal estado una vez en esta sesión. Si vas a validar con npm run build antes de exportar (paso 1), corre docker compose restart frontend inmediatamente después para que el servidor de desarrollo vuelva a arrancar limpio.
Antes de desplegar a producción
* Genera un SECRET_KEY único (python -c "import secrets; print(secrets.token_urlsafe(50))").
* Cambia DEFAULT_USER_PASSWORD y pon SEED_DEMO_DATA=false fuera de desarrollo.
* DEBUG=False, ajusta ALLOWED_HOSTS/CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS al dominio real.
* Verifica que backend/.env y frontend/.env.local no se suban al repositorio.
