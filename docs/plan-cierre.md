# Plan de integración — Módulo de Cierre y Rescisión

> Basado en el resumen de LOPSRM/RLOPSRM sobre cierre de contratos de obra
> pública que compartió el usuario, y en su retroalimentación puntual sobre
> las 4 decisiones abiertas de la versión anterior de este documento
> (2026-08-27). Fuente de verdad del diseño hasta que se traduzca en
> código; se actualiza conforme se implementa cada fase.

**Estado:** Módulo completo — Fases 1-7 implementadas (Suspensión;
Cierre/CierreEvento fundacional + terminación por cumplimiento;
congelamiento cruzado RN-CIERRE-009; rescisión administrativa +
inhabilitación RN-CIERRE-010; terminación anticipada; rescisión judicial;
enganches con Bitácora/Notificaciones/banner de contrato/badge de
contratista). Backend y frontend en todas las fases, probado contra Docker
real.
Última actualización: 2026-08-28.

---

## 0. Qué cambió respecto a la v1 de este documento

El usuario respondió las 4 decisiones abiertas de la v1, y las 4 respuestas
**expanden el alcance** respecto a lo que se había propuesto por default:

1. La rescisión administrativa ya no es una sola acción de "crear" — se
   separan **propuesta** (Residente, documenta el incumplimiento) e
   **inicio formal notificado** (Dependencia/jurídico, el acto con efectos
   legales).
2. El congelamiento de Estimaciones/Convenios ocurre **al notificarse el
   inicio**, no al finiquitar — y la rescisión necesita su **propio cálculo
   de finiquito** (trabajos ejecutados − anticipo no amortizado − penas
   convencionales), independiente del módulo de Estimaciones porque ese
   módulo ya está congelado en ese punto.
3. Se modela inhabilitación real de contratistas (`Contratista.inhabilitado`
   + `fecha_fin_inhabilitacion`), con **enforcement real** (bloquea asignar
   ese contratista a un contrato nuevo), no solo una alerta informativa.
4. La suspensión temporal se modela como **entidad propia** (`Suspension`),
   con fechas exactas que alimentan `Contract.plazo_vigente_dias` — no como
   texto libre.

---

## 1. Por qué este módulo importa ahora

`Contract.status` (`backend/contracts/models.py`) ya tiene desde el
scaffold inicial los valores `en_cierre` y `cerrado` en su enum
(`ContractStatus`) — **nunca se usan**, ninguna acción del sistema los
alcanza todavía. Mismo patrón que `ConvenioModificatorioStatus.RECHAZADO`
antes de esta sesión (un valor de enum inalcanzable, cerrado el 2026-08-27):
el diseño original ya anticipaba este módulo.

También cierra un pendiente ya documentado explícitamente en
`plan-estimaciones.md` (RN-EST-016): *"El fondo de garantía... se acumula
pero no se libera hasta el cierre/finiquito (módulo Cierre y Rescisión,
fuera de este alcance)."*

`frontend/lib/nav.ts` ya tiene "Cierre y rescisión" → `/cierre` (roles
`dependencia`/`residente`), hoy un `ComingSoon` sin conectar.

---

## 2. Qué dice la ley vs. qué construye GACM (recortes deliberados)

Mismo criterio que Bitácora (sin FIEL real) y Estimaciones (sin pasarela de
pago real): se modela el **contenido y flujo administrativo**, no los actos
que son inherentemente externos al sistema (un litigio, una autorización de
otra dependencia).

| Del documento | Se implementa como |
|---|---|
| 4 formas de cierre con procedimientos distintos | **Un solo modelo `Cierre`** con `tipo` — mismo patrón que `ConvenioModificatorio.tipo` |
| Rescisión judicial: demanda ante Tribunales Federales, el Tribunal decide | **No se modela el litigio.** Dependencia registra el resultado ya resuelto (fecha, monto, documento) |
| Terminación anticipada por caso fortuito, contratista pide "declaratoria judicial" si Dependencia niega | **No se modela esa vía judicial derivada** — el `Cierre` queda `descartado`; lo que pase después es fuera del sistema |
| "Informe al órgano interno de control a más tardar el último día hábil del mes" | Checkbox informativo, sin integración real (no hay destinatario real) |
| Firma de actas con representantes "con facultades" | No se valida identidad/representación legal — igual que el resto del sistema (RFCs ficticios, README) |
| Afirmativa ficta (15 días sin respuesta = aceptado) | Propiedad informativa (`aceptada_tacitamente`) — GACM no tiene Celery/cron, nada dispara solo; se muestra como alerta y Dependencia confirma con una acción explícita |
| Suspensión temporal | **Ya no se recorta** — ver `Suspension` en §4, a petición explícita del usuario (punto 4) |
| Inhabilitación por 3ª rescisión | **Ya no se recorta** — se modela con enforcement real (§4, §5), a petición explícita del usuario (punto 3) |

---

## 3. Relación con módulos ya existentes

- **`Contract.status`**: `activo → en_cierre` ocurre cuando un `Cierre`
  llega a `en_proceso` (ver §5 sobre cuándo es eso exactamente según el
  tipo). `en_cierre → cerrado` ocurre al finiquitar. Si un `Cierre` de
  rescisión administrativa se `descartado`, el contrato **regresa** a
  `activo`.
- **RN-EST-016 (fondo de garantía)**: se agrega `Contract.fondo_garantia_acumulado`
  (property, Python puro — `fondo_garantia` es property de `Estimacion`, no
  columna, no se puede agregar en SQL) = Σ de las estimaciones no
  `borrador`/`rechazada_residente` del contrato. Solo relevante para
  `terminacion_cumplimiento`.
- **Estimación de liquidación**: **no se agrega ningún campo a
  `Estimacion`** — `Cierre.estimacion_liquidacion` es una FK nullable
  *hacia* `Estimacion`. Solo aplica a `terminacion_cumplimiento` — los
  otros 3 tipos calculan su finiquito directamente en `Cierre` (§4), sin
  pasar por Estimaciones, porque ese módulo ya está congelado para
  entonces (RN-CIERRE-009).
- **`Contract.plazo_vigente_dias`** (ya existe, de Convenios): gana un
  tercer sumando — `Σ Suspension.dias_suspendidos` del contrato, además del
  `plazo_dias` original y `Σ dias_delta` de convenios aprobados. Sin
  importar `Suspension` en `contracts/models.py` (mismo truco que
  `fecha_inicio_obra`/`monto_vigente`: se accede vía `self.suspensiones`,
  el descriptor inverso que Django agrega solo).
- **`Contratista.inhabilitado`** (nuevo, en `users/models.py` — no en
  `cierre`, porque es un atributo del contratista, no del contrato):
  `contracts/serializers.py` valida al crear/reactivar un contrato que el
  `Contratista` elegido no esté inhabilitado vigente.
- **Bitácora**: nota automática al notificar inicio de cierre y al
  finiquitar (RN-BIT-009-style) — cierra el error #3 del documento ("no
  documentar en bitácora la terminación... Art. 125 RLOPSRM").
- **Notificaciones**: hooks en los mismos puntos que Estimaciones/Convenios
  (§8).
- **Gap encontrado al diseñar** (no corregido todavía):
  `ConvenioModificatorioSerializer` no valida `contrato.status` en ningún
  lado — hoy se puede crear un convenio sobre un contrato `registrado` o
  `cerrado`. Este módulo lo cierra como parte de RN-CIERRE-009.

---

## 4. Modelos (app nueva: `cierre`)

### `Suspension`

Entidad propia (no texto libre, punto 4 del usuario) — un contrato puede
tener varias a lo largo de su vida (secuenciales, no simultáneas en la
práctica, pero no se fuerza `OneToOne`).

| Campo | Tipo | Notas |
|---|---|---|
| `contrato` | FK → Contract | `related_name="suspensiones"` |
| `causal` | choices | `interes_general` / `causa_justificada` / `caso_fortuito` (Art. 60) |
| `motivo` | text | |
| `fecha_inicio` | date | |
| `fecha_fin` | date, null | `null` mientras sigue activa |
| `es_indeterminada` | bool, default False | marcable mientras `fecha_fin` es null — habilita la opción de crear un `Cierre` tipo `terminacion_anticipada` referenciando esta suspensión (Art. 60: "si no es posible determinar la temporalidad, se procede a la terminación anticipada") |
| `monto_gastos_no_recuperables` | decimal, default 0 | si aplica |
| `registrada_por` | FK → User | Residente o Dependencia |
| `fecha_registro` | datetime auto | |
| `resuelta_por` | FK → User, null | quien capturó `fecha_fin` |
| `fecha_resolucion` | datetime, null | |

Propiedades: `dias_suspendidos` = `(fecha_fin o hoy) - fecha_inicio`;
`activa` = `fecha_fin is None`.

### `Cierre`

Uno "vivo" por contrato (`en_proceso`/`propuesta`), pero no un `OneToOne`
estricto — un `Cierre` `descartado` no impide crear otro después
(RN-CIERRE-007, igual que en la v1).

| Campo | Tipo | Notas |
|---|---|---|
| `contrato` | FK → Contract | `related_name="cierres"` |
| `tipo` | choices | `terminacion_cumplimiento` / `terminacion_anticipada` / `rescision_administrativa` / `rescision_judicial` |
| `status` | choices | `propuesta` / `en_proceso` / `finiquitado` / `descartado` — ver §5 |
| `motivo` | text | causal — siempre obligatorio |
| `suspension_origen` | FK → Suspension, null | solo `terminacion_anticipada`, cuando nace de una suspensión indeterminada — trazabilidad, no obligatorio (también puede nacer sin suspensión previa, p. ej. interés general directo) |
| `iniciado_por` | FK → User | quien creó el registro (Residente si `propuesta`, Dependencia si nace directo en `en_proceso`) |
| `fecha_inicio` | datetime auto | |
| `notificado_por` | FK → User, null | solo se llena al pasar de `propuesta` a `en_proceso` |
| `fecha_notificacion_inicio` | datetime, null | el acto con efectos legales (congela el contrato) — ver RN-CIERRE-001/009 |
| `estimacion_liquidacion` | FK → Estimacion, null | solo `terminacion_cumplimiento` |
| `fecha_acta_entrega_recepcion` | date, null | solo `terminacion_cumplimiento` |
| `documento_acta_entrega` | FileField, null | hash/tamaño/formato, mismo patrón que `ContractDocument` |
| `fecha_notificacion_incumplimiento` | datetime, null | solo `rescision_administrativa` — puede coincidir con `fecha_notificacion_inicio` o ser el mismo campo (ver nota de implementación abajo) |
| `alegatos_contratista` | text, blank | solo `rescision_administrativa`, captura Superintendente |
| `fecha_alegatos` | datetime, null | |
| `se_rescinde` | bool, null | resultado de la resolución de Dependencia |
| `fecha_resolucion` | datetime, null | |
| `documento_acta_circunstanciada` | FileField, null | rescisión (admin. o judicial) |
| `fecha_resolucion_judicial` | date, null | solo `rescision_judicial` — hecho externo, se registra tal cual |
| `monto_resolucion_judicial` | decimal, null | solo `rescision_judicial` |
| `monto_trabajos_ejecutados` | decimal, default 0 | medición final **fuera** del flujo ordinario de Estimaciones — captura manual (Residente), solo para tipos que no usan `estimacion_liquidacion` |
| `monto_penas_convencionales` | decimal, default 0 | idem |
| `monto_gastos_no_recuperables` | decimal, default 0 | `terminacion_anticipada`/`rescision_judicial` — "la dependencia paga los gastos no recuperables" |
| `fecha_finiquito` | datetime, null | |
| `documento_finiquito` | FileField, null | Acta de extinción de derechos y obligaciones |
| `finiquitado_por` | FK → User, null | |
| `fecha_creacion` | datetime auto | |

**Nota de implementación**: `fecha_notificacion_incumplimiento` y
`fecha_notificacion_inicio` se mantienen como campos separados aunque para
`rescision_administrativa` ocurren en el mismo acto (notificar = incumplir
+ iniciar formalmente) — se simplifica en la vista: la acción
`notificar_inicio` llena ambos a la vez para ese tipo. Se mantienen
separados en el modelo porque conceptualmente son cosas distintas y porque
`fecha_notificacion_inicio` es genérico a los 4 tipos (es "cuándo empezó a
tener efectos legales/se congeló el contrato"), mientras
`fecha_notificacion_incumplimiento` es específico del vocabulario legal de
rescisión.

Propiedades calculadas (informativas salvo donde diga lo contrario):

- `fecha_limite_acta_entrega` = fecha de verificación `+ 15 días naturales`
  — solo `terminacion_cumplimiento`.
- `fecha_limite_estimacion_liquidacion` = `fecha_acta_entrega_recepcion +
  60 días naturales` — RN-CIERRE-004.
- `fecha_limite_alegatos` = `fecha_notificacion_inicio + 15 días hábiles` —
  solo `rescision_administrativa`.
- `fecha_limite_resolucion_rescision` = `fecha_alegatos + 10 días hábiles`.
- `aceptada_tacitamente` = `True` si `terminacion_anticipada`, pasaron >15
  días naturales desde `fecha_inicio` sin `fecha_resolucion`.
- `fecha_liberacion_fondo_garantia` = `fecha_acta_entrega_recepcion + 365
  días` — solo `terminacion_cumplimiento`.
- `anticipo_no_amortizado` = `contrato.anticipo.saldo_pendiente` o 0.
- `importe_neto_finiquito` (solo tipos que **no** son
  `terminacion_cumplimiento`, RN-CIERRE-011): `max(0, monto_trabajos_ejecutados
  + monto_gastos_no_recuperables - anticipo_no_amortizado -
  monto_penas_convencionales)` — trabajos y gastos no recuperables se
  **pagan** al contratista; anticipo pendiente y penas se **descuentan**.
  Para `terminacion_cumplimiento` el monto a pagar es
  `estimacion_liquidacion.importe_neto` (ya calculado por Estimaciones) —
  este campo no aplica ahí.

### `CierreEvento`

Timeline de auditoría, mismo patrón que `EstimacionEvento`.

| Campo | Tipo | Notas |
|---|---|---|
| `cierre` | FK | |
| `tipo` | choices | `propuesto`, `notificado_inicio`, `acta_entrega_recepcion`, `alegatos_recibidos`, `resolucion_rescision`, `resolucion_judicial_registrada`, `finiquitado`, `descartado` |
| `actor` | FK → User | |
| `comentario` | text, blank | |
| `fecha` | datetime auto | |

### `Contratista` (modificado, `users/models.py`)

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `inhabilitado` | bool, default False | |
| `fecha_fin_inhabilitacion` | date, null | `null` = indefinida (no debería pasar en la práctica, pero no se fuerza) |
| `motivo_inhabilitacion` | text, blank | referencia al `Cierre`/contrato que lo originó |

Propiedad: `inhabilitado_vigente` = `True` si `inhabilitado` y
(`fecha_fin_inhabilitacion` es `None` o `>= hoy`).

---

## 5. Máquina de estados

### `Suspension` (ligera, sin `status` propio)

```
(creada, fecha_fin=null)  →  activa
     → resuelta   [se captura fecha_fin — la obra se reanuda]
     → (puede marcarse es_indeterminada=True mientras sigue activa,
        lo que habilita crear un Cierre tipo terminacion_anticipada
        que la referencia vía suspension_origen — no es una transición
        de estado en sí, solo una bandera)
```

### `Cierre.status`

**`rescision_administrativa`** es el único tipo con el paso `propuesta`
(punto 1 del usuario — Residente propone, Dependencia ejecuta):

```
(sin cierre, contrato activo)
   → propuesta        [Residente crea — documenta incumplimientos vía
                         `motivo`; Contract.status SIGUE activo, nada se
                         congela todavía (RN-CIERRE-001)]
        → en_proceso    [Dependencia: acción `notificar_inicio` — AHORA
                          Contract.status → en_cierre, se congela
                          Estimaciones/Convenios (RN-CIERRE-009)]
             → finiquitado
        → descartado    [Dependencia decide no formalizar la propuesta —
                          acción `descartar`, Contract sigue/vuelve a activo]

   → en_proceso        [Dependencia crea directo — no necesita "proponerse
                         a sí misma"; mismo efecto de congelamiento inmediato]
        → finiquitado
        → descartado    [tras alegatos, Dependencia resuelve se_rescinde=False]
```

**Los otros 3 tipos** no tienen `propuesta` — su creación ya es el acto
formal (el propio documento los describe así: el contratista notifica
conclusión, alguien solicita la terminación anticipada, o el resultado
judicial ya existe). Nacen directo en `en_proceso`, con el mismo efecto de
congelamiento inmediato:

```
(sin cierre, contrato activo)
   → en_proceso   [creación = notificación formal; Contract.status → en_cierre]
        → finiquitado
        → descartado   [solo terminacion_anticipada, si Dependencia resuelve
                          negativamente dentro de sus 15 días naturales]
```

---

## 6. Reglas de negocio (RN-CIERRE-xxx)

| # | Regla |
|---|---|
| RN-CIERRE-001 | `rescision_administrativa`: Residente crea en `propuesta` (documentando el incumplimiento); Dependencia puede crear directo en `en_proceso`, o formalizar una `propuesta` existente vía `notificar_inicio`. Mientras está en `propuesta`, el contrato sigue `activo` y nada se congela. |
| RN-CIERRE-002 | `terminacion_cumplimiento` lo crea el Superintendente asignado (Art. 64). `terminacion_anticipada` lo crea Residente, Dependencia o Superintendente — si referencia una `Suspension` (`suspension_origen`), esta debe pertenecer al mismo contrato y tener `es_indeterminada=True`. `rescision_judicial` solo lo registra Dependencia, y solo con `fecha_resolucion_judicial` ya capturada (hecho ya ocurrido). |
| RN-CIERRE-003 | El acta de entrega-recepción la captura Residente o Dependencia — solo `terminacion_cumplimiento`. |
| RN-CIERRE-004 | La estimación de liquidación debe pertenecer al mismo contrato; presentarla fuera de `fecha_limite_estimacion_liquidacion` no bloquea (RN-EST-020/021 siguen rigiendo su presentación) pero se muestra como alerta — mismo criterio que RN-EST-017. |
| RN-CIERRE-005 | En `rescision_administrativa`: alegatos los captura una vez el Superintendente asignado, mientras no haya `fecha_resolucion`. La resolución (`se_rescinde` + `fecha_resolucion`) solo la captura Dependencia, solo después de que existan alegatos **o** haya vencido `fecha_limite_alegatos` sin ellos. |
| RN-CIERRE-006 | Si `se_rescinde=True`, se exige `documento_acta_circunstanciada` antes de poder finiquitar. Si `se_rescinde=False`, el `Cierre` pasa a `descartado` y el contrato regresa a `activo` — no hay finiquito. `rescision_judicial` no tiene `se_rescinde` (el resultado ya viene resuelto desde la creación) pero **también** exige `documento_acta_circunstanciada` antes de finiquitar — mismo campo, comparte el requisito documental sin compartir el flujo de resolución. |
| RN-CIERRE-007 | Un `Cierre` `descartado` no impide iniciar uno nuevo sobre el mismo contrato — un contrato solo puede tener a lo más un `Cierre` en `propuesta` o `en_proceso` a la vez. |
| RN-CIERRE-008 | **Finiquitar** (`finiquitar`, solo Dependencia): para `terminacion_cumplimiento` exige `estimacion_liquidacion` firmada, ninguna otra estimación en `borrador`/`en_revision_residente`, y `Anticipo.saldo_pendiente = 0`. Para los otros 3 tipos exige `monto_trabajos_ejecutados` capturado (y `documento_acta_circunstanciada` si aplica RN-CIERRE-006) — el saldo de anticipo se resuelve dentro del propio cálculo (`importe_neto_finiquito`), no como precondición. Cierra el error #1 del documento ("firmar el finiquito con saldos pendientes"). La bandera `pagada` no cambia el estado de firma requerido. |
| RN-CIERRE-009 | Al pasar a `en_proceso` (para cualquier tipo — inmediato en 3 de los 4, tras `notificar_inicio` en rescisión administrativa): `Contract.status → en_cierre`. A partir de ahí, `estimaciones`/`convenios` quedan congelados — `EstimacionSerializer` y `ConvenioModificatorioSerializer` deben exigir `contrato.status == activo` para `create` (Convenios no lo exige hoy, es el gap de §3), **con una excepción**: si `tipo=terminacion_cumplimiento` y el `Cierre` todavía no tiene `estimacion_liquidacion`, se permite crear/presentar exactamente esa estimación (la de liquidación) aunque el contrato esté `en_cierre` — sin esta excepción sería imposible completar el propio flujo de cierre normal. |
| RN-CIERRE-010 | **Inhabilitación real** (ya no solo informativa, punto 3 del usuario): al finiquitar una `rescision_administrativa` con `se_rescinde=True`, si es la **3ª** para el mismo `Contratista` (contando todos sus contratos en GACM), el sistema marca automáticamente `Contratista.inhabilitado=True` y `fecha_fin_inhabilitacion = hoy + 2 años`. `ContractSerializer.validate()` (en `contracts`) rechaza crear/reactivar un contrato con un `Contratista` cuyo `inhabilitado_vigente` sea `True`. |
| RN-CIERRE-011 | El cálculo `importe_neto_finiquito` (rescisión/terminación anticipada/judicial) nunca es negativo — se trunca a 0, mismo criterio que RN-EST-014. |
| RN-CIERRE-012 | Una `Suspension` la registra Residente o Dependencia; solo puede resolverse (`fecha_fin`) quien la registró o Dependencia. `Contract.plazo_vigente_dias` incluye `Σ dias_suspendidos` de todas las suspensiones del contrato (activas cuentan hasta hoy). |
| RN-CIERRE-013 | `terminacion_anticipada`: Dependencia puede `aceptar` (formaliza el resultado, no cambia `status`) o `rechazar` (→ `descartado`, contrato vuelve a `activo`) mientras no haya `fecha_resolucion` **y** no hayan pasado 15 días naturales desde `fecha_notificacion_inicio` sin resolución (`aceptada_tacitamente`). Pasado ese plazo, `rechazar` se bloquea — la afirmativa ficta es irreversible, pero es meramente informativa: no dispara nada sola (sin Celery/cron), Dependencia simplemente puede finiquitar directo sin haber llamado `aceptar`. |

---

## 7. API (nueva app `cierre`, prefijo `/api/cierre/`)

```
suspensiones/                       list (scoped), create (Residente/Dependencia)
suspensiones/{id}/resolver/         POST {fecha_fin} — Residente/Dependencia (RN-CIERRE-012)
suspensiones/{id}/marcar_indeterminada/  POST — Residente/Dependencia (mientras activa)

cierres/                            list (scoped), create (según tipo, RN-CIERRE-001/002)
cierres/{id}/                       retrieve (ALL_ROLES scoped)
cierres/{id}/notificar_inicio/      POST — Dependencia, solo desde `propuesta` (RN-CIERRE-001/009)
cierres/{id}/descartar/             POST {comentario} — Dependencia, desde `propuesta` o `en_proceso`
cierres/{id}/acta_entrega/          POST {fecha, documento} — Residente/Dependencia (RN-CIERRE-003)
cierres/{id}/vincular_liquidacion/  POST {estimacion} — Superintendente (solo terminacion_cumplimiento)
cierres/{id}/alegatos/              POST {alegatos} — Superintendente (RN-CIERRE-005)
cierres/{id}/resolver_rescision/    POST {se_rescinde, comentario} — Dependencia (RN-CIERRE-005/006)
cierres/{id}/acta_circunstanciada/  POST {documento} — Residente/Dependencia
cierres/{id}/aceptar/               POST {comentario} — Dependencia, solo terminacion_anticipada (RN-CIERRE-013)
cierres/{id}/rechazar/              POST {comentario} — Dependencia, solo terminacion_anticipada, dentro de 15 días naturales (RN-CIERRE-013)
cierres/{id}/finiquitar/            POST {documento} — Dependencia (RN-CIERRE-008/009/010/011)
cierres/{id}/eventos/               GET — historial (ALL_ROLES scoped)
```

`ContratoScopedMixin` reutilizado igual que en `estimaciones`/`bitacora`
(`unrestricted_roles = {Role.DEPENDENCIA}`), tanto para `Suspension` como
para `Cierre`.

---

## 8. Notificaciones (nuevos tipos)

| Evento | Destinatarios |
|---|---|
| Se crea una `propuesta` de rescisión administrativa | Dependencia (debe decidir si notifica o descarta) |
| Se notifica el inicio de un `Cierre` (cualquier tipo) | Residente + Superintendente (+ Dependencia si no fue quien lo notificó) |
| `rescision_administrativa`: Dependencia resuelve (rescinde o no) | Residente + Superintendente |
| Se registra/resuelve una `Suspension` | Residente + Superintendente + Dependencia |
| `Cierre` finiquitado | Dependencia + Residente + Superintendente + Finanzas |
| Un `Contratista` queda inhabilitado (RN-CIERRE-010) | Dependencia únicamente (información interna, no es un aviso al contratista) |

---

## 9. Frontend

Mismo patrón ya establecido (módulo propio, no pestaña):

- `app/(dashboard)/cierre/page.tsx` — reemplaza el `ComingSoon`: lista de
  cierres (filtrable por contrato/tipo/status) + lista/sección de
  suspensiones activas.
- `app/(dashboard)/cierre/[id]/page.tsx` — detalle con:
  - Encabezado: contrato, tipo, status (badge distinto para `propuesta`
    vs. `en_proceso` — visualmente debe quedar claro que `propuesta`
    todavía no tiene efectos legales).
  - Botón "Notificar inicio" (Dependencia, solo si `propuesta`) y
    "Descartar" (Dependencia).
  - Cards condicionales por tipo (acta de entrega + liquidación para
    cumplimiento; alegatos + resolución para rescisión administrativa;
    balance de finiquito con los 3 montos para los otros 3).
  - Checklist de requisitos de `finiquitar` (RN-CIERRE-008), visible antes
    de intentar el botón — mismo patrón que "documentación completa" en
    `contratos/[id]/page.tsx`.
  - Historial (`CierreEvento`).
- `app/(dashboard)/cierre/suspensiones/[id]/page.tsx` o una sección dentro
  del detalle del contrato — a decidir en fase de implementación si
  amerita su propia ruta o vive dentro de `/cierre`.
- `lib/cierre-status.ts` (nuevo) — labels/variants.
- Contrato (`contratos/[id]/page.tsx`): banner si `en_cierre`/`cerrado`,
  con link a `/cierre?contrato={id}`.
- Contratista (donde sea que se liste/edite — hoy no hay una pantalla
  dedicada de Contratistas fuera del registro de contrato): badge de
  "Inhabilitado hasta {fecha}" visible al Dependencia al buscar/seleccionar
  contratista para un contrato nuevo.

---

## 10. Fases de implementación sugeridas

1. **Suspensión** — modelo `Suspension`, CRUD, `Contract.plazo_vigente_dias`
   actualizado. Independiente del resto, puede ir primero y probarse solo.
   **Completada.**
2. **Fundacional + Terminación por cumplimiento** — modelos
   `Cierre`/`CierreEvento`, permisos, scoping, sync con `Contract.status`,
   `fondo_garantia_acumulado`, flujo completo: crear → acta de entrega →
   vincular estimación de liquidación (con la excepción de RN-CIERRE-009) →
   finiquitar. **Completada** (el modelo `Cierre` de esta fase solo tiene los
   campos de `terminacion_cumplimiento` + los genéricos — los campos de
   rescisión/terminación anticipada/judicial se agregan en sus propias fases
   vía migraciones nuevas, mismo criterio que `monto_delta`/`dias_delta` en
   Convenios; RN-CIERRE-009 en sí, incluida su excepción, queda para la
   Fase 3 — en esta fase el contrato pasa a `en_cierre` pero todavía no hay
   ningún congelamiento real que exceptuar).
3. **Congelamiento cruzado** — RN-CIERRE-009 en `EstimacionSerializer` y
   `ConvenioModificatorioSerializer` (cierra el gap de Convenios de paso).
   **Completada** — con una precisión sobre el alcance: solo se bloquea
   **crear** (Estimaciones y Convenios) y **presentar** (Estimaciones) —
   no se bloquean acciones sobre algo ya presentado antes de que el
  contrato se congelara (aprobar/rechazar/firmar/actualizar la bandera de pago de una
   estimación, o aprobar/rechazar un convenio en borrador) porque la
   petición del usuario (§0, punto 2) habla explícitamente de "creación y
   pago de **nuevas** estimaciones" y "generación" de convenios — trabajo ya
   comprometido antes del cierre se deja completar. La excepción de
   RN-CIERRE-009 (estimación de liquidación) además **salta por completo**
   las reglas de ventana/FIFO (RN-EST-020/021) al presentar — son reglas
   pensadas para el ciclo mensual ordinario, que ya no aplica a un
   settlement final.
4. **Rescisión administrativa** — propuesta/notificar_inicio, alegatos,
   resolución, acta circunstanciada, balance de finiquito
   (`importe_neto_finiquito`), inhabilitación (RN-CIERRE-010) incluyendo
   los campos nuevos en `Contratista` y la validación en `ContractSerializer`.
   **Completada** (backend + frontend — ver §15/§16).
5. **Terminación anticipada** — solicitud (con o sin `suspension_origen`),
   resolución, afirmativa ficta informativa, mismo balance de finiquito
   que rescisión. **Completada** (backend + frontend — ver §17).
6. **Rescisión judicial** — la más ligera: solo captura del resultado ya
   resuelto + mismo balance de finiquito. **Completada** (backend +
   frontend — ver §18).
7. **Enganches** — nota automática en Bitácora, notificaciones (§8), banner
   en `contratos/[id]/page.tsx`, badge de inhabilitación. **Completada**
   (ver §19). Con esto el módulo queda completo.

---

## 11. Decisiones que tomé sin volver a preguntar (documentadas para revisión)

Dado que las 4 respuestas del usuario ya resolvieron las decisiones de
fondo, estas son llamadas de implementación más pequeñas que hice para que
el diseño cierre, siguiendo el mismo criterio de sesiones anteriores
(documentar en vez de bloquear el avance):

- **La excepción de RN-CIERRE-009** (permitir crear la estimación de
  liquidación aunque el contrato ya esté `en_cierre`) es necesaria para que
  el propio flujo de `terminacion_cumplimiento` sea completable — sin ella,
  el congelamiento se autobloquearía. Era la pieza más delicada de todo el
  diseño; **ya probada de verdad en la Fase 3** (§14) — funciona tanto para
  crear como para presentar (esta última además saltándose ventana/FIFO).
- **`fecha_notificacion_incumplimiento` como campo separado de
  `fecha_notificacion_inicio`** aunque en la práctica se llenen a la vez
  para rescisión administrativa — ver nota de implementación en §4.
- **Suspensión vive en la misma app `cierre`**, no en una app aparte —
  son 2 modelos pequeños y temáticamente relacionados (ambos son
  "alteraciones del ciclo de vida del contrato"), no amerita una 7ª app
  Django.
- **La inhabilitación se dispara solo al finiquitar** una rescisión con
  `se_rescinde=True` que sea la 3ª — no al momento de "resolver_rescision"
  (que es antes del finiquito) — porque el documento dice "3ª rescisión",
  y una rescisión no está consumada hasta que se finiquita.

---

## 12. Estado de verificación — Fase 1, Suspensión (2026-08-27)

`manage.py check` limpio, migración `cierre.0001_initial` generada y
aplicada. Verificado contra Docker real:

- Registrar una suspensión (`caso_fortuito`, contrato 5) → `201`,
  `dias_suspendidos` calculado en vivo contra hoy (fecha_fin `null`).
  `Contract.plazo_vigente_dias` subió exactamente esos días (380 → 406,
  sumado sobre los +15 que ya traía de un convenio aprobado — confirma que
  ambos sumandos conviven bien en la misma property).
- RN-CIERRE-012: segunda suspensión activa sobre el mismo contrato → `400`
  ("ya tiene una suspensión activa"); Superintendente intentando registrar
  → `403`.
- `marcar_indeterminada` → `200`, bandera activada.
- `resolver`: Dependencia (que no era quien la registró) pudo resolverla
  igual — confirma la parte "o Dependencia" de RN-CIERRE-012.
  `dias_suspendidos` quedó fijo en el valor real (24, no sigue creciendo con
  el tiempo) y `plazo_vigente_dias` del contrato bajó a 404 en consecuencia.
  Resolver una suspensión ya resuelta → `400`; editarla (`PATCH`) después de
  resuelta → `400` ("no se puede editar una suspensión ya resuelta").

Frontend: `tsc --noEmit`, `eslint` y `next build` limpios (0 errores) sobre
el proyecto completo — `/cierre` usa el mismo patrón `Suspense` en torno a
`useSearchParams()` que ya se necesitó para `/convenios`, aplicado desde el
primer intento de build (sin el ciclo de error-y-fix de esa vez).

---

## 13. Estado de verificación — Fase 2, fundacional + terminación por cumplimiento (2026-08-27)

`manage.py check` limpio, migración `cierre.0002_cierre_cierreevento`
generada y aplicada. `Contract.fondo_garantia_acumulado` y
`fondo_garantia_acumulado` en `ContractSerializer` — este último casi se
queda fuera del serializer igual que pasó con `monto_vigente` en la sesión
de Convenios; esta vez lo agregué de una vez, sin necesitar un segundo
round de "encontrado y corregido".

Verificado contra Docker real con un contrato de prueba nuevo
(`GACM-TEST-CIERRE`, catálogo/programa/bitácora mínimos, sin `Anticipo`):

- Residente intenta iniciar `terminacion_cumplimiento` → `400` (RN-CIERRE-002,
  solo Superintendente). Intentar `tipo=rescision_administrativa` → `400`
  ("no disponible todavía").
- Superintendente inicia `terminacion_cumplimiento` → `201`, `Contract.status`
  pasa a `en_cierre` de inmediato (confirmado con `GET /contratos/7/`).
- Intentar finiquitar sin acta ni estimación de liquidación → `400`
  (RN-CIERRE-008).
- Acta de entrega-recepción (Residente, multipart) y vínculo de la
  estimación de liquidación (Superintendente, una ya `firmada` de antemano)
  → ambos `200`, cada uno generó su `CierreEvento`.
- Finiquitar con los requisitos completos → `200`; `documento_finiquito` y
  `documento_acta_entrega` (mismo archivo de prueba subido dos veces)
  produjeron el **mismo** `hash_sha256` en ambos campos — confirma que el
  cálculo de hash por campo (`save()` con el loop sobre los 2 documentos)
  funciona independientemente para cada uno. `Contract.status` pasa a
  `cerrado`. Los 4 eventos (`iniciado`, `acta_entrega_recepcion`,
  `liquidacion_vinculada`, `finiquitado`) quedaron en el historial en orden.
- Intentar iniciar un segundo cierre sobre el contrato ya `cerrado` → `400`
  ("solo sobre un contrato activo").

**Nota sobre la excepción de RN-CIERRE-009 (§11)**: en esta prueba, la
estimación de liquidación se creó y firmó **antes** de iniciar el `Cierre`
(mientras el contrato todavía estaba `activo`), así que la excepción todavía
no se puso a prueba de verdad — no hay congelamiento en la Fase 2 del cual
exceptuar nada. Queda pendiente probarla en la Fase 3, cuando el
congelamiento exista y alguien intente crear la estimación de liquidación
*después* de que el contrato ya esté `en_cierre`.

Frontend: `tsc --noEmit`, `eslint` y `next build` limpios sobre el proyecto
completo. No se hizo prueba manual en navegador (ver limitación ya conocida
de la automatización de Chrome, documentada en `plan-estimaciones.md` §10).

---

## 14. Estado de verificación — Fase 3, congelamiento cruzado (2026-08-27)

`manage.py check` y `makemigrations --check` limpios — fase de solo lógica,
sin cambios de modelo. Verificado contra Docker real con un contrato de
prueba nuevo (`GACM-TEST-CONGEL`):

- Con el contrato todavía `activo`: crear una estimación funciona normal
  (regresión, sin cambios).
- Se inicia un `Cierre` (`terminacion_cumplimiento`) → `Contract.status`
  pasa a `en_cierre`.
- **Excepción probada de verdad**: con el cierre `en_proceso` y
  `estimacion_liquidacion` todavía sin vincular, crear una *nueva*
  estimación (mes 2) → `201` (permitido). En cuanto se vincula una
  estimación como liquidación (`vincular_liquidacion`), un tercer intento
  de crear otra estimación → `400` (la excepción ya no aplica, solo cubre
  "todavía no hay ninguna vinculada").
- Presentar una estimación **que no es** la de liquidación, con el contrato
  ya `en_cierre` → `400` (RN-CIERRE-009, mensaje específico distinto del de
  ventana).
- Presentar **la** estimación de liquidación con la ventana de presentación
  **cerrada a propósito** (`ventana_presentacion_abierta=False`, provocado
  moviendo `fecha_apertura` de la bitácora 200 días atrás) → `200` — confirma
  que la excepción salta RN-EST-020/021 por completo, no solo el chequeo de
  `contrato.status`. La nota automática de bitácora (RN-BIT-009) se generó
  igual, sin el `Bitacora.DoesNotExist` que se habría producido con el
  código anterior a este cambio (bug encontrado y corregido en el camino,
  ver §6 — el chequeo de existencia de bitácora ya no lo garantizaba el
  bloque de RN-EST-020 cuando se salta por la excepción).
- Crear un Convenio Modificatorio sobre el mismo contrato `en_cierre` →
  `400` (cierra el gap real que existía desde antes de este módulo).
  Regresión: crear un convenio sobre un contrato `activo` (5) → sigue
  funcionando igual que siempre.
- Smoke test final: listar `estimaciones/`, `documentos/convenios/`,
  `cierre/` y `cierre/suspensiones/` — los 4 responden `200`.

Sin cambios de frontend en esta fase (es lógica pura de backend) — no
requirió `tsc`/`eslint`/`next build`.

## 15. Estado de verificación — Fase 4, rescisión administrativa (2026-08-27)

`manage.py check` limpio, `makemigrations --check --dry-run` sin cambios
tras aplicar `cierre.0003_cierre_acta_circunstanciada_formato_and_more` y
`users.0002_contratista_fecha_fin_inhabilitacion_and_more`. Verificado
contra Docker real con 4 contratos de prueba nuevos, todos con el mismo
`contratista` (id=1, "Constructora Demo S.A. de C.V."):
`GACM-TEST-RESC-1..4` (ids 9-12).

**Flujo `propuesta` (Residente) vs. congelamiento (Dependencia):**
- Residente crea `Cierre(tipo=rescision_administrativa)` → `201`,
  `status="propuesta"`, `notificado_por`/`fecha_notificacion_inicio`/
  `fecha_notificacion_incumplimiento` todos `null`.
- Contrato **no** se congela con solo la propuesta: `GET /contratos/9/` →
  sigue `"activo"` — confirma que el congelamiento (RN-CIERRE-009) ocurre
  hasta `notificar_inicio`, no al crear.
- Superintendente intenta `notificar_inicio` → `403` (solo Dependencia,
  RN-CIERRE-002).
- `resolver_rescision` sobre una `propuesta` (antes de notificar) → `400`
  ("El cierre no está en proceso").
- Dependencia notifica el inicio → `200`, `status="en_proceso"`,
  `notificado_por`/`fecha_notificacion_inicio`/
  `fecha_notificacion_incumplimiento` poblados; `GET /contratos/9/` →
  ahora `"en_cierre"`.

**Alegatos y resolución (contrato 9, cierre 3):**
- Residente intenta capturar alegatos → `403` (solo Superintendente).
- Superintendente captura alegatos → `200`. Repetir → `400` ("Ya se
  capturaron los alegatos", RN-CIERRE-005).
- `resolver_rescision` sin alegatos y sin vencer el plazo de 15 días
  hábiles → `400` ("faltan los alegatos o no ha vencido su plazo").
- Dependencia resuelve `se_rescinde=true` → `200`, permanece `en_proceso`
  (no se descarta — sigue pendiente el acta circunstanciada y el
  finiquito). Contrato sigue `en_cierre`.
- `acta_circunstanciada` (ya con `se_rescinde=true`) → `200`, documento con
  hash calculado.
- `finiquitar` sin `monto_trabajos_ejecutados` → `400` (RN-CIERRE-008).
  Con montos (`monto_trabajos_ejecutados`, `monto_penas_convencionales`,
  `monto_gastos_no_recuperables`) y documento → `200`,
  `status="finiquitado"`; `GET /contratos/9/` → `"cerrado"`. Contratista
  sigue `inhabilitado=False` (es solo la 1ª rescisión finiquitada).

**Rama `descartar` (contrato 10, cierre 4):**
- Residente propone → Dependencia `descartar` (antes de notificar) →
  `200`, `status="descartado"`. Contrato nunca se congeló, sigue
  `"activo"` — confirma que no hay nada que revertir.
- Contrato 10 acepta una nueva propuesta inmediatamente después (el filtro
  de "ya tiene un cierre en curso" solo excluye `propuesta`/`en_proceso`).

**Rama `resolver_rescision(se_rescinde=false)` (contrato 10, cierre 5):**
- Notificado → alegatos capturados → Dependencia resuelve
  `se_rescinde=false` → `200`, pero a diferencia del caso afirmativo aquí
  **sí** se descarta automáticamente: `status="descartado"` y
  `GET /contratos/10/` vuelve a `"activo"` (el contrato se descongela).
  `finiquitar` sobre este cierre → `400` ("Solo se puede finiquitar un
  cierre en proceso") — confirma que la rama negativa cierra el flujo sin
  pasar por finiquito.

**Rama "plazo de alegatos vencido sin que se presentaran" (contrato 11,
cierre 6):** notificado → se retrasó `fecha_notificacion_inicio` 25 días
naturales vía shell (simulando el paso del tiempo, sin Celery/cron en el
alcance) para vencer el plazo de 15 días hábiles → `resolver_rescision`
**sin alegatos capturados** → `200` (permitido porque venció el plazo,
RN-CIERRE-005) → acta circunstanciada → finiquitar (`monto_trabajos_ejecutados=620000`,
`monto_penas_convencionales=8000`) → `200`, contrato 11 → `"cerrado"`.
Contratista sigue `inhabilitado=False` (2ª rescisión finiquitada, no la
3ª).

**RN-CIERRE-010 — inhabilitación en la 3ª rescisión (contrato 12, cierre
7):** ciclo completo propuesta → notificar → alegatos → `se_rescinde=true`
→ acta circunstanciada → finiquitar
(`monto_trabajos_ejecutados=300000`, `monto_penas_convencionales=20000`)
→ `200`. Verificado por shell: `Contratista.objects.get(pk=1)` ahora tiene
`inhabilitado=True`, `fecha_fin_inhabilitacion=2028-08-26` (730 días desde
hoy), `motivo_inhabilitacion="3ª rescisión administrativa finiquitada
(contrato GACM-TEST-RESC-4)."`, `inhabilitado_vigente=True` — confirma que
la 3ª finiquitada afirmativa (contando todos los contratos del mismo
contratista, no solo uno) dispara la inhabilitación automáticamente, y que
la 1ª y 2ª (arriba) correctamente no la dispararon.

**Enforcement real de la inhabilitación (`ContractSerializer`):** con el
contratista ya inhabilitado, `POST /api/contratos/` asignándole ese
contratista a un contrato nuevo → `400`,
`{"contratista": "Este contratista está inhabilitado para contratar hasta
2028-08-26."}` — confirma que el bloqueo no es solo informativo.

Sin cambios de frontend en esta fase (solo backend) — ver §16 para el
frontend, hecho por separado.

## 16. Frontend de la Fase 4 — rescisión administrativa (2026-08-27)

`tsc --noEmit`, `eslint` y `next build` (producción, Turbopack) limpios
contra Docker. **No se pudo probar en navegador real** — este entorno no
tiene una herramienta de automatización de navegador disponible; la
verificación se limitó a tipos/lint/build y a confirmar que cada
componente nuevo llama exactamente los mismos endpoints y payloads que ya
se probaron por curl en la verificación de backend (§15). Recomendado
que el usuario haga una pasada manual en el navegador antes de darlo por
completamente cerrado.

**`backend/users/serializers.py`**: `ContratistaSerializer` ahora expone
`inhabilitado`, `fecha_fin_inhabilitacion`, `motivo_inhabilitacion`
(read-only) e `inhabilitado_vigente` (`ReadOnlyField`) — antes no viajaban
al frontend. Verificado por curl tras reiniciar el contenedor: el
contratista inhabilitado en las pruebas de §15 (id=1) ahora sale con
`"inhabilitado_vigente":true` en `GET /api/actores/contratistas/`.

**`frontend/lib/types.ts`**: `Contratista` gana los 4 campos nuevos;
`Cierre` gana todos los campos de rescisión administrativa + los 4
`ReadOnlyField`s calculados (`fecha_limite_alegatos`,
`fecha_limite_resolucion_rescision`, `anticipo_no_amortizado`,
`importe_neto_finiquito`); `CierreEventoTipo` gana los 6 tipos de evento
nuevos.

**`frontend/lib/cierre-status.ts`**: `CIERRE_TIPOS_DISPONIBLES` ahora
incluye `rescision_administrativa`. Nuevo `CIERRE_TIPOS_POR_ROL` (mismo
mapeo que `roles_por_tipo` en `cierre/serializers.py`) para decidir qué
diálogo de creación mostrarle a cada rol.

**`frontend/components/contratos/entity-picker.tsx`**: `BaseEntity` gana
`inhabilitado_vigente`/`fecha_fin_inhabilitacion` opcionales (undefined
para `EmpresaSupervision`, que no los tiene — no rompe ese uso). Muestra
un badge destructivo "Inhabilitado" tanto en los resultados de búsqueda
como en la tarjeta de selección, con una advertencia de que el registro
será rechazado al guardar — el bloqueo real sigue siendo el de
`ContractSerializer.validate()` en el servidor, esto es solo UX
anticipada.

**`frontend/app/(dashboard)/cierre/page.tsx`**: `NuevoCierreDialog` se
generalizó (antes hardcodeaba `tipo="terminacion_cumplimiento"` y solo se
mostraba a Superintendente) para aceptar `tipo`/textos como props. Ahora
se instancia una vez por rol: Superintendente ve "Nueva terminación por
cumplimiento" (como antes), Residente ve "Proponer rescisión
administrativa" (explica que no congela el contrato todavía), Dependencia
ve "Iniciar rescisión administrativa" (explica que congela de inmediato).

**`frontend/app/(dashboard)/cierre/[id]/page.tsx`**: 5 componentes nuevos,
todos condicionados a `cierre.tipo === "rescision_administrativa"`:
- `PropuestaCard` (visible cuando `status === "propuesta"`): a
  Dependencia le muestra "Notificar inicio" y "Descartar" (con textarea de
  comentario opcional); a los demás roles, solo el estado de espera.
- `AlegatosCard` (visible una vez notificado — `fecha_notificacion_inicio
  !== null`): muestra `fecha_limite_alegatos` y si ya venció; a
  Superintendente le da el textarea de captura mientras no haya alegatos
  ni resolución.
- `ResolucionCard`: a Dependencia le da los botones "Rescindir"/"No
  rescindir", habilitados solo cuando hay alegatos capturados o venció su
  plazo (mismo criterio que el backend). Ya resuelto, muestra el
  resultado con badge.
- `ActaCircunstanciadaCard` (solo si `se_rescinde === true`): subida de
  documento para Residente/Dependencia, igual patrón que
  `ActaEntregaCard`.
- `FiniquitoBalanceCard` (solo si `se_rescinde === true`): checklist de
  requisitos (rescisión afirmativa + acta circunstanciada), muestra
  `anticipo_no_amortizado` siempre visible como referencia, y el form de
  finiquito para Dependencia con los 3 montos
  (`monto_trabajos_ejecutados` requerido, penas/gastos opcionales) + el
  documento. Una vez finiquitado, muestra el desglose completo incluyendo
  `importe_neto_finiquito`. Nombrado genérico (no
  `FiniquitoRescisionCard`) porque el modelo ya documenta que este balance
  es compartido por los 3 tipos que no usan `estimacion_liquidacion`
  (rescisión administrativa, terminación anticipada, rescisión judicial) —
  se reutilizará en las Fases 5/6 sin cambios.

Las 3 tarjetas originales (`ActaEntregaCard`/`LiquidacionCard`/
`FiniquitoCard`) ahora quedan condicionadas a `cierre.tipo ===
"terminacion_cumplimiento"` — antes se renderizaban sin condición alguna
porque ese era el único tipo que existía en el frontend.

`EVENTO_LABELS` (historial) ganó las etiquetas para los 6 tipos de evento
nuevos de `CierreEvento.Tipo`.

## 17. Estado de verificación — Fase 5, terminación anticipada (2026-08-27)

`manage.py check` limpio, `makemigrations --check --dry-run` sin cambios
tras aplicar `cierre.0004_cierre_suspension_origen_alter_cierreevento_tipo`
(agrega `suspension_origen` a `Cierre` y el choice `resolucion_terminacion`
a `CierreEvento.Tipo`). Verificado contra Docker real con 6 contratos de
prueba (`GACM-TEST-ANTIC-1..4`, ids 13-16, más 2 reutilizados para las
suspensiones, ids 15-16) y 2 contratistas distintos del usado en la Fase 4
(para no interferir con su inhabilitación ya disparada).

**Creación — roles y congelamiento inmediato:** Supervisión no puede crear
`terminacion_anticipada` → `403`. Residente y Superintendente sí pueden
(además de Dependencia, no re-probado por ser el mismo camino que
`terminacion_cumplimiento`) → `201`, `status="en_proceso"` **desde la
creación misma** (a diferencia de `rescision_administrativa`, no hay
`propuesta`) — `GET /contratos/13/` confirma `"en_cierre"` de inmediato,
sin acción intermedia.

**Rama `rechazar` (contrato 13, cierre 8):** Residente no puede rechazar
→ `403` (solo Dependencia). `alegatos` sobre este tipo → `400` limpio
("Solo aplica a rescisión administrativa" — confirma que las acciones de
`rescision_administrativa` no se cuelan por error). Dependencia rechaza →
`200`, `status="descartado"`; `GET /contratos/13/` vuelve a `"activo"`.
`finiquitar` después → `400` ("Solo se puede finiquitar un cierre en
proceso").

**Rama `aceptar` (contrato 14, cierre 9, creado por Superintendente):**
Dependencia acepta → `200`, `se_rescinde=true`, `fecha_resolucion`
poblada, `status` **sigue** `"en_proceso"` (aceptar no lo cambia — el
contrato solo se cierra al finiquitar). Aceptar de nuevo → `400` ("Ya se
resolvió"). Rechazar después de aceptar → `400` (mismo motivo). Finiquitar
sin monto → `400` (RN-CIERRE-008); con
`monto_trabajos_ejecutados=450000`/`monto_gastos_no_recuperables=30000` →
`200`, `status="finiquitado"`; contrato → `"cerrado"`. Confirmado por
shell que el contratista de este contrato **no** se inhabilita (RN-CIERRE-010
sigue correctamente acotado a `rescision_administrativa` en el código —
`finiquitar()` nunca cuenta este tipo en `total_rescisiones`).

**`suspension_origen` (RN-CIERRE-002):** se registró una `Suspension` en
el contrato 15 y se marcó `es_indeterminada=True`. Referenciarla desde una
`terminacion_anticipada` creada en el contrato **16** (distinto contrato)
→ `400` ("Debe pertenecer al mismo contrato"). Referenciarla desde una
`Suspension` **no** marcada indeterminada (contrato 16, otra suspensión) →
`400` ("La suspensión debe estar marcada como indeterminada"). Referenciarla
correctamente desde su propio contrato (15) con la bandera puesta → `201`,
`suspension_origen` queda vinculado.

**Afirmativa ficta (`aceptada_tacitamente`, contrato 15, cierre 10):** se
retrasó `fecha_notificacion_inicio` 20 días naturales vía shell (sin
Celery/cron, mismo patrón usado para simular tiempo en Fases 3 y 4).
`aceptada_tacitamente` pasa a `true` (confirmado tanto en la property
directamente como en el serializer vía `GET`). `rechazar` después de esto
→ `400` ("Vencieron los 15 días naturales — ya no se puede rechazar
(afirmativa ficta)."). **Pero `finiquitar` funciona directo sin haber
llamado `aceptar`** — confirma que la afirmativa ficta es puramente
informativa y no bloquea el único camino real hacia adelante (Dependencia
finiquitando es en sí misma la aceptación funcional). Contrato 15 →
`"cerrado"`.

**Frontend:** `tsc --noEmit`, `eslint` y `next build` (producción)
limpios. Un error real de `react-hooks/set-state-in-effect` apareció al
escribir el efecto que recarga las suspensiones indeterminadas del
contrato seleccionado en `NuevoCierreDialog` (`cierre/page.tsx`) — mismo
patrón de bug ya visto con `/convenios` en una fase anterior de la sesión,
corregido envolviendo el `setState` de limpieza en `setTimeout(..., 0)` en
vez de llamarlo síncronamente en el cuerpo del efecto. Sin poder probar en
navegador real (misma limitación de entorno que la Fase 4 — ver §16):
- `NuevoCierreDialog` ahora acepta `permiteSuspensionOrigen` — cuando está
  activo y hay un contrato seleccionado, carga sus suspensiones
  `activa && es_indeterminada` vía `/cierre/suspensiones/?contrato=`, y
  las ofrece en un `Select` opcional.
- Se agregó una instancia de "Solicitar terminación anticipada" visible a
  Residente, Dependencia y Superintendente (los 3 roles habilitados por
  RN-CIERRE-002).
- `[id]/page.tsx` ganó `ResolucionAnticipadaCard` (aceptar/rechazar para
  Dependencia, con el aviso de afirmativa ficta y el botón "Rechazar"
  deshabilitado cuando `aceptada_tacitamente` es `true`) y reutiliza
  `FiniquitoBalanceCard` sin cambios (su `requisitos` ya quedaba vacío
  para cualquier tipo que no fuera `rescision_administrativa`, así que se
  activa automáticamente en cuanto el cierre no está `descartado` — sin
  exigir haber llamado `aceptar` primero, igual que el backend).
- La tarjeta "Motivo" ahora muestra una nota de `suspension_origen` cuando
  aplica.

## 18. Estado de verificación — Fase 6, rescisión judicial (2026-08-28)

La fase más ligera del plan, tal como se anticipaba en §10 punto 6: sin
máquina de resolución (el hecho ya viene resuelto), sin propuesta, sin
alegatos — solo captura + acta circunstanciada (compartida con
`rescision_administrativa`) + el mismo `FiniquitoBalanceCard`/`finiquitar()`
genérico ya construido en la Fase 4.

`manage.py check` limpio tras un ajuste real encontrado en el camino: la
migración inicial fallaba con `fields.E009` porque `CierreEvento.tipo`
tenía `max_length=25` y el nuevo choice `resolucion_judicial_registrada`
mide 30 caracteres — se subió a `max_length=31`. `makemigrations --check
--dry-run` limpio tras aplicar
`cierre.0005_cierre_fecha_resolucion_judicial_and_more` (agrega
`fecha_resolucion_judicial`/`monto_resolucion_judicial` a `Cierre` y el
choice nuevo a `CierreEvento.Tipo`). Verificado contra Docker real con 3
contratos de prueba (`GACM-TEST-JUD-1..3`, ids 17-19).

**Creación (RN-CIERRE-002) — solo Dependencia, con el hecho ya resuelto:**
Residente intenta crear `rescision_judicial` → `400` ("Tu rol no puede
iniciar este tipo de cierre") — a diferencia de los permisos por acción
(`403`), este rechazo pasa por el `validate()` del serializer porque
`create` en el permiso de vista sigue siendo compartido por los 3 tipos
que sí puede crear alguien; el filtro fino es por `tipo`. Dependencia sin
`fecha_resolucion_judicial` → `400` ("Requerida — se registra el hecho ya
resuelto"). Con fecha futura (`2030-01-01`) → `400` ("No puede ser una
fecha futura") — confirma que de verdad se exige un hecho ya ocurrido, no
solo declarado. Sin `monto_resolucion_judicial` → `400` ("Requerido").
Con ambos capturados correctamente → `201`, `status="en_proceso"` **desde
la creación misma** (mismo patrón que `terminacion_anticipada`) y
`GET /contratos/17/` confirma `"en_cierre"` de inmediato.

**Evento distinto en el historial:** `GET /cierre/11/eventos/` confirma
`"tipo":"resolucion_judicial_registrada"` (no `"iniciado"`) — se decidió
en `perform_create()` loguear un evento semánticamente distinto para este
tipo, ya que la creación registra un hecho ya resuelto, no un "inicio".

**RN-CIERRE-006 extendida a judicial:** `finiquitar` sin
`documento_acta_circunstanciada` → `400` ("Falta el acta circunstanciada")
— este chequeo no existía para `rescision_judicial` antes de esta fase (la
condición previa solo cubría `RESCISION_ADMINISTRATIVA`); se agregó un
`elif` explícito en `finiquitar()`. Tras subir el acta vía
`acta_circunstanciada` (acción ya genérica desde la Fase 4, cero cambios
necesarios — su único chequeo especial ya estaba acotado a
`RESCISION_ADMINISTRATIVA`) → `200`. `finiquitar` con
`monto_trabajos_ejecutados=520000`/`monto_gastos_no_recuperables=12000` +
documento → `200`, `status="finiquitado"`; `GET /contratos/17/` →
`"cerrado"`. Confirmado por shell que el contratista de este contrato
**no** se inhabilita (RN-CIERRE-010 sigue acotada a
`RESCISION_ADMINISTRATIVA` en el código — decisión documentada: una
rescisión judicial es un resultado de litigio, no un patrón de
incumplimiento acreditado administrativamente, así que no cuenta para el
umbral de 3 rescisiones — el plan nunca pidió lo contrario, se mantiene
fiel a como quedó redactada RN-CIERRE-010 desde la Fase 4).

**Frontend:** `tsc --noEmit`, `eslint` y `next build` (producción)
limpios — sin bugs nuevos esta vez (a diferencia de Fases 4/5). Misma
limitación de entorno sin navegador real (ver §16).
- `NuevoCierreDialog` ganó `requiereResolucionJudicial` — cuando está
  activo, agrega dos campos obligatorios (`fecha_resolucion_judicial`
  tipo fecha, `monto_resolucion_judicial` tipo número) que gatean el botón
  "Registrar" además de motivo/contrato. Se instancia una vez, visible
  solo a Dependencia ("Registrar rescisión judicial").
- `[id]/page.tsx` ganó `ResolucionJudicialCard`, una tarjeta puramente de
  lectura (sin acciones — no hay nada que resolver, ya viene resuelto)
  mostrando la fecha y el monto capturados al crear.
- Reutiliza `ActaCircunstanciadaCard` y `FiniquitoBalanceCard` sin
  modificar sus componentes — solo se extendió el arreglo `requisitos`
  dentro de `FiniquitoBalanceCard` para incluir el checklist de "Acta
  circunstanciada registrada" también cuando `cierre.tipo ===
  "rescision_judicial"` (antes solo aplicaba a `rescision_administrativa`,
  dejando `rescision_judicial` con `requisitos` vacío — el botón de
  finiquitar habría aparecido habilitado sin la acta, dando un `400`
  confuso del backend; corregido antes de considerar la fase terminada).

## 19. Estado de verificación — Fase 7, enganches (2026-08-28)

Última fase del módulo — cierra los 3 puntos de §9 que quedaban sueltos:
Bitácora, Notificaciones, y el banner/badge del lado de Contratos. El
badge de inhabilitación de contratista ya se había hecho en la Fase 4
(`entity-picker.tsx`) al construir el flujo de rescisión administrativa —
no se repite aquí, solo se confirma que sigue vigente.

**Bitácora (RN-BIT-009-style):** `NotaBitacora` ganó un campo `cierre`
(FK nullable, mismo patrón que el `estimacion` ya existente — reutiliza el
`related_name="notas_bitacora"` porque apunta a un modelo distinto, sin
conflicto). Nuevo helper `_nota_bitacora_cierre()` en `cierre/views.py`,
con el mismo guard defensivo que `estimaciones/views.py` usa desde la Fase
3 (`contrato.fecha_inicio_obra is not None`, para no reventar con
`Bitacora.DoesNotExist` en un contrato sin bitácora todavía). Se llama en
2 puntos, tal como pide §3: al notificar el inicio (tanto en
`perform_create` para los tipos que congelan de inmediato, como en
`notificar_inicio` para rescisión administrativa) y al finiquitar.
Verificado contra Docker real con un contrato de prueba con bitácora
`abierta` (`GACM-TEST-F7-1`): tras notificar el inicio de una rescisión
administrativa, `NotaBitacora.objects.filter(cierre_id=X)` devuelve una
nota `clasificacion="cierre"`; tras finiquitar, una segunda. La
clasificación `cierre` ya existía en el enum desde antes de este módulo
(sin usarse) y el frontend ya la excluía de
`NOTA_CLASIFICACIONES_CAPTURABLES` — confirma que esto se anticipó en el
diseño original de Bitácora.

**Notificaciones:** `Notificacion.Tipo` ganó 7 valores nuevos (dividiendo
la fila "se registra/resuelve una Suspension" de §8 en dos tipos
separados, mismo criterio de granularidad que Estimaciones usa para
aprobada/rechazada). Los 6 puntos de disparo de la tabla §8, todos
verificados end-to-end contra Docker con notificaciones reales leídas vía
`GET /api/notificaciones/` para cada destinatario:
- Propuesta de rescisión administrativa → Dependencia.
- Inicio notificado (cualquier tipo) → Residente + Superintendente
  (verificado también para el camino donde Dependencia notifica una
  propuesta ya existente, no solo el de creación directa).
- Rescisión administrativa resuelta → Residente + Superintendente.
- Suspensión registrada/resuelta → Residente + Superintendente +
  Dependencia (probados por separado).
- Cierre finiquitado → Dependencia + Residente + Superintendente +
  Finanzas (los 4 confirmados con notificación real).
- Contratista inhabilitado (RN-CIERRE-010) → Dependencia únicamente —
  probado provocando una inhabilitación real de un segundo contratista
  (id=2, antes sin ninguna rescisión administrativa finiquitada) con 3
  ciclos completos nuevos, confirmando tanto `inhabilitado=True` como el
  mensaje de la notificación con la fecha correcta de vigencia.

**Frontend:**
- Banner en `contratos/[id]/page.tsx` (`Card` con `TriangleAlert`, texto
  distinto para `en_cierre` vs. `cerrado`, botón "Ver en Cierre y
  rescisión" enlazando a `/cierre?contrato={id}`) — mismo patrón visual
  que ya usaba `TabConvenios` para su enlace "Ver en Convenios".
- `NotaBitacora`/`Notificacion` en `lib/types.ts` y sus labels
  (`notificacion-tipo.ts`) actualizados con los campos/tipos nuevos.
- `tsc --noEmit`, `eslint` y `next build` (producción) limpios. Sin bugs
  nuevos esta fase. Misma limitación de entorno sin navegador real (ver
  §16) — no se pudo confirmar visualmente el banner ni la lista de
  notificaciones, solo por API y por tipos/build.

**Migraciones de esta fase**: `bitacora.0003_notabitacora_cierre`,
`notificaciones.0003_alter_notificacion_tipo` — ambas aplicadas y
confirmadas limpias (`manage.py check` + `makemigrations --check
--dry-run`).

Con esto, **el módulo de Cierre y Rescisión queda completo** (Fases 1-7).
Los recortes de alcance documentados en §2 siguen vigentes (sin litigio
real, sin FIEL, sin Celery/cron, sin calendario oficial de días festivos,
sin integración real con el órgano interno de control) — son límites de
diseño deliberados, no pendientes.
