# Prueba de integración de extremo a extremo

**Fecha:** 2026-08-28. **Estado:** ciclo completo verificado; queda un
reporte del usuario sin resolver (§3).

A petición del usuario, se borraron todos los contratos existentes (datos
de prueba acumulados de sesiones anteriores) y se creó uno nuevo desde
cero, recorriendo el ciclo de vida completo vía peticiones HTTP reales
(`django.test.Client` con sesión autenticada real por cookies, no
llamadas directas a vistas) para validar que todos los módulos siguen
funcionando integrados entre sí, no solo cada uno por separado.

---

## 1. Qué se probó

Contrato `GACM-INTEG-20260828`, recorrido completo como 5 roles distintos:

1. **Dependencia** crea un `Contratista` nuevo — los 2 que ya existían en
   la base de prueba estaban `inhabilitado` (de pruebas previas del
   módulo Cierre), y `ContractSerializer` correctamente rechazó
   asignarlos a un contrato nuevo (RN-CIERRE-010 funcionando).
2. **Dependencia** crea una `Persona` superintendente nueva
   (`crear_usuario=true`) y el `Contrato`.
3. **Residente** sube los 6 documentos requeridos (`ContractDocument` por
   bloque), carga el catálogo de conceptos vía `bulk_upload` (CSV),
   carga el programa de obra vía `upsert_matriz`, registra una `Garantía`
   de cumplimiento y un `Anticipo`.
4. **Dependencia** activa el contrato (`documentacion_completa` valida
   los 6 bloques).
5. **Residente** abre la `Bitácora` — su `fecha_apertura` se retrocedió
   32 días directamente por ORM (no hay Celery/cron en este proyecto,
   mismo recurso usado durante las pruebas de Cierre) para caer dentro de
   la ventana de presentación de RN-EST-020 sin esperar un mes real.
6. **Superintendente** crea la Estimación del mes 1 — se siembra sola con
   `EstimacionConcepto` desde el programa de obra (`cantidad_ejecutada =
   cantidad_programada`, comportamiento ya existente de
   `EstimacionCreateSerializer`), sube evidencia fotográfica por cada
   concepto (RN-EST-006) y la presenta.
7. **Residente** la aprueba. **Residente + Superintendente + Supervisión**
   la firman (las 3 firmas requeridas antes de que pase a `firmada`).
8. **Finanzas** emitió la Orden de Pago (flujo anterior; sustituido por la
   bandera `Estimacion.pagada` en la revisión de alcance del 2026-11-02).
9. Verificación cruzada: **Notificaciones** (Dependencia/Finanzas/
   Superintendente recibieron las suyas), **Seguimiento**
   (`GET /api/contracts/<id>/seguimiento/` devuelve una Curva S con datos
   reales), **Auditoría** (Dependencia puede leer el log filtrado,
   Residente recibe 403 al intentarlo).

Resultado: **25/25 verificaciones pasaron** en la corrida final. El
contrato de prueba queda activo en la base de datos de desarrollo.

---

## 2. Bug encontrado y corregido durante la prueba

Ver `docs/plan-auditoria.md` §5 — el propio middleware de Auditoría
dejaba sin registrar las mutaciones de `EstimacionViewSet` y
`PersonaViewSet.create` por cómo resolvía el modelo desde la clase del
ViewSet. Corregido en `backend/auditoria/middleware.py`.

---

## 3. Hallazgo CSRF corregido; reporte de fotos aún sin reproducir

**Corregido el 2026-11-02:** `CookieJWTAuthentication` aceptaba mutaciones
autenticadas sin validar `X-CSRFToken`. Ahora ejecuta la validación CSRF de
Django/DRF en cada petición autenticada con cookie. Las pruebas
`users.tests.CookieJWTAuthenticationCsrfTests` verifican que un POST sin
token responda `403` y que el mismo POST con el token de la cookie responda
`200`.

También se añadió una comprobación de configuración: con `DEBUG=False`, la
aplicación no inicia si `SECRET_KEY` tiene menos de 32 caracteres. La clave
del `.env` local sigue siendo solo de desarrollo y debe reemplazarse por una
clave única antes de desplegar.

### Reporte anterior: error al subir fotos en Estimaciones

El usuario reportó un error al subir evidencia fotográfica desde el
frontend real (Superintendente, estimación en borrador — el único caso en
el que el botón de subir aparece). **No se pudo reproducir vía API**: el
mismo endpoint (`POST /api/estimaciones/evidencias/`, multipart) probado
directamente con una imagen real, con y sin encabezado CSRF, respondió
correctamente cuando la estimación seguía en `borrador`.

Se le pidió al usuario revisar la pestaña Network/Console del navegador
al reproducirlo, para saber si la petición llega al backend (y con qué
código) o si falla antes. **Todavía sin respuesta** — retomar cuando la
tenga.

---

## 4. Hallazgos operativos (entorno de desarrollo, no bugs de producto)

- **Contraseñas de usuarios demo sobrescritas por error.** Se les cambió
  la contraseña a los 5 usuarios sembrados por `seed_users`
  (`dependencia`/`residente`/`superintendente`/`supervision`/`finanzas`)
  para poder loguearlos vía `django.test.Client` en esta prueba y en la
  verificación de Seguimiento de una sesión anterior. Como `seed_users`
  usa `get_or_create`, ese cambio no se revierte solo — el usuario reportó
  no poder entrar con `dependencia@gacm.mx` y la causa era esta. Restaurado
  a `settings.DEFAULT_USER_PASSWORD` (`demo123` en `backend/.env`). Ver la
  nota nueva en el `README.md` § Usuarios de prueba.
- **`npm run build` corrompió la caché de `npm run dev`.** Se corrió
  `docker compose exec frontend npm run build` (producción) para validar
  TypeScript/ESLint/build mientras el contenedor seguía sirviendo con
  `npm run dev` sobre el mismo volumen `.next`. Efecto: `/seguimiento`
  seguía mostrando el placeholder `ComingSoon` ya reemplazado en el
  código. Se resolvió con `docker compose restart frontend`. Ver la nota
  nueva en el `README.md` § Inicio rápido.
