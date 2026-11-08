# Plan de integración — Módulo de Auditoría

**Estado:** en implementación. Última actualización: 2026-08-28.

---

## 1. Alcance

`frontend/lib/nav.ts` ya tenía la entrada `/auditoria`, visible solo a
Dependencia — se respeta tal cual.

Basado en el `AuditoriaMiddleware`/`AuditoriaLog` del proyecto de
referencia externo `Sistema_de_contratos`
(`backend/common/middleware.py`, `backend/common/models.py`,
`frontend/src/pages/Auditoria.tsx` — ver
[[project-sistema-de-contratos-referencia]]), con dos bugs reales
identificados ahí que **no se heredan**:

1. `except Exception: pass` alrededor de todo el registro — si algo
   falla, la auditoría se queda ciega en silencio, para siempre, sin que
   nadie se entere. Se reemplaza por `logger.exception(...)` — el
   registro sigue sin poder tumbar la petición real, pero el fallo queda
   visible en los logs del servidor.
2. `objeto_id if len(objeto_id) == 36 else None` asume PKs tipo UUID. GACM
   usa `BigAutoField` (enteros) en todos sus modelos — ese chequeo
   siempre habría dado `False` y `objeto_id` habría quedado `None`
   siempre. Se reemplaza extrayendo el pk directamente de
   `request.resolver_match.kwargs["pk"]` (ver §2) en vez de parsear el
   path a mano — más robusto en general, no solo para el tipo de dato.

Decisiones tomadas con el usuario antes de implementar:

1. **Sin payload — solo metadato.** No se guarda el cuerpo de la
   petición/respuesta (el proyecto de referencia sí lo hace, como
   `datos_nuevos`). Motivo: algunas respuestas de GACM incluyen datos que
   no deberían vivir para siempre en un log de auditoría (p. ej.
   `PersonaCreateResponse.temp_password`, la contraseña temporal que la
   API devuelve una sola vez al crear un usuario). El detalle narrativo de
   "qué cambió" ya vive en las tablas de eventos de cada módulo
   (`EstimacionEvento`, `CierreEvento`, `NotaBitacora`) — Auditoría
   complementa esas tablas con una vista técnica y transversal (quién,
   qué acción, cuándo, desde dónde), no las reemplaza.
2. **Se registran también los intentos fallidos** (403 por permisos, 400
   por validación, etc.), no solo las mutaciones que sí se aplicaron —
   a diferencia del proyecto de referencia (que solo guarda
   200/201/204). Útil para detectar patrones de acceso indebido.

---

## 2. App nueva: `auditoria`

### Middleware (`auditoria/middleware.py`)

Se agrega al final de `MIDDLEWARE` en `settings.py` (mismo lugar relativo
que el de referencia). Solo actúa sobre métodos que mutan
(`POST`/`PUT`/`PATCH`/`DELETE`) bajo `/api/`, de un usuario autenticado.

**Extracción de módulo/acción/objeto vía `request.resolver_match`, no
parseando el path a mano** (confirmado contra el resolver real de GACM,
ver plan-seguimiento.md-style verificación con `django.urls.resolve`):

- `request.resolver_match.func.cls` → la clase del ViewSet
  (`cierre.views.CierreViewSet`, etc.).
- `viewset_cls.queryset.model._meta.app_label` / `.model_name` →
  `modulo`/`recurso` (p. ej. `cierre`/`cierre`, `bitacora`/`notabitacora`).
  Si el ViewSet no tiene `queryset` (las vistas de `users.views` para
  login/logout/refresh/csrf son `APIView` planas, no `ModelViewSet`), no
  hay módulo que resolver — **esas rutas simplemente no generan evento**,
  en vez de necesitar una lista de exclusión manual como el `MODULOS` dict
  de la referencia. Login/logout si pasaran a ser ModelViewSet en el
  futuro sí quedarían cubiertos; con el diseño actual, no lo son.
- `request.resolver_match.func.actions` → dict `{método_http: acción}`
  que el propio router de DRF ya construyó (p. ej. `{"post":
  "notificar_inicio"}`, `{"delete": "destroy"}`) — la acción real, no solo
  "CREATE/UPDATE/DELETE" genérico como en la referencia. Esto importa en
  GACM porque casi todo el trabajo de negocio pasa por acciones custom
  (`aprobar`, `rechazar`, `presentar`, `notificar_inicio`,
  `resolver_rescision`, `finiquitar`, `cerrar`, `activar`...), no solo
  CRUD plano.
- `request.resolver_match.kwargs.get("pk")` → `objeto_id` (entero o
  `None` para un `create` sobre la ruta de lista, que no tiene pk en el
  path — limitación aceptada, ver §4).

Sin filtro de `status_code` (decisión del usuario: también fallidos) —
se guarda tal cual, y el frontend lo pinta en verde/rojo según si es
`< 400`.

### Modelo

| Campo | Tipo | Notas |
|---|---|---|
| `actor` | FK → User, `SET_NULL`, null | quién |
| `metodo` | char(6) | `POST`/`PUT`/`PATCH`/`DELETE` |
| `accion` | char(50) | del `actions` dict de DRF — `create`, `partial_update`, `notificar_inicio`, etc. |
| `modulo` | char(50), blank | `app_label` del modelo del ViewSet |
| `recurso` | char(50), blank | `model_name` (más específico que `modulo` cuando una app tiene varios modelos, p. ej. `cierre` vs `suspension`) |
| `objeto_id` | int, null | pk de la ruta, si la hay |
| `ruta` | char(255) | path completo, para depurar sin adivinar |
| `status_code` | int | de la respuesta |
| `ip` | GenericIPAddress, null | |
| `fecha` | datetime auto | |

Sin `datos_anteriores`/`datos_nuevos` (§1.1). Ordering `-fecha`.

### API

`AuditoriaEventoViewSet(ReadOnlyModelViewSet)`, `GET
/api/auditoria/` — Dependencia únicamente (igual que `nav.ts`). Filtros
por query param (mismo patrón manual que el resto de la API, sin
`django-filter`): `modulo`, `accion`, `actor` (username `icontains`),
`exitosa` (`true`/`false`, sobre `status_code < 400`). Sin paginación
(igual que el resto de la API), pero con un tope de 500 filas más
recientes por default para no devolver un histórico sin fin — mismo
espíritu que el `qs[:200]` de la referencia.

---

## 3. Frontend

Página única `auditoria/page.tsx` (no lista + detalle como los otros
módulos — es un visor de solo lectura sin flujo de trabajo propio, mismo
criterio que el propio proyecto de referencia usó ahí). Filtros
(módulo/acción/usuario/solo fallidas) + tabla + panel de detalle al
seleccionar una fila (actor, método, acción, módulo/recurso, ruta,
objeto_id, código, IP, fecha) — sin payload que mostrar, por diseño.

---

## 4. Fuera de alcance (decisiones propias, consistentes con el resto del scaffold)

- Sin lectura de GETs (ni siquiera de descargas de documentos) — solo
  mutaciones, igual que la referencia.
- Sin `objeto_id` en los `create` que llegan por la ruta de lista (el pk
  todavía no existe en el path en ese momento, y no se guarda el payload
  de la respuesta para poder extraerlo de ahí — trade-off directo de la
  decisión "sin payload" de §1).
- Sin exportar a CSV/PDF, sin retención/purga automática del log.

---

## 5. Bug encontrado y corregido tras una prueba de integración (2026-08-28)

Al correr una prueba de extremo a extremo del ciclo de vida completo de un
contrato (ver `docs/prueba-integracion.md`), la verificación de que la
acción `presentar` de una Estimación quedara en el log de Auditoría
**falló en la primera corrida**. Investigando, `_resolver_modelo()` tenía
un segundo bug simétrico al primero (§ya corregido antes de escribir este
módulo, ver el código): había cambiado a leer únicamente
`serializer_class.Meta.model` para no perderse los ViewSets que solo
definen `get_queryset()` (`NotificacionViewSet`,
`ContratistaViewSet`/`EmpresaSupervisionViewSet`/`PersonaViewSet`) — pero
`EstimacionViewSet` es justo lo opuesto: tiene `queryset` estático pero
**no** `serializer_class` estático (decide el serializer en
`get_serializer_class()` según la acción). Con la lectura exclusiva de
`serializer_class`, toda mutación sobre `EstimacionViewSet` — crear,
`presentar`, `aprobar_residente`, `rechazar_residente`, `firmar` — quedaba
sin auditar en silencio. `PersonaViewSet` tampoco tiene ninguno de los dos
como atributo estático (usa `get_serializer_class()` igual que
`EstimacionViewSet`), así que su `create` también se perdía.

**Corrección**: `_resolver_modelo()` ahora prueba en orden — `queryset`
estático primero (cubre la mayoría, incluido `EstimacionViewSet`),
después `serializer_class` estático (`Notificacion`/`Contratista`/
`EmpresaSupervision`), y como último recurso, para el caso totalmente
dinámico (`PersonaViewSet`), instancia el ViewSet y llama a su propio
`get_serializer_class()` con `.action` puesto a mano. Repetir la prueba de
integración completa después de esto: 25 eventos de auditoría en 5
módulos (`bitacora`/`contracts`/`documentos`/`estimaciones`/`users`),
incluyendo `presentar`.

**Lección para la próxima vez que se agregue un ViewSet a este proyecto**:
antes de asumir que `queryset` o `serializer_class` es una lectura segura
en código de introspección genérica, revisar cuál de los dos patrones usa
— este proyecto usa ambos, a propósito, según si el ViewSet necesita
cambiar el serializer por acción o no. Esta corrección vive en
`backend/auditoria/middleware.py` (sin commitear todavía al momento de
escribir esto — ver estado real en `git log`/`git status`).
