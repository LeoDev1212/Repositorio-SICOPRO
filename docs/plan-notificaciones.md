# Plan de integración — Módulo de Notificaciones

> Basado en las convenciones ya establecidas por `plan-estimaciones.md` y
> `plan-bitacora.md`, y en el modelo `Notificacion` observado en el proyecto
> de referencia externo `Sistema_de_contratos` (ver
> `docs/manual_lopsrm.md`... no, ver la memoria de análisis de ese proyecto —
> no forma parte de este repo). Módulo deliberadamente pequeño: sin máquina
> de estados, solo generación automática de eventos + lectura por el
> destinatario.

**Estado:** Implementado y probado contra el stack de Docker.
Última actualización: 2026-08-27.

---

## 1. Alcance

GACM ya tiene el placeholder de navegación (`frontend/lib/nav.ts`, ruta
`/notificaciones`, visible a todos los roles) con la descripción "Alertas de
plataforma y correo para plazos y acciones pendientes". El correo (SMTP) y
cualquier cola asíncrona (Celery/Redis) están explícitamente fuera del
alcance del scaffold según el README ("Roadmap — no incluido todavía") — este
módulo implementa **solo las alertas dentro de la plataforma** (fila en base
de datos + lista en el frontend), no envío de correo ni tiempo real
(WebSockets/polling). El usuario ve notificaciones nuevas al cargar la
página o el topbar, no en vivo.

A diferencia de Estimaciones/Convenios/Bitácora, **no tiene máquina de
estados** — una notificación nace, y solo cambia una vez: de no leída a
leída. Tampoco tiene alcance por asignación de contrato (RN-BIT-011-style):
el alcance es directo por destinatario (`destinatario=request.user`), más
simple que el resto de los módulos.

---

## 2. Modelo (app nueva: `notificaciones`)

### `Notificacion`

| Campo | Tipo | Notas |
|---|---|---|
| `destinatario` | FK → User | quién la recibe |
| `tipo` | choices | ver §3 |
| `mensaje` | text | texto generado por el sistema, no se captura a mano |
| `enlace` | char, blank | ruta relativa del frontend a la que apunta (p. ej. `/estimaciones/12`) |
| `leida` | bool, default False | único campo mutable desde la API |
| `fecha_creacion` | datetime auto | |

Sin FK genérica al objeto de origen (se evitó `GenericForeignKey` por ser
sobreingeniería para 2 orígenes posibles) — `enlace` ya resuelve la
navegación, y `mensaje` ya trae el contexto legible.

---

## 3. Puntos de disparo (RN-NOTIF-004)

Generadas por el propio backend en el momento de la transición — no existe
endpoint para crear notificaciones manualmente vía API.

| Evento | Tipo | Destinatarios |
|---|---|---|
| Residente aprueba una estimación | `estimacion_aprobada` | Todas las Personas con rol Dependencia (RN-EST-011: Dependencia "se entera del resultado") |
| Residente rechaza una estimación | `estimacion_rechazada` | Dependencia + el Superintendente asignado al contrato (es quien debe corregir y volver a presentar) |
| Se completa la firma (Residente+Superintendente+Supervisión) | `estimacion_firmada` | Usuarios con rol Finanzas, para que registren si ya se pagó |
| Dependencia aprueba un Convenio Modificatorio | `convenio_aprobado` | Residente + Superintendente asignados al contrato |

**Deliberadamente fuera de alcance** (RN-NOTIF-005): notificar cada firma
individual (cada firmante ya ve el estado en la propia pantalla de la
estimación); eventos de Bitácora (las notas ya son visibles en el timeline
compartido — notificar cada nota sería ruido); rechazo de Convenio (no
existe todavía una acción `rechazar` en `ConvenioModificatorioViewSet`, solo
`aprobar` — fuera del alcance de este módulo agregarla).

---

## 4. Reglas de negocio (RN-NOTIF-xxx)

| # | Regla |
|---|---|
| RN-NOTIF-001 | Las notificaciones se generan automáticamente por el sistema en los puntos de §3; no existe acción `create` expuesta en la API (default-deny: el rol no está mapeado en `action_roles`). |
| RN-NOTIF-002 | Cada usuario solo ve sus propias notificaciones (`destinatario=request.user`) — alcance directo, no por asignación de contrato. |
| RN-NOTIF-003 | Solo el propio destinatario puede marcar sus notificaciones como leídas — `leida` es el único campo editable, vía `partial_update` o la acción masiva `marcar_todas_leidas`. |

---

## 5. API (nueva app `notificaciones`, prefijo `/api/notificaciones/`)

```
notificaciones/                    list (propias), retrieve (propia)
notificaciones/{id}/               PATCH {leida} — marcar una
notificaciones/marcar_todas_leidas/  POST — marca todas las propias no leídas
```

Sin `ContratoScopedMixin`: el queryset se filtra directo por
`destinatario=self.request.user`, igual para los 5 roles (ninguno ve las de
otro, ni siquiera Dependencia).

---

## 6. Frontend

- `app/(dashboard)/notificaciones/page.tsx` — reemplaza el `ComingSoon`:
  lista de notificaciones propias, más recientes primero, no leídas
  resaltadas, botón "Marcar todas como leídas", cada fila clickeable
  (navega a `enlace` y la marca leída al hacer clic).
- `components/shell/topbar.tsx` — icono de campana con contador de no
  leídas (fetch al montar, sin polling), enlaza a `/notificaciones`.
- `lib/types.ts` — tipos `Notificacion`, `NotificacionTipo`.

---

## 7. Estado de verificación (2026-08-27)

Backend probado contra Docker real (`manage.py check` + `makemigrations`
limpios, API real con `curl`):
- Aprobar una estimación como Residente → aparece notificación para
  Dependencia (`tipo=estimacion_aprobada`).
- Rechazar una estimación → aparece notificación para Dependencia y para el
  Superintendente del contrato.
- Completar la firma → aparece notificación para Finanzas.
- Aprobar un convenio → aparece notificación para Residente y
  Superintendente.
- Un usuario no ve las notificaciones de otro (probado con dos roles
  distintos sobre el mismo evento).
- Marcar como leída (`PATCH leida=true`) y `marcar_todas_leidas` funcionan
  y respetan el alcance por destinatario.

Frontend: `tsc --noEmit`, `eslint` y `next build` limpios.
