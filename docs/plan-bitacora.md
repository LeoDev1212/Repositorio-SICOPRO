# Plan de integración — Módulo de Bitácora

> Basado en `docs/manual_lopsrm.md` §4 (Bitácora de Obra e Implementación en
> Sistema) y en las convenciones ya establecidas por `docs/plan-estimaciones.md`.
> Este documento es la fuente de verdad del diseño del módulo hasta que se
> traduzca en modelos/código; se actualiza conforme se implementa cada fase.

**Estado:** Bitácora implementada con apertura, notas, cierre y enganche con
Estimaciones. Por indicación del profesor, los adjuntos se retiraron del
alcance y de la aplicación; una migración elimina su modelo y sus datos.
La evidencia fotográfica se conserva únicamente en Estimaciones.
Última actualización: 2026-11-02.

---

## 1. Qué dice el manual vs. qué construye GACM

El manual describe un sistema de **producción real** para obra pública federal
(BESOP): firma electrónica avanzada vía e.Firma/FIEL contra el SAT, sellado de
tiempo por una autoridad de certificación, blockchain/ledger inmutable, app
móvil offline con geolocalización GPS, y exportación al formato BESOP.

GACM es un proyecto académico (ver README: *"las firmas de bitácora son RFCs
ficticios"*) y ya resolvió este mismo dilema en Estimaciones Fase 4: `firmar()`
es una acción simple sin verificación real. Se aplica el mismo criterio aquí —
se recorta deliberadamente:

| Del manual | Se implementa como |
|---|---|
| Firma electrónica avanzada (FIEL/SAT) | Autoría simple: `autor` (FK User) + `fecha` (`auto_now_add`) por nota — igual que `EstimacionEvento` |
| Sello de tiempo por TSA certificadora | `fecha` de Django, nada más |
| Hash + blockchain/ledger inmutable | No se implementa — sin ledger ni adjuntos en Bitácora |
| Geolocalización GPS desde app móvil | **No se implementa** — no hay app móvil en este proyecto; mismo criterio que `EvidenciaFotografica` ("no se maneja ubicación/geolocalización") |
| App móvil offline-first | Fuera de alcance — solo web (Next.js), como el resto de GACM |
| Exportación a BESOP | Fuera de alcance |
| Datos generales de las partes en la nota de apertura (Art. 123) | **No se duplican** — ya existen en `Contract`/`Persona`/`Contratista`/`EmpresaSupervision`; la apertura solo agrega lo que no existe todavía: `fecha_apertura` |
| Corrección de notas con historial de cambios | **No se permite editar** — las notas son inmutables (RN-BIT-005); se corrige con una nota nueva que referencia a la anterior |

Lo que sí se conserva porque es el corazón legal del módulo: la estructura de
nota (Art. 94 RLOPSRM), la nota de apertura/cierre, la relación con
Estimaciones, y el control de acceso por rol.

---

## 2. Por qué este módulo importa ahora: desbloquea Estimaciones Fase 8

`docs/plan-estimaciones.md` §4.1 deja pendiente **RN-EST-020** (ventana de 6
días para presentar) explícitamente porque necesita `fecha_inicio_obra`, dato
que hoy no existe en ningún lado — `Estimacion.save()` usa `contrato.fecha_inicio`
como interino.

Ese dato es exactamente la **fecha de apertura de la bitácora** (Art. 123
RLOPSRM: el residente abre la bitácora "previo a la fecha de inicio de los
trabajos"). Este plan expone `Bitacora.fecha_apertura` para que, en una fase
posterior, `Estimacion` la use en vez del interino — ver §7.

---

## 3. Modelos (app nueva: `bitacora`)

### `Bitacora`

Uno por contrato — crearla **es** el acto legal de abrirla; no existe un
estado intermedio "sin abrir" (igual de simple que `Anticipo`/`Garantia`:
existe o no existe).

| Campo | Tipo | Notas |
|---|---|---|
| `contrato` | OneToOne → Contract | debe estar `activo` al crearse (RN-BIT-001) |
| `estado` | choices | `abierta` / `cerrada` |
| `fecha_apertura` | date, auto | se fija a hoy al crear, no editable — es el dato que Estimaciones Fase 8 necesita (§2) |
| `fecha_cierre` | date, null | se fija al cerrar |
| `abierta_por` | FK → User | Residente que la abrió |
| `cerrada_por` | FK → User, null | Residente que la cerró |
| `fecha_creacion` | datetime auto | |

Al crearse, se genera automáticamente la primera `NotaBitacora` (tipo
`apertura`) en la misma transacción — ver RN-BIT-003.

### `NotaBitacora`

Cuerpo del módulo — una fila por evento, con los campos mínimos del Art. 94
RLOPSRM que no están ya cubiertos por otro modelo del sistema.

| Campo | Tipo | Notas |
|---|---|---|
| `bitacora` | FK | — |
| `numero` | int | consecutivo por bitácora, autogenerado (mismo patrón que `Estimacion.numero`) |
| `clasificacion` | choices | `apertura`, `avance`, `modificacion`, `incidencia`, `calidad`, `seguridad`, `comunicacion`, `cierre` (colapsa las categorías del manual §4.4) |
| `descripcion` | text | narrativa del asunto — obligatoria |
| `ubicacion` | char, blank | texto libre (eje/tramo/nivel), no geolocalización |
| `causa` | text, blank | |
| `solucion` | text, blank | |
| `prevencion` | text, blank | |
| `consecuencia_economica` | decimal, null | impacto en costo, si lo hay |
| `responsable` | char, blank | texto libre, no FK — quien la ley pide identificar no siempre es un usuario del sistema |
| `fecha_atencion` | date, null | cuándo se resolvió, si aplica |
| `nota_referencia` | FK a sí misma, null | para responder una nota existente (comunicación entre partes) |
| `estimacion` | FK → Estimacion, null | poblada solo por la nota automática de RN-BIT-009 |
| `autor` | FK → User | quien la registra — hace de "firma" simple |
| `fecha` | datetime, auto | |

Inmutable tras crearse (RN-BIT-005) — sin `update`/`partial_update` en el
ViewSet (mismo patrón que `EstimacionEvento`, que tampoco se edita).

No existe un modelo de adjuntos para Bitácora en el alcance académico.

---

## 4. Máquina de estados de `Bitacora.estado`

```
(no existe)
   → abierta       [Residente, POST /bitacoras/ — requiere contrato activo,
                     RN-BIT-001; crea la nota de apertura automáticamente]
        → cerrada  [Residente, POST /bitacoras/{id}/cerrar/ — requiere
                     motivo/resumen, crea la nota de cierre automáticamente]
```

No hay vuelta de `cerrada` a `abierta` — una bitácora cerrada es de solo
lectura de forma permanente (RN-BIT-008), igual que un `ContractStatus.CERRADO`.

---

## 5. Reglas de negocio (RN-BIT-xxx)

> Prefijo `RN-BIT-` por la misma razón que `RN-EST-`/`RN-CONV-` en el plan de
> Estimaciones: evita colisión con la numeración `RN-030` del proyecto
> original, que no es visible desde aquí.

| # | Regla |
|---|---|
| RN-BIT-001 | Una Bitácora solo puede abrirse (crearse) sobre un contrato en estado `activo`, y solo por el Residente asignado a ese contrato. |
| RN-BIT-002 | Un contrato tiene a lo más una Bitácora (`OneToOne`) — abrir una segunda vez falla. |
| RN-BIT-003 | Al abrirse, se fija `fecha_apertura` (hoy, no editable) y se crea automáticamente la nota de apertura (tipo `apertura`), en la misma transacción. |
| RN-BIT-004 | Solo Residente, Supervisión o Superintendente asignados al contrato pueden crear notas. Dependencia tiene acceso de solo lectura — nunca escribe notas (mismo criterio que Dependencia en Estimaciones: se entera, no actúa). |
| RN-BIT-005 | Las notas son inmutables una vez creadas — no hay `update`/`partial_update`. Una corrección se hace con una nota nueva que referencia a la anterior (`nota_referencia`). |
| RN-BIT-006 | El número de nota es consecutivo y único por bitácora, autogenerado. |
| RN-BIT-007 | Solo el Residente puede cerrar la bitácora, y solo si está `abierta`; el cierre requiere un resumen/motivo (texto obligatorio) que se guarda como la nota de cierre (tipo `cierre`). |
| RN-BIT-008 | Una bitácora `cerrada` es de solo lectura permanente — no admite nuevas notas. |
| RN-BIT-009 | Cuando una Estimación se presenta (`EstimacionViewSet.presentar`) y su contrato ya tiene Bitácora `abierta`, se genera automáticamente una `NotaBitacora` tipo `avance` con `estimacion` poblado y `descripcion` autogenerada — cumple la obligación legal de asentar la fecha de presentación sin captura manual duplicada. Si el contrato no tiene bitácora todavía, `presentar()` no falla — simplemente no genera la nota (evita acoplar el flujo de Estimaciones a que Bitácora exista). |
| RN-BIT-010 | El alcance por asignación aplica también en escritura (mismo criterio que RN-EST-019): cada acción sobre `NotaBitacora` valida que `bitacora.contrato` esté dentro del queryset scoped del usuario. |

---

## 6. API (nueva app `bitacora`, prefijo `/api/bitacora/`)

```
bitacoras/                    list (scoped), create (Residente, RN-BIT-001)
bitacoras/{id}/                retrieve (ALL_ROLES scoped, sin Finanzas)
bitacoras/{id}/cerrar/         POST {motivo} — Residente (RN-BIT-007)

notas/?bitacora={id}           list, create — Residente/Supervisión/Superintendente
                                (sin update/partial_update/destroy, RN-BIT-005)
```

`Finanzas` queda fuera de todos los roles de este módulo — coherente con
`frontend/lib/nav.ts`, donde el ítem "Bitácora" ya excluye ese rol.

`ContratoScopedMixin` se reutiliza igual que en `estimaciones/views.py`, con
`unrestricted_roles = {Role.DEPENDENCIA}` (sin `FINANZAS` — a diferencia de
Estimaciones, aquí Finanzas no tiene ningún rol, así que queda en
default-deny sin necesidad de código extra) y:

```python
assignment_lookups = {
    Role.RESIDENTE: f"{prefix}__residente__user",
    Role.SUPERVISION: f"{prefix}__supervisor__user",
    Role.SUPERINTENDENTE: f"{prefix}__superintendente__user",
}
```

con `prefix` = `"contrato"` para `Bitacora` y `"bitacora__contrato"` para
`NotaBitacora`.

---

## 7. El enganche con Estimaciones (fuera de la app `bitacora`)

Dos cambios pequeños en `estimaciones/`, una vez que `bitacora` exista:

1. **`Estimacion.save()`** (`backend/estimaciones/models.py:82`): cambiar
   `inicio_obra = self.contrato.fecha_inicio` por
   `inicio_obra = getattr(self.contrato, "bitacora", None) and self.contrato.bitacora.fecha_apertura or self.contrato.fecha_inicio`
   — usa la fecha real si la bitácora ya está abierta, cae al interino si no.
2. **RN-EST-020** (ventana de 6 días) y el resto de §4.1 de
   `plan-estimaciones.md` se implementan usando `contrato.bitacora.fecha_apertura`
   como la `fecha_inicio_obra` que faltaba.

Esto se documenta aquí porque es la razón de ser de este módulo, pero se
implementa como una fase de `plan-estimaciones.md` (su Fase 8), no de este
plan — para no reabrir ese documento a mitad de una fase ya cerrada, se anota
el enganche en ambos lados.

---

## 8. Frontend

Bitácora ya tiene entrada de navegación (`frontend/lib/nav.ts`, ruta
`/bitacora`, visible a `dependencia`/`residente`/`superintendente`/`supervision`
— **no** a `finanzas`) y una página `ComingSoon` a reemplazar. Sigue el mismo
patrón lista+detalle que Estimaciones (no el patrón de tab-dentro-de-contrato
que usa Convenios, porque Bitácora es un módulo con volumen y complejidad
propios, no un anexo pequeño):

- `app/(dashboard)/bitacora/page.tsx` — lista de bitácoras (una por contrato),
  filtrable por contrato/estado. Si el contrato del usuario no tiene
  bitácora todavía, botón "Abrir bitácora" (solo Residente).
- `app/(dashboard)/bitacora/[id]/page.tsx` — detalle:
  - **Encabezado**: contrato, fecha de apertura, estado (badge).
  - **Timeline de notas** — orden cronológico, badge de `clasificacion`,
    autor e hilo de respuestas vía `nota_referencia`.
  - **Formulario "Nueva nota"** (Residente/Supervisión/Superintendente):
    clasificación + descripción + campos opcionales (causa/solución/
    prevención/consecuencia económica/responsable/fecha de atención/
    referencia a otra nota).
  - **Botón "Cerrar bitácora"** (Residente, solo si `abierta`), con diálogo
    de motivo obligatorio — mismo patrón que el diálogo de rechazo en
    Estimaciones.
  - Dependencia ve todo, no tiene formulario de nota ni botón de cierre.
- `lib/bitacora-status.ts` — labels/variants de `estado`, análogo a
  `lib/estimacion-status.ts`.
- `lib/types.ts` — tipos `Bitacora`, `NotaBitacora`, `BitacoraEstado` y
  `NotaClasificacion`.

---

## 9. Fases de implementación sugeridas

1. **Fundacional** — modelos `Bitacora`/`NotaBitacora`, migraciones, permisos,
   scoping, abrir (create) con nota de apertura automática, CRUD de notas
   (sin adjuntos, sin edición). Lista/detalle simples en frontend. **Completada.**
2. **Adjuntos** — función retirada del alcance académico por indicación del
  profesor (2026-11-02); el modelo, endpoint y controles de interfaz fueron
  eliminados.
3. **Cierre** — acción `cerrar`, nota de cierre automática, bloqueo de
  escritura tras `cerrada` (RN-BIT-008). **Completada**.
4. **Enganche con Estimaciones** — RN-BIT-009 (nota automática al presentar)
   + el cambio en `Estimacion.save()` de §7, que a su vez desbloquea la Fase 8
   de `plan-estimaciones.md` (RN-EST-020, ventana de 6 días) — esa fase se
   marca y ejecuta en el otro documento, no en este. **Completada.**

Cada fase se da por terminada cuando pasa `manage.py check` +
`makemigrations --check` limpios y se prueba al menos una vez contra el stack
de Docker — mismo criterio que Estimaciones.

---

## 10. Decisiones — resueltas al arrancar la implementación

Eran "abiertas" en el diseño; se resolvieron con la propuesta por defecto de
cada una (sin objeción del usuario) al arrancar la Fase 1:

- **`consecuencia_economica`**: informativa, sin integración con las
  deducciones de Estimaciones. Si surge la necesidad real, se revisita.
- **`fecha_apertura`**: capturable manualmente (no siempre "hoy"), con
  validación de que no sea futura — el campo admite un valor distinto al de
  creación del registro, consistente con que el Art. 123 permite abrir
  "previo a la fecha de inicio" de los trabajos.
- **Notas tipo `seguridad`**: sin restricción de acceso especial — mismo
  nivel que cualquier otra clasificación (RN-BIT-004).

---

## 11. Verificación histórica (2026-08-27)

La prueba de la Fase 2 que aparece abajo corresponde a la implementación
anterior al ajuste académico del 2026-11-02; los adjuntos ya no existen en
el modelo, API ni frontend actuales.

Probado contra el stack real de Docker (Postgres + Django + Next.js), no
solo en aislado (el `.venv` local quedó inutilizable porque el Python 3.12
que lo creó ya no está instalado en la máquina, y el Python 3.14 disponible
no tiene wheels prebuilt para `psycopg2-binary`/`Pillow` en las versiones
fijadas de `requirements.txt` — se usó Docker Desktop en su lugar, igual que
recomienda el README para desarrollo):

- **Backend**: `manage.py check` limpio, `makemigrations bitacora` +
  `makemigrations --check --dry-run` limpio, `migrate` aplicado sin errores.
  Verificado vía API real (`curl` con cookies de sesión reales por rol)
  contra `http://localhost:8000`:
  - Residente abre bitácora sobre un contrato activo → se crea con
    `fecha_apertura` de hoy y la nota de apertura automática (RN-BIT-003).
  - RN-BIT-002 (una bitácora por contrato): segundo intento de abrir sobre
    el mismo contrato → `400`.
  - RN-BIT-001 (solo Residente abre): Superintendente intenta abrir → `403`.
  - Supervisión y Residente crean notas (`avance`, `comunicacion` con
    `nota_referencia` a una nota previa) → `201`, numeración consecutiva
    correcta (1, 2, 3).
  - Dependencia intenta crear una nota → `403`; Dependencia lee notas → `200`
    (confirma RN-BIT-004: solo lectura).
  - Intento de crear una nota con `clasificacion=cierre` manualmente → `400`
    (reservada al sistema).
  - Intento de editar (`PATCH`) una nota existente → bloqueado (RN-BIT-005).
  - **Fase 2**: subida multipart de un adjunto a una nota (Residente) → `201`,
    con `hash_sha256`/`tamano`/`formato` calculados correctamente; listado
    filtrado por `?bitacora=` agrupa bien por nota; Dependencia intenta subir
    un adjunto → `403`; intento de `DELETE` sobre un adjunto existente →
    bloqueado (sin `destroy` mapeado).
  - **Fase 3**: Superintendente intenta cerrar → `403`; Residente cierra sin
    motivo → `400`; Residente cierra con motivo → `200`, `estado=cerrada`,
    `fecha_cierre`/`cerrada_por` fijados, y se crea automáticamente la nota
    de cierre (numeración consecutiva correcta). Tras el cierre: crear una
    nota nueva → `400` (RN-BIT-008); subir un adjunto → `400` (RN-BIT-008);
    cerrar por segunda vez → `400` ("solo se puede cerrar una abierta").
  - **Fase 4**: en un contrato sin bitácora, una `Estimacion` nueva sigue
    usando `contrato.fecha_inicio` como antes (interino intacto). Con
    bitácora abierta, una `Estimacion` nueva calcula `periodo_inicio`/
    `periodo_fin` a partir de `bitacora.fecha_apertura` (verificado con
    aritmética exacta: apertura 2026-08-27, mes 2 → periodo 2026-09-26 a
    2026-10-25). Al presentar una estimación con bitácora abierta, se generó
    automáticamente la nota `avance` con `estimacion` poblado y numeración
    consecutiva correcta (RN-BIT-009); con bitácora **cerrada**, presentar
    no falla y no crea nota (confirmado contando notas antes/después). Se
    encontró y corrigió en el camino un bug real: la descripción de la nota
    usaba `.date()` sobre un datetime en UTC en vez de la hora local
    (`TIME_ZONE=America/Mexico_City`), lo que corría la fecha mostrada un
    día en horario nocturno — corregido con `timezone.localtime(...)`.
- **Frontend**: `tsc --noEmit`, `eslint` y `next build` limpios sobre todos
  los archivos nuevos/modificados de ambas fases (`app/(dashboard)/bitacora/`,
  `lib/bitacora-status.ts`, `lib/types.ts`).
- **Prueba manual en navegador**: no realizada en esta sesión — la
  automatización de Chrome ya se documentó como inestable en
  `plan-estimaciones.md` §10; queda pendiente que el usuario la haga
  directamente o se repita cuando la herramienta esté estable.
