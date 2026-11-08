# Plan de integración — Módulo de Estimaciones

> Basado en `estimacion_obra_lopsrm.md` (raíz del repo) y en el flujo de negocio
> específico de GACM descrito por el equipo. Este documento es la fuente de
> verdad del diseño del módulo hasta que se traduzca en modelos/código; se
> actualiza conforme se implementa cada fase.

**Estado:** Fases 1-8 completas — módulo terminado. La Fase 8 (ventana de
presentación, RN-EST-020/021) se desbloqueó con `docs/plan-bitacora.md`
(fases 1-4) y ya está implementada y probada contra el stack de Docker.
Además, RN-EST-022 (retención "cinco al millar", Art. 191 RLOPSRM) se
agregó tras revisar un proyecto de referencia externo — ver §9.2.
**Alcance actualizado:** no se generan órdenes de pago; Finanzas solo cambia
la bandera `Estimacion.pagada` entre pendiente y pagada. Última actualización:
2026-11-02.

---

## 1. Qué dice la LOPSRM vs. qué hace GACM

El documento de referencia describe el flujo *genérico* de la ley: el
"residente de obra" (representante del contratista) mide en campo junto al
"supervisor de obra" (representante de la dependencia), arma el número
generador, calcula la estimación, se la entrega al supervisor, y la
dependencia revisa/autoriza/paga.

GACM ya definió roles con nombres que **no calzan 1:1** con esa terminología
genérica (ver README). Tabla de equivalencia para no confundirse durante la
implementación:

| Rol en GACM | Quién es | Rol equivalente en el doc LOPSRM |
|---|---|---|
| **Superintendente** | Representante de la **Contratista** | "Residente de obra" (contratista) — mide, arma el generador, presenta |
| **Residente** | Designado por la **Dependencia** | "Supervisor de obra" (dependencia) — revisa/autoriza |
| **Supervisión** | Representante de la **Empresa de Supervisión** (tercero) | No evalúa ni puede rechazar la estimación; su única participación en el flujo es firmar (a diferencia del doc, donde el supervisor sí autoriza) |
| **Dependencia** | Organización gubernamental | La misma — autoridad final; solo se notifica del resultado (aprobación o rechazo), no firma ni evalúa |
| **Finanzas** | Registra si una estimación firmada ya fue pagada | No aparece en el doc; es un indicador interno del proyecto |

### Flujo de negocio que se implementa (definido por el equipo)

Este es el flujo **autoritativo** para GACM — sustituye al flujo genérico del
documento LOPSRM en cuanto al orden de actores, conservando su contenido legal
(números generadores, evidencias, deducciones):

```
1. Superintendente CAPTURA
   - Extrae del programa de obra del mes la cantidad trabajada por concepto
     (nunca más de lo pactado — ver §2.1, tope dinámico por convenio
     modificatorio)
   - Arma el número generador (opcional, detallado) o captura cantidad directa
   - Anexa evidencia fotográfica POR CONCEPTO (obligatoria)
   - PRESENTA la estimación (el orden FIFO de RN-EST-021 ya se valida al
     crearla, §4.1; la ventana de 6 días de RN-EST-020 sigue inactiva)
        ↓
2. Residente EVALÚA (único con poder de aprobar/rechazar)
   - Aprueba → sigue el flujo — Dependencia se notifica: "aprobada"
   - Rechaza (con motivo) → regresa a Superintendente para corrección —
     Dependencia se notifica: "rechazada". El Superintendente debe volver a
     presentar dentro de la ventana vigente; si no alcanza, queda como
     estimación faltante y se resuelve por FIFO en una ventana posterior
     (RN-EST-021)
        ↓
3. FIRMAN Residente + Superintendente + Supervisión
   - Supervisión no evalúa ni puede regresar la estimación a borrador — su
     revisión ocurre en el momento mismo de firmar
        ↓
4. Finanzas actualiza la bandera de pago (`pagada`: sí/no)
```

No hay una etapa separada de "verificación de Supervisión" ni de
"notificación automática tras Supervisión": la notificación a Dependencia
ocurre en cuanto el Residente decide (aprueba o rechaza), y Supervisión entra
al flujo únicamente como firmante.

Los plazos legales (15 días hábiles de revisión, 20 días naturales de pago) se
muestran como **alertas informativas**, no como bloqueos (RN-EST-017). Esto es
distinto de la ventana de presentación (RN-EST-020), que sí bloquea, pero está
inactiva hasta que exista el módulo de Bitácora (ver §4.1).

---

## 2. Jerarquía documental (se conserva del doc LOPSRM)

```
Catálogo de Conceptos (ya existe: ConceptoCatalogo)
         ↓
Programa de Obra (ya existe: ProgramaConceptoMes) — sugiere la cantidad del mes
         ↓
Número Generador (nuevo: GeneradorElemento) — medición N×L×A×H, opcional/detallado
         ↓
Estimación de Obra (nuevo: Estimacion + EstimacionConcepto) — cantidad × precio = cobro
         ↓
Evidencia fotográfica (nuevo: EvidenciaFotografica) — por concepto
         ↓
Indicador `pagada` en la estimación (sin entidad ni flujo de órdenes)
```

Los precios unitarios **nunca se toman en vivo del catálogo** al momento de
pagar — se congelan (snapshot) en `EstimacionConcepto.precio_unitario` al
crear la estimación, tal como indica el doc ("los precios unitarios son
inmodificables durante la ejecución del contrato").

### 2.1 Tope de cantidad y Convenio Modificatorio

Lo que el Superintendente puede reportar como `cantidad_ejecutada` nunca puede
hacer que la cantidad acumulada de un concepto rebase lo pactado
originalmente — **a menos que exista un Convenio Modificatorio aprobado** que
amplíe esa cantidad. Para eso:

- **Nuevos modelos, en la app `documentos`** (no en `contracts` como se
  pensó originalmente: `ConvenioModificatorioConcepto.concepto` apunta a
  `ConceptoCatalogo`, que ya vive en `documentos` y depende de
  `contracts.Contract` — ponerlos en `contracts` hubiera creado un import
  circular entre las dos apps. Conceptualmente sigue siendo "una
  modificación del contrato", mismo criterio que `Garantia`/`Anticipo`):
  - `ConvenioModificatorio`: `contrato` FK, `numero` consecutivo, `tipo`
    (`ampliacion_cantidad` / `ampliacion_monto` / `ampliacion_plazo` /
    `mixto`), `justificacion`, `monto_delta` (decimal, +/-, default 0) y
    `dias_delta` (int, +/-, default 0) — **agregados 2026-08-27**, ver nota
    abajo —, `documento` (mismo patrón hash/tamaño/formato que
    `ContractDocument`), `status` (`borrador` / `aprobado` / `rechazado`),
    `motivo_rechazo` (agregado junto con los deltas), `creado_por`,
    `aprobado_por`, `fecha_aprobacion`.
  - `ConvenioModificatorioConcepto`: `convenio` FK, `concepto` FK,
    `cantidad_delta` (decimal, puede ser positivo o negativo),
    `unique_together(convenio, concepto)`.
- **Propiedades calculadas**:
  - En `ConceptoCatalogo`: `cantidad_vigente = cantidad + Σ(cantidad_delta
    de convenios con status aprobado)`.
  - En `Contract` (agregadas junto con los deltas, mismo patrón):
    `monto_vigente = monto + Σ(monto_delta de convenios aprobados)`,
    `plazo_vigente_dias = plazo_dias + Σ(dias_delta de convenios aprobados)`,
    `fecha_termino_vigente = fecha_inicio + plazo_vigente_dias`.
- **Residente o Dependencia capturan** el convenio y su detalle (mientras
  está en `borrador`); **solo Dependencia aprueba o rechaza** (autoridad
  contractual, acciones `aprobar`/`rechazar`, RN-CONV-001/003);
  Superintendente/Supervisión tienen acceso de solo lectura. No requiere una
  máquina de estados ni bitácora de eventos propia para el MVP — basta el
  campo `status` + `aprobado_por` + `fecha_aprobacion` (o `motivo_rechazo`
  si se rechaza).

**Nota (2026-08-27, tras revisar el proyecto de referencia externo
`Sistema_de_contratos`):** al implementarse originalmente, `tipo` incluía
`ampliacion_monto`/`ampliacion_plazo`/`mixto` como opciones **sin ningún
campo donde capturar el monto o los días reales** — un convenio de ese tipo
existía pero no podía tener efecto en ningún lado. Se cerró agregando
`monto_delta`/`dias_delta` (mismo criterio que `cantidad_delta`: valor con
signo, permanente al aprobarse, RN-CONV-002) y sus propiedades espejo en
`Contract`. De paso se encontraron y corrigieron dos gaps reales en el
código ya existente, no relacionados con el proyecto de referencia:
- `aprobar()` exigía `conceptos.exists()` **incondicionalmente** — habría
  bloqueado para siempre cualquier convenio de monto/plazo puro (sin
  conceptos que capturar). Ahora la exigencia de contenido depende de
  `tipo` (RN-CONV-004).
- `ConvenioModificatorioStatus.RECHAZADO` existía como valor del enum desde
  el diseño original pero **no había ninguna acción que lo alcanzara** (solo
  `aprobar` existía). Se agregó `rechazar` (RN-CONV-003), con notificación
  a Residente/Superintendente (`Notificacion.Tipo.CONVENIO_RECHAZADO`).

**Decisiones tomadas sin preguntar al usuario, documentadas aquí:**
- A diferencia de Estimaciones, un convenio rechazado **no vuelve a
  `borrador`** — es terminal. Convenios no tiene la restricción FIFO que
  motiva ese diseño en Estimaciones (RN-EST-021); para reintentar se crea
  un convenio nuevo (número consecutivo).
- No se agregó un campo `rechazado_por`/`fecha_rechazo` paralelo a
  `aprobado_por`/`fecha_aprobacion` — se consideró innecesario para el MVP
  (el `motivo_rechazo` + la notificación ya dejan rastro de qué pasó;
  "quién y cuándo" solo viviría en los logs de auditoría si se implementa
  ese módulo).
- Se decidió **no** adoptar del proyecto de referencia: subida de múltiples
  archivos por convenio (GACM ya tiene un solo `documento`, suficiente para
  el alcance académico) ni una máquina de estados de 6 pasos (contradice la
  decisión ya documentada arriba de que "no requiere máquina de estados
  para el MVP").

---

## 3. Modelos (app nueva: `estimaciones`)

### `Estimacion`

| Campo | Tipo | Notas |
|---|---|---|
| `contrato` | FK → Contract | debe estar `activo` (RN-EST-001) |
| `numero` | int | consecutivo por contrato, autogenerado (RN-EST-002) |
| `mes_programa` | int | referencia al mes de `ProgramaConceptoMes` que se está cobrando |
| `periodo_inicio`, `periodo_fin` | date | período de ejecución que cubre; `periodo_fin` es la fecha de corte (§4.1). **Calculados por el sistema, no los captura el Superintendente** — ver nota de implementación en §4.1 |
| `status` | choices | ver máquina de estados §4 |
| `iva_tasa` | decimal | default 16.00, informativo |
| `porcentaje_fondo_garantia` | decimal | default 5.00 (RN-EST-016) |
| `porcentaje_cinco_al_millar` | decimal | default 0.50, informativo — retención de inspección, control y vigilancia (RN-EST-022) |
| `penalizaciones` | decimal | default 0, captura manual del Residente |
| `motivo_penalizacion` | text | blank |
| `otras_deducciones` | decimal | default 0 |
| `motivo_otras_deducciones` | text | blank |
| `motivo_rechazo` | text | último motivo de rechazo, blank |
| `creado_por` | FK → User | Superintendente que la creó |
| `pagada` | boolean | Finanzas indica si la estimación firmada ya fue pagada; default `False` |
| `fecha_presentacion`, `fecha_decision_residente`, `fecha_notificacion_dependencia`, `fecha_firma_completa` | datetime, null | timestamps del flujo de revisión y firma |

Propiedades calculadas (no almacenadas, como `Garantia.estado` o
`Anticipo.saldo_pendiente`):
- `subtotal` = Σ `EstimacionConcepto.importe`
- `iva` = `subtotal × iva_tasa / 100`
- `importe_bruto` = `subtotal + iva`
- `amortizacion_anticipo` = `min(importe_bruto × Anticipo.porcentaje_retencion_por_estimacion / 100, Anticipo.saldo_pendiente)` si el contrato tiene `Anticipo`, si no 0
- `fondo_garantia` = `importe_bruto × porcentaje_fondo_garantia / 100`
- `retencion_cinco_al_millar` = `importe_bruto × porcentaje_cinco_al_millar / 100` (RN-EST-022)
- `importe_neto` = `max(0, importe_bruto - amortizacion_anticipo - fondo_garantia - retencion_cinco_al_millar - penalizaciones - otras_deducciones)` (RN-EST-014)
- `dias_habiles_revision_restantes` / `dias_pago_restantes`: informativos (RN-EST-017)

### `EstimacionConcepto`

Cuerpo de la estimación (el cuadro de cantidades y precios del doc, §5.B).

| Campo | Tipo | Notas |
|---|---|---|
| `estimacion` | FK | — |
| `concepto` | FK → ConceptoCatalogo | `unique_together` con `estimacion` |
| `cantidad_acumulada_anterior` | decimal | snapshot: Σ `cantidad_ejecutada` de estimaciones previas *aprobadas* de este concepto, calculado al crear |
| `cantidad_ejecutada` | decimal | cantidad reportada este período; sugerida = `ProgramaConceptoMes.cantidad_programada` del `mes_programa`, editable |
| `precio_unitario` | decimal | snapshot de `concepto.precio_unitario` al crear (RN-EST-004) |
| `importe` | decimal | calculado, `cantidad_ejecutada × precio_unitario` |

Calculadas: `cantidad_acumulada = cantidad_acumulada_anterior + cantidad_ejecutada`;
`cantidad_pendiente = concepto.cantidad_vigente - cantidad_acumulada` (nunca
negativa, ver RN-EST-003 — `cantidad_vigente` incluye convenios modificatorios
aprobados, §2.1).

### `GeneradorElemento` (número generador — opcional/detallado)

Desglose de la medición de un `EstimacionConcepto`, tabla del doc §2.

| Campo | Tipo | Notas |
|---|---|---|
| `estimacion_concepto` | FK | — |
| `elemento` | char | eje, tramo, nivel |
| `cantidad_n` | decimal | repeticiones, default 1 |
| `largo`, `ancho`, `alto` | decimal, null | dimensiones; null se trata como 1 en el cálculo (conceptos por pieza no usan las 3) |
| `parcial` | decimal | calculado = `N × largo × ancho × alto` |
| `observaciones` | text | ref. a plano/croquis |
| `orden` | int | orden de captura |

Si un `EstimacionConcepto` tiene filas de generador, `cantidad_ejecutada` se
recalcula como `Σ parcial` (fuente de verdad pasa al generador). Si no tiene
ninguna, `cantidad_ejecutada` se captura directo — el generador detallado es
**recomendado, no obligatorio**, dado el alcance académico.

### `EvidenciaFotografica`

Por concepto, tal como pidió el equipo — no por estimación completa. No se
maneja ubicación/geolocalización.

| Campo | Tipo | Notas |
|---|---|---|
| `estimacion_concepto` | FK | — |
| `imagen` | FileField | mismo patrón que `ContractDocument`: hash, tamaño, formato calculados en `save()` |
| `momento` | choices | `antes` / `durante` / `despues` (buena práctica #3 del doc), opcional |
| `subido_por` | FK → User | |
| `ip_origen` | GenericIPAddress, null | mismo patrón que documentos |
| `fecha_carga` | datetime auto | |

### `EstimacionEvento` (bitácora de flujo)

Un registro por cada transición de estado — auditoría, y reutilizable por el
futuro módulo de Auditoría.

| Campo | Tipo | Notas |
|---|---|---|
| `estimacion` | FK | |
| `tipo` | choices | `presentada`, `aprobada_residente`, `rechazada_residente`, `firmada` |
| `actor` | FK → User | |
| `comentario` | text, blank | motivo de rechazo u otra nota |
| `fecha` | datetime auto | |

La notificación a Dependencia **no es un tipo de evento aparte** — es un
efecto automático de `aprobada_residente` / `rechazada_residente`
(RN-EST-011); Dependencia solo lee esos eventos, no firma ni actúa sobre
ellos.

### `Firma`

Tabla flexible en vez de columnas fijas — permite ajustar quién firma sin
migrar el esquema.

| Campo | Tipo | Notas |
|---|---|---|
| `estimacion` | FK | |
| `firmante` | FK → User | |
| `rol` | char | snapshot del rol al firmar |
| `fecha_firma` | datetime auto | |

`unique_together = (estimacion, firmante)`. La estimación pasa a `firmada`
cuando existen firmas de **Residente, Superintendente y Supervisión**
asignados a ese contrato (RN-EST-012).

---

## 4. Máquina de estados de `Estimacion.status`

```
borrador
   → presentada                [Superintendente, requiere RN-EST-005/006;
                                 requiere ventana FIFO abierta cuando
                                 RN-EST-020/021 esté activa — ver §4.1]
        → en_revision_residente        (automático al presentar)
             → rechazada_residente → borrador   [Residente, requiere motivo]
                    ⤷ notifica a Dependencia: "rechazada" (RN-EST-011)
             → aprobada_residente
                    ⤷ notifica a Dependencia: "aprobada" (RN-EST-011)
                  → pendiente_firma              (automático)
                       → firmada   (cuando firmaron Residente + Superintendente + Supervisión)
```

              El estado de la estimación permanece `firmada`; Finanzas solo actualiza la
              bandera `pagada`, sin crear una orden de pago ni cambiar el estado.

Cada flecha genera un `EstimacionEvento`. Un rechazo limpia
`cantidad_ejecutada`/evidencias **no** — se conservan para que el
Superintendente corrija sobre lo ya capturado, no desde cero.

Ya no existen los estados `en_verificacion_supervision`,
`observada_supervision`, `verificada_supervision` ni `dependencia_notificada`
del diseño anterior: Supervisión no evalúa, y la notificación a Dependencia es
un efecto de la decisión del Residente, no un estado propio.

### 4.1 Ventana de presentación (activa — Fase 8 completada 2026-08-27)

RN-EST-020/021 son dos reglas con dependencias distintas, y se separaron en
la implementación:

- **RN-EST-021 (FIFO, sin huecos ni duplicados)**: en fase 1 se validaba al
  **crear** la estimación (no existía todavía `presentar()`). En la Fase 8 se
  **reubicó a `presentar()`**, contra estimaciones *presentadas* (cualquier
  `status != borrador`) en vez de *creadas*: ahora se puede crear/capturar
  cualquier mes por adelantado (sin importar el orden), pero solo se puede
  **presentar** el mes más antiguo que todavía no se haya presentado con
  éxito (`_mes_mas_antiguo_pendiente()` en `estimaciones/views.py`) — esto
  cubre también la re-presentación tras rechazo, porque una estimación
  rechazada vuelve a `status=borrador` y por lo tanto vuelve a contar como
  "pendiente". La unicidad (nunca dos estimaciones para el mismo mes) se
  quedó como la única validación de `mes_programa` en el serializer de
  creación.
- **RN-EST-020 (ventana de 6 días tras la fecha de corte)**: implementada
  como propiedades de `Contract` (`fecha_inicio_obra`, `mes_obra_actual`,
  `fecha_corte(mes)`, `ventana_presentacion_abierta` — ver
  `contracts/models.py`), todas derivadas de `contrato.bitacora.fecha_apertura`
  (§7 de `plan-bitacora.md`). `presentar()` exige que la ventana esté abierta
  **y** que el contrato tenga bitácora — si no tiene bitácora todavía,
  `fecha_inicio_obra` es `None` y se bloquea con un mensaje explícito
  distinto ("no tiene bitácora abierta"), no con el mensaje genérico de
  "fuera de ventana". Esta fue una decisión de diseño tomada al implementar
  (no estaba en el plan original, que asumía Bitácora como hipotético): se
  optó por bloquear duro en vez de omitir el chequeo, siguiendo el mismo
  criterio que ya usan RN-EST-005/006 en la misma función — es la lectura
  más fiel a que la bitácora es obligatoria por ley (Art. 46 LOPSRM) para
  toda obra pública federal.

**Periodo de la estimación:** `periodo_inicio`/`periodo_fin` de cada
`Estimacion` se calculan automáticamente al crearla (nunca los captura el
Superintendente a mano): `periodo_inicio = fecha_base + (mes_programa-1)×30
días`, `periodo_fin = fecha_base + mes_programa×30 − 1 días`. Misma
convención de "mes de 30 días" que `ProgramaConceptoMes.clean()`.
`fecha_base` es `contrato.bitacora.fecha_apertura` cuando el contrato ya
tiene bitácora abierta, y cae a `contrato.fecha_inicio` si todavía no la
tiene (verificado con ambos casos — ver `plan-bitacora.md` §11, Fase 4).
Además, al presentar una estimación con bitácora abierta se genera
automáticamente una nota de tipo `avance` en esa bitácora (RN-BIT-009) — ya
no depende de que el Residente la registre a mano, como pedía el manual
LOPSRM §4.1.

**Regla de ventana/FIFO implementada** (Fase 8, verificada contra Docker
real — ver §10):

- `Contract.fecha_inicio_obra` (property) = `contrato.bitacora.fecha_apertura`,
  o `None` si el contrato no tiene bitácora.
- `Contract.mes_obra_actual` = meses completos transcurridos desde
  `fecha_inicio_obra` (`None` si no hay bitácora).
- `Contract.fecha_corte(n)` = `fecha_inicio_obra + n×30 días`.
- `Contract.ventana_presentacion_abierta` = `True` si hoy está entre
  `fecha_corte(mes_obra_actual)` (exclusivo) y
  `fecha_corte(mes_obra_actual) + 6 días naturales` (inclusivo); `False` si
  no hay bitácora.
- **FIFO estricto**: en cualquier momento, solo es presentable el **mes más
  antiguo sin presentar** de ese contrato (`_mes_mas_antiguo_pendiente()`) —
  nunca se puede presentar el mes en curso (ni uno futuro) si hay un mes
  anterior pendiente. Si ese mes más antiguo no es el mes en curso (quedó
  como faltante de una ventana pasada), igual es presentable mientras la
  ventana esté abierta — así se "pone al día" el atraso dentro de la misma
  apertura, respetando siempre el orden (verificado: mes 1, 2 y 3 presentados
  uno tras otro en la misma ventana).
- Fuera de la ventana abierta, ninguna estimación es presentable, ni la del
  mes en curso ni las faltantes; deben esperar a la siguiente apertura
  (verificado con una bitácora cuya ventana ya había cerrado).
- Esto también rige la re-presentación tras un rechazo: al volver a
  `borrador`, una estimación rechazada cuenta de nuevo como "pendiente" para
  `_mes_mas_antiguo_pendiente()`, sin necesitar lógica especial.

---

## 5. Reglas de negocio (RN-EST-xxx)

> Se usa el prefijo `RN-EST-` (en vez de continuar la numeración `RN-030`
> vista en `documentos/`) porque no tenemos visibilidad del catálogo completo
> de reglas numeradas del proyecto original — evita colisiones. Las reglas de
> Convenio Modificatorio usan el prefijo `RN-CONV-` porque, aunque su modelo
> vive en `documentos` (§2.1), la regla conceptualmente es del contrato, no
> del catálogo — se mantiene el prefijo `RN-CONV-` en vez de `RN-EST-`.

| # | Regla |
|---|---|
| RN-EST-001 | Una estimación solo puede crearse sobre un contrato en estado `activo`. |
| RN-EST-002 | El número de estimación es consecutivo y único por contrato, autogenerado. |
| RN-EST-003 | `cantidad_acumulada` de un concepto no puede exceder `ConceptoCatalogo.cantidad_vigente` (cantidad original + convenios modificatorios aprobados, §2.1) — no se puede rebasar lo pactado. |
| RN-EST-004 | El precio unitario de cada concepto se congela (snapshot) al crear la estimación; cambios posteriores al catálogo no la afectan. |
| RN-EST-005 | Una estimación necesita al menos un concepto con `cantidad_ejecutada > 0` para poder presentarse. |
| RN-EST-006 | Cada concepto reportado debe tener **al menos una evidencia fotográfica** antes de poder presentar la estimación. |
| RN-EST-007 | Solo el Superintendente asignado al contrato puede crear/editar/presentar sus estimaciones. |
| RN-EST-008 | Una vez presentada, es de solo lectura para el Superintendente hasta que sea rechazada (regresa a `borrador`) o concluya el ciclo — salvo la acción de firmar en la etapa `pendiente_firma`. |
| RN-EST-009 | Solo el Residente asignado al contrato puede aprobar/rechazar (alcance por asignación, no solo por rol). Supervisión **no** tiene poder de aprobar/rechazar — su única acción en el flujo es firmar, también sujeta a asignación. |
| RN-EST-010 | El rechazo requiere motivo (texto obligatorio) y regresa la estimación a `borrador`. Solo el Residente puede rechazar. |
| RN-EST-011 | La notificación a Dependencia es automática y ocurre en el momento de la decisión del Residente (aprobación o rechazo) — Dependencia no evalúa ni firma, solo se entera del resultado. |
| RN-EST-012 | La firma requiere Residente, Superintendente y Supervisión asignados; pasa a `firmada` solo con las **tres** firmas. |
| RN-EST-013 | Solo Finanzas puede cambiar `pagada` en una estimación `firmada`; no se modelan órdenes de pago. |
| RN-EST-014 | `importe_neto` nunca es negativo; si las deducciones exceden el bruto se trunca a 0 y se marca alerta visual. |
| RN-EST-015 | La amortización de anticipo se calcula automáticamente contra `Anticipo.porcentaje_retencion_por_estimacion`, topada al `saldo_pendiente`; al firmarse, incrementa `Anticipo.monto_amortizado`. |
| RN-EST-016 | El fondo de garantía (5% por defecto, configurable por contrato) se acumula pero no se libera hasta el cierre/finiquito (módulo Cierre y Rescisión, fuera de este alcance). |
| RN-EST-017 | Los plazos de 15 días hábiles (revisión) y 20 días naturales (pago) se muestran como alertas informativas, no bloquean el flujo. Distinto de RN-EST-020, que sí bloquea. |
| RN-EST-018 | Todo cambio de estado se registra en `EstimacionEvento` (actor, fecha, comentario). |
| RN-EST-019 | El alcance por asignación aplica a escritura, no solo a lectura: cada acción valida que `estimacion.contrato` esté dentro del queryset scoped del usuario — corrige desde el diseño el hueco de scoping en escritura ya detectado en `documentos/`. |
| RN-EST-020 | Una estimación solo puede presentarse (o re-presentarse tras rechazo) dentro de la ventana de 6 días naturales posteriores a la fecha de corte del mes en curso del contrato. **Activa** (§4.1) — requiere que el contrato tenga bitácora abierta; si no la tiene, `presentar()` se bloquea con un mensaje distinto al de "fuera de ventana". |
| RN-EST-021 | No se puede **presentar** la estimación de un mes si la de un mes anterior de ese contrato no se ha presentado todavía (FIFO estricto sobre presentaciones, no sobre creación — reubicado en la Fase 8, §4.1), ni duplicar un mes ya usado al **crear** (unicidad, sin relación con el orden). **Activa.** |
| RN-EST-022 | Cada estimación retiene el "cinco al millar" (Art. 191 RLOPSRM — derecho federal por servicios de inspección, control y vigilancia): `importe_bruto × porcentaje_cinco_al_millar / 100`, tasa configurable por estimación (default 0.50%), se resta en `importe_neto` igual que `fondo_garantia`. No se modela como una segunda retención separada — ver §9.2 (decisión al implementar). |
| RN-CONV-001 | Un Convenio Modificatorio solo lo aprueba Dependencia; mientras esté en `borrador` no afecta `cantidad_vigente`/`monto_vigente`/`plazo_vigente_dias`. |
| RN-CONV-002 | Al aprobarse, `ConvenioModificatorioConcepto.cantidad_delta`, `monto_delta` y `dias_delta` se suman de forma permanente a `cantidad_vigente`/`monto_vigente`/`plazo_vigente_dias`; no es reversible desde la app (requeriría otro convenio compensatorio). |
| RN-CONV-003 | Solo Dependencia rechaza (mismo criterio que RN-CONV-001); requiere motivo obligatorio; es un estado **terminal** — no regresa a `borrador` (a diferencia de Estimaciones, que no tiene la restricción FIFO que motiva ese diseño ahí). Notifica a Residente y Superintendente. |
| RN-CONV-004 | Para aprobar, el convenio debe tener contenido real según su `tipo` declarado: conceptos capturados si incluye ampliación de cantidad, `monto_delta≠0` si incluye ampliación de monto, `dias_delta≠0` si incluye ampliación de plazo (`mixto` exige los tres). |
| RN-CONV-005 | Un convenio (encabezado y conceptos) solo es editable mientras está en `borrador`. |

---

## 6. API (nueva app `estimaciones`, prefijo `/api/estimaciones/`)

```
estimaciones/                          list, create (Superintendente), retrieve (ALL_ROLES scoped)
estimaciones/{id}/presentar/           POST — Superintendente
estimaciones/{id}/aprobar_residente/   POST — Residente
estimaciones/{id}/rechazar_residente/  POST {motivo} — Residente
estimaciones/{id}/firmar/              POST — Residente, Superintendente o Supervisión (marca su propia firma)
estimaciones/{id}/eventos/             GET — historial (ALL_ROLES scoped, incluye Dependencia)

conceptos/?estimacion={id}             list, create, update — captura de cantidad_ejecutada
generador/?estimacion_concepto={id}    list, create, update, delete — filas N×L×A×H
evidencias/?estimacion_concepto={id}   list, create (multipart) — solo fotos, sin ubicación
estimaciones/{id}/pago/                PATCH {pagada} — Finanzas, solo si está firmada
```

Ya no hay acciones `verificar_supervision/` ni `observar_supervision/` — se
eliminaron junto con el gate de Supervisión.

El Convenio Modificatorio vive en la app `documentos`
(`/api/documentos/convenios/`, `/api/documentos/convenio-conceptos/`, acción
`convenios/{id}/aprobar/`), fuera del prefijo de Estimaciones, igual que
`Garantia`/`Anticipo` (ver §2.1 para el porqué de vivir ahí y no en
`contracts`).

Todos los ViewSets heredan `ContratoScopedMixin` (o una variante que resuelva
`contrato` vía `estimacion__contrato` / `estimacion_concepto__estimacion__contrato`
según el modelo), igual que `documentos/`, y las acciones de transición
validan el rol **y** la asignación antes de permitir el cambio (RN-EST-019).

---

## 7. Frontend

- `app/(dashboard)/estimaciones/page.tsx` — lista de estimaciones (reemplaza el `ComingSoon` actual), filtrable por contrato/status.
- `app/(dashboard)/estimaciones/[id]/page.tsx` — detalle con tabs:
  - **Cuadro de cantidades** — captura `cantidad_ejecutada` por concepto, con la cantidad programada del mes como sugerencia/placeholder (reutiliza el patrón de `tab-programa.tsx`).
  - **Generadores** — desglose N×L×A×H opcional por concepto.
  - **Evidencias** — subida de fotos por concepto, sin captura de ubicación.
  - **Resumen de importes** — subtotal, IVA, deducciones, importe neto (patrón de tarjetas como `formatMoney`).
  - **Pago** — indicador Pagada/Pendiente; Finanzas puede cambiarlo cuando la estimación está firmada.
  - **Historial** — timeline de `EstimacionEvento`, incluye los eventos de notificación implícitos a Dependencia (aprobada/rechazada) y las firmas de las tres partes.
- Barra de acciones de flujo condicionada por `me.role` + `estimacion.status` (mismo patrón que `ActivarContratoButton` en `contratos/[id]/page.tsx`): Residente ve aprobar/rechazar en `en_revision_residente`; Residente, Superintendente y Supervisión ven "Firmar" en `pendiente_firma`; Dependencia solo ve el historial, sin acciones.
- Badges de status con `STATUS_LABELS`/`STATUS_VARIANTS` — extender el patrón de `lib/contract-status.ts` con un `lib/estimacion-status.ts` análogo.
- Convenios Modificatorios (fuera del alcance de Estimaciones): **módulo propio**
  `app/(dashboard)/convenios/` (lista + `[id]` detalle), mismo patrón que
  Estimaciones/Bitácora — no una pestaña dentro del contrato. Rediseñado
  2026-08-27: originalmente vivía como tab en `contratos/[id]/page.tsx`
  (`tab-convenios.tsx`), pero al crecer (monto/plazo, rechazo) dejó de tener
  sentido como anexo pequeño. `contratos/[id]/page.tsx` conserva una pestaña
  "Convenios" de **solo lectura** (monto/plazo vigente vs. original + lista
  compacta de los convenios de ese contrato) con un botón "Ver en Convenios"
  que enlaza a `/convenios?contrato={id}`; toda la captura/aprobación/rechazo
  vive en el módulo nuevo. Etiquetas de tipo/estatus centralizadas en
  `lib/convenio-status.ts` (mismo patrón que `lib/estimacion-status.ts`).

---

## 8. Fases de implementación sugeridas

1. **Fundacional** — modelos, migraciones, permisos base, `EstimacionConcepto` con sugerencia desde el programa, periodo calculado automáticamente y orden FIFO (RN-EST-021) al crear. Sin fotos ni generador. CRUD + lista/detalle simples. **Completada.**
2. **Número generador** — `GeneradorElemento`, cálculo automático de `cantidad_ejecutada` cuando hay filas. **Completada.**
3. **Evidencia fotográfica** — `EvidenciaFotografica` + RN-EST-006 bloqueando la presentación sin fotos. **Completada.**
4. **Flujo de estados** — presentar → Residente aprueba/rechaza → notificación a Dependencia → firma (Residente + Superintendente + Supervisión), con `EstimacionEvento` y `Firma`. **Completada.**
5. **Convenio Modificatorio** — `ConvenioModificatorio`/`ConvenioModificatorioConcepto` en `documentos`, `cantidad_vigente` en `ConceptoCatalogo`, ajuste de RN-EST-003. **Completada.**
6. **Deducciones** — anticipo, fondo de garantía, penalizaciones, importe neto; integración con `Anticipo.monto_amortizado`.
7. **Pago como bandera** — `Estimacion.pagada` editable por Finanzas al terminar las firmas; sin folio, referencia bancaria ni entidad de orden.
8. **Ventana de presentación (RN-EST-020)** — **Completada.** El módulo Bitácora (fases 1-4, ver `docs/plan-bitacora.md`) provee `contrato.bitacora.fecha_apertura`; `Contract` gana las propiedades `fecha_inicio_obra`/`mes_obra_actual`/`fecha_corte()`/`ventana_presentacion_abierta` (§4.1); `presentar()` valida ventana + FIFO (RN-EST-020/021), y el chequeo de orden se removió de la creación (solo queda la unicidad de mes).

### 8.1 Detalle de implementación por fase (2 a 7)

Desglose acordado antes de arrancar, para que quede registro de qué toca en
cada capa. Cada fase se da por terminada cuando pasa `manage.py check` +
`makemigrations --check` limpios y se probó al menos una vez contra el stack
de Docker.

**Fase 2 — Número generador — Completada**
- Backend: modelo `GeneradorElemento` (`estimacion_concepto` FK, `elemento`,
  `cantidad_n`, `largo`/`ancho`/`alto` nulables, `parcial` calculado,
  `observaciones`, `orden`). ViewSet CRUD completo (incluye `destroy`),
  scoped vía `estimacion_concepto__estimacion__contrato`. Cuando una
  `EstimacionConcepto` tiene filas de generador, `cantidad_ejecutada` se
  recalcula como `Σ parcial` (deja de aceptar edición manual directa).
- Frontend: sub-tabla expandible por concepto en el cuadro de cantidades,
  con alta/edición/borrado de filas N×L×A×H.

**Fase 3 — Evidencia fotográfica — Completada**
- Backend: modelo `EvidenciaFotografica` (mismo patrón hash/tamaño/formato
  que `ContractDocument`, sin ubicación). ViewSet con `create` multipart,
  scoped por concepto/estimación/contrato.
- Frontend: tab "Evidencias" con subida de fotos por concepto y
  miniatura/lista.

**Fase 4 — Flujo de estados — Completada**
- Backend: modelos `EstimacionEvento` y `Firma`. Acciones nuevas en
  `EstimacionViewSet`: `presentar` (Superintendente, valida RN-EST-005/006 +
  FIFO), `aprobar_residente`/`rechazar_residente` (Residente, motivo
  obligatorio en rechazo), `firmar` (Residente/Superintendente/Supervisión,
  cada quien su propia firma; a la tercera pasa a `firmada`). Cada
  transición registra un `EstimacionEvento`; aprobar/rechazar dispara la
  notificación a Dependencia (RN-EST-011).
- Frontend: botones de acción condicionados por `me.role` +
  `estimacion.status` (patrón `ActivarContratoButton`), diálogo de motivo
  para rechazo, tab "Historial" con el timeline de eventos y firmas.

**Fase 5 — Convenio Modificatorio — Completada**
- Backend: `ConvenioModificatorio`/`ConvenioModificatorioConcepto` en la app
  `documentos` (no `contracts`, ver §2.1 — import circular).
  `ConceptoCatalogo.cantidad_vigente` deja de ser el placeholder
  (`= cantidad`) y suma los deltas aprobados de verdad.
- Frontend: tab nuevo en `contratos/[id]/page.tsx` (crear para
  Residente/Dependencia, aprobar solo Dependencia).

**Fase 6 — Deducciones — Completada**
- Backend: activar las propiedades `amortizacion_anticipo`, `fondo_garantia`,
  `importe_neto` en `Estimacion` (los campos ya existen desde fase 1). Al
  completarse la firma, incrementa `Anticipo.monto_amortizado`. Las
  deducciones se movieron a solo-lectura en el serializer general y quedaron
  reservadas a una acción dedicada `deducciones` (solo Residente, solo con
  la estimación en `en_revision_residente`).
- Frontend: card de Resumen de importes ampliado con estos montos; formulario
  de deducciones visible solo para Residente en esa etapa.

**Fase 7 original — Orden de pago — Retirada el 2026-11-02**
El diseño inicial generaba folio, monto y referencia bancaria. Por indicación
del profesor, se eliminó ese flujo y se sustituyó por el campo booleano
`Estimacion.pagada`; la migración convierte pagos dispersados existentes a
`pagada=True`.

---

## 9. Decisiones — resueltas por la implementación (fases 1-7)

Eran "abiertas" mientras el módulo era solo diseño; quedaron resueltas al
implementar, dejo constancia de cómo:

- **IVA**: sí se modela, informativo, tasa configurable por estimación (`iva_tasa`, default 16.00). Implementado y probado.
- **Fondo de garantía vs. `Garantia` (fianzas)**: se mantuvieron separados — `Estimacion.fondo_garantia` (retención por estimación) no toca el modelo `Garantia` (fianzas) en absoluto.
- **Firma electrónica**: sí, basta la acción `firmar` (sin verificación adicional) — implementado y probado con las 3 firmas (Residente, Superintendente, Supervisión).
- **Multiplicidad de estimaciones por mes**: se fijó en una estimación por `mes_programa` — el FIFO estricto (RN-EST-021) lo hace cumplir al crear, probado (bloquea duplicados y saltos de mes). Extraordinarias siguen fuera de alcance.
- **Convenio Modificatorio — app**: terminó en `documentos`, no en `contracts` como se planteó al diseñar — habría creado un import circular (`ConvenioModificatorioConcepto.concepto` → `ConceptoCatalogo`, que ya vive en `documentos` y depende de `contracts.Contract`). Ver §2.1.
- **Convenio Modificatorio — quién captura/aprueba**: Residente o Dependencia capturan, solo Dependencia aprueba (`aprobar`, RN-CONV-001). Probado.
- **Deducciones — cuándo se editan**: se resolvió en la Fase 6 — el Residente las captura solo mientras la estimación está `en_revision_residente`, vía la acción dedicada `deducciones` (el Superintendente no puede tocarlas ni en borrador).

No quedaban decisiones de diseño abiertas para las fases 1-7.

## 9.1 Decisiones — Fase 8 (resueltas al implementar, 2026-08-27)

- **¿Qué pasa si `presentar()` se llama sobre un contrato sin bitácora?**
  No estaba en el plan original (que trataba a Bitácora como hipotética).
  Se decidió **bloquear duro** con un mensaje explícito ("no tiene bitácora
  abierta"), no omitir el chequeo — mismo criterio que ya usan RN-EST-005/006
  en la misma función, y lectura más fiel a que la bitácora es obligatoria
  por ley (Art. 46 LOPSRM) para toda obra pública federal. Se decidió sin
  preguntar al usuario, documentado aquí para que se pueda revisar si no es
  lo que se quería.
- **RN-EST-021 al crear vs. al presentar**: se removió por completo del
  create-time (ya no bloquea crear un mes fuera de orden) y se movió a
  `presentar()`, tal como decía el plan original — el Superintendente ahora
  puede capturar/borradorar meses por adelantado, pero el orden solo se
  exige al momento de presentar.

## 9.2 Decisión — "cinco al millar" (RN-EST-022, 2026-08-27)

Surgió al revisar un proyecto de referencia externo (`Sistema_de_contratos`,
no forma parte de este repo) que modelaba **dos** retenciones separadas —
`cinco_al_millar` e `inspeccion_vigilancia` — ambas al 0.5% y ambas citando
el mismo Art. 191 RLOPSRM.

Se decidió modelarlo como **una sola** retención
(`porcentaje_cinco_al_millar`), no dos, porque el "cinco al millar" **es**
la retención de inspección, control y vigilancia del Art. 191 — son el
mismo concepto legal, el nombre coloquial ("cinco al millar", por la tasa)
y el nombre funcional ("inspección y vigilancia", por su destino) se
refieren a lo mismo. Modelarlo dos veces habría duplicado el descuento sin
respaldo legal claro. Si en el futuro se confirma que aplica una retención
*adicional* y distinta (p. ej. una cuota estatal/local de contraloría, algo
que sí varía por entidad federativa y que no se pudo verificar contra
ninguna fuente concreta), se agrega como campo nuevo — no se reinterpreta
este.

Se decidió sin preguntar al usuario primero, documentado aquí por si se
quiere revisar.

---

## 10. Verificación histórica (2026-08-26)

Estos resultados corresponden al diseño previo a la simplificación del pago
del 2026-11-02; la emisión de órdenes ya no forma parte del comportamiento
actual.

Todo lo de abajo se probó contra el stack real de Docker (Postgres +
Django + Next.js), no solo en aislado:

- **Backend (fases 1-7): verificado end-to-end vía API real** (`curl`/PowerShell
  contra `http://localhost:8000`, con login y cookies reales por rol). Se
  probaron explícitamente los bloqueos de cada regla de negocio (RN-EST-003,
  005, 006, 008, 009, 010, 021, RN-CONV-001/002), no solo el camino feliz:
  intentos que debían fallar (rebasar tope, presentar sin evidencia, rechazar
  sin motivo, firmar dos veces, crear fuera de orden, editar tras aprobar,
  emitir una orden sin ser Finanzas) efectivamente fallaron con el error
  esperado, y los caminos válidos completaron el flujo previo hasta
  `orden_pago_emitida`
  con los montos correctos (verificado con números reales: bruto 129,920 →
  neto 96,840, anticipo amortizado 25,984).
- **Frontend: `tsc --noEmit`, `eslint` y `next build` limpios** en cada fase
  (un solo warning preexistente y sin relación, `no-img-element`, aceptado
  a propósito por ser miniaturas internas).
- **Prueba manual en navegador (Superintendente, vía Chrome real): parcial.**
  Se confirmó visualmente que el login, la navegación, la lista de
  Estimaciones y el diálogo "Nueva estimación" (ya sin los campos de fecha)
  cargan y se ven correctamente. La automatización del navegador (extensión
  Claude in Chrome) se volvió inestable al interactuar con el `Select` de
  contrato — capturas de pantalla con timeout, tres sistemas de coordenadas
  contradictorios entre sí, cierre inesperado de la pestaña y un error de
  permisos de la extensión — impidiendo terminar de forma confiable la
  creación de una estimación por clicks reales dentro de esa sesión. No se
  identificó como un bug de la aplicación (la misma acción sí funcionó una
  vez por click real, y el flujo completo ya está probado por API); quedó
  pendiente repetir la prueba manual de clicks cuando la herramienta de
  automatización esté estable, o que el usuario la haga directamente.

## 11. Estado de verificación — Fase 8 (2026-08-27)

Backend verificado end-to-end vía API real contra un contrato de prueba
creado ad hoc (`GACM-TEST-VENTANA`, borrado no requerido — datos de
desarrollo), cubriendo los cinco escenarios de RN-EST-020/021:

1. **Sin bitácora**: crear estimaciones fuera de orden ahora funciona (mes 2
   antes que el 1, confirma que el chequeo de orden se quitó de `create`);
   presentar la del mes 1 → `400` con el mensaje específico de "no tiene
   bitácora abierta" (no el genérico de ventana).
2. **Bitácora recién abierta** (`fecha_apertura` = hoy): presentar → `400`,
   "fuera de la ventana de presentación vigente" — correcto, ventana solo
   abre 30+ días después de la apertura.
3. **Ventana abierta** (`fecha_apertura` movida 33 días atrás vía shell, para
   simular tiempo transcurrido sin esperar 30 días reales): presentar el mes
   1 → `200`; presentar el mes 3 saltándose el 2 → `400` RN-EST-021; una vez
   presentado el 2, presentar el 3 → `200` — confirma FIFO y que se puede
   "poner al día" varios meses atrasados dentro de la misma ventana abierta.
   Cada presentación exitosa generó su nota automática en la bitácora
   (RN-BIT-009) con numeración consecutiva correcta.
4. **Ventana ya cerrada** (`fecha_apertura` movida 40 días atrás — pasados
   los 6 días de margen): presentar el mes 4 (con evidencia y FIFO
   correctos) → `400` "fuera de la ventana" — confirma que el bloqueo de
   ventana es independiente y se evalúa incluso cuando el orden FIFO sí lo
   permitiría.
5. `manage.py check` y `makemigrations --check --dry-run` limpios (los
   cambios son solo propiedades/lógica, sin migración nueva).

No se tocó el frontend: los mensajes de error de `presentar()` ya se
muestran mediante el manejo de errores genérico existente
(`errorMessage()` en `estimaciones/[id]/page.tsx`), verificado que extrae
correctamente el campo `detail` de las respuestas nuevas.

## 12. RN-EST-022 — "cinco al millar" (2026-08-27)

`manage.py check` limpio, migración `0006_estimacion_porcentaje_cinco_al_millar`
generada y aplicada. Verificado contra una estimación real ya existente en la
base de Docker (id 1, `importe_bruto` 139,066.60): `retencion_cinco_al_millar`
calculó 695.33 (0.5% exacto) y `importe_neto` bajó de 118,206.61 a 117,511.28
— la resta nueva quedó correctamente encadenada con las demás deducciones.
Frontend: `tsc`, `eslint` (mismo warning preexistente de siempre) y
`next build` limpios; el nuevo renglón "Cinco al millar" se agregó a la
tarjeta de Resumen de importes en `estimaciones/[id]/page.tsx`.

## 13. Convenios — monto_delta/dias_delta, rechazar (2026-08-27)

`manage.py check` limpio, migraciones `documentos.0003` (campos nuevos) y
`notificaciones.0002` (tipo `convenio_rechazado`) generadas y aplicadas.
Verificado contra Docker real con datos reales del contrato 5:
- Convenio `ampliacion_monto` puro (sin conceptos), `monto_delta=25000.00`:
  antes del fix, `aprobar()` habría fallado con "sin conceptos capturados"
  — ahora aprueba (`200`) y `Contract.monto_vigente` sube de 500,000.00 a
  525,000.00 exacto.
- Convenio `ampliacion_plazo` con `dias_delta=0` (sin capturar): intento de
  aprobar → `400` RN-CONV-004 (mensaje específico, no el genérico de
  "sin conceptos"). Rechazado con motivo → `200`, `status=rechazado`,
  notificación real a Residente y Superintendente
  (`tipo=convenio_rechazado`). Intento de aprobar después de rechazado →
  `400` ("solo se puede aprobar un convenio en borrador") — confirma que
  `rechazado` es terminal.
- `Contract` expone `monto_vigente`/`plazo_vigente_dias`/
  `fecha_termino_vigente` en la API (se habían agregado como propiedades del
  modelo pero se habían quedado fuera de `ContractSerializer` — encontrado y
  corregido en el mismo cambio, antes de que llegara a ser un bug real).

Frontend (estado el mismo día, antes del rediseño de §14): `tsc`, `eslint` y
`next build` limpios. `tab-convenios.tsx` ganó captura condicional de
monto/días según `tipo`, un resumen de monto/plazo vigente vs. original,
botón "Rechazar" con motivo obligatorio para Dependencia, y el aviso de
"Aprobar" ya validaba localmente lo mismo que RN-CONV-004 antes de golpear
la API — todo esto se trasladó a `/convenios` en §14, la pestaña del
contrato quedó de solo lectura.

## 14. Convenios — módulo propio, ya no una pestaña (2026-08-27)

El usuario pidió mover la captura/aprobación/rechazo de Convenios fuera de
`contratos/[id]/page.tsx` hacia el módulo dedicado `/convenios` que ya tenía
entrada de menú pero era un `ComingSoon` sin conectar (ver §7 arriba, ya
actualizado). Cambios:

- **Backend**: se agregó `contrato_no` (read-only, `source="contrato.no_contrato"`)
  a `ConvenioModificatorioSerializer` — la lista ya no está scoped a un solo
  contrato, así que necesita mostrar de cuál es cada fila. Sin migración
  (campo de serializer, no de modelo).
- **Frontend**:
  - `app/(dashboard)/convenios/page.tsx` — lista real (antes `ComingSoon`),
    con diálogo "Nuevo convenio" que incluye selector de contrato (patrón de
    `NuevaEstimacionDialog`) y honra `?contrato=` en la URL para preseleccionar
    y filtrar — requirió envolver el componente en `<Suspense>` porque
    `useSearchParams()` sin eso rompe el prerender estático de Next
    (`missing-suspense-with-csr-bailout`, encontrado al correr `next build`).
  - `app/(dashboard)/convenios/[id]/page.tsx` — detalle nuevo: justificación,
    monto/días delta, conceptos + alta de conceptos, aprobar/rechazar. Es la
    misma lógica que tenía `ConvenioDetalleDialog` (ahora eliminado de
    `tab-convenios.tsx`), trasladada de diálogo a página completa.
  - `tab-convenios.tsx` — reducido a resumen de solo lectura (monto/plazo
    vigente vs. original + lista compacta sin acciones) con botón "Ver en
    Convenios" → `/convenios?contrato={id}`. Ya no recibe `canEdit`/`canAprobar`.
  - `lib/convenio-status.ts` (nuevo) — centraliza `CONVENIO_TIPO_LABELS`,
    `CONVENIO_STATUS_LABELS/VARIANTS` y los `CONVENIO_AFECTA_*` (antes
    duplicados dentro de `tab-convenios.tsx`), usado por los 3 lugares
    (resumen, lista, detalle).

**Verificado contra Docker real**: `manage.py check`/`makemigrations --check`
limpios (sin migración, como se esperaba); `GET /documentos/convenios/`
devuelve `contrato_no` correctamente en lista e individual; filtrar por
`?contrato=5` sigue funcionando (usado por el resumen de la pestaña).
Frontend: `tsc`, `eslint` y `next build` limpios — el build falló una vez por
el `Suspense` faltante, se corrigió antes de dar por terminada la fase.

---

## 15. Garantías — vigencia mínima obligatoria (RN-GAR-001/002, plan, 2026-08-28)

**Estado: plan, sin implementar.** El usuario pidió que las fechas de cada
`Garantia` cubran el periodo total del contrato — hoy no hay ninguna
validación que ligue `fecha_emision`/`fecha_vigencia` con las fechas del
contrato (`GarantiaSerializer.validate()` solo revisa
`porcentaje_cobertura` para `tipo=cumplimiento`; ver
`backend/documentos/serializers.py`). Encontrado al revisar el código para
este plan: un contrato puede activarse hoy con una garantía cuya vigencia
termina antes que el propio contrato, sin ninguna alerta.

### 15.1 Decisiones tomadas con el usuario

1. **Alcance: `cumplimiento` + `anticipo`**, no `vicios_ocultos` — esa
   última, en la práctica real de LOPSRM, empieza *después* de la entrega
   de la obra (cubre defectos ocultos 1-2 años posteriores), no durante la
   ejecución; aplicarle esta regla sería incorrecto.
2. **Se valida contra `Contract.fecha_termino_vigente`** (ya existe,
   ajustada por convenios de plazo y suspensiones — no la `fecha_termino`
   original, estática).
3. **Bloqueo duro al guardar** — igual criterio que el resto de las RN del
   proyecto (RN-EST-*, RN-CONV-*): no se puede crear ni editar una
   `Garantia` de esos 2 tipos si sus fechas no cubren el periodo vigente.

### 15.2 RN-GAR-001 — cobertura al crear/editar

Para `tipo in (cumplimiento, anticipo)`:

```
fecha_emision <= contrato.fecha_inicio
fecha_vigencia >= contrato.fecha_termino_vigente
```

**Nota para confirmar con el usuario al implementar**: el chequeo de
`fecha_emision` es una extrapolación mía de "cubrir el periodo total" (no
se preguntó específicamente ese lado) — en la práctica real, la fianza a
veces se entrega unos días *después* de la firma del contrato (Art. 48
LOPSRM da un plazo), no exactamente en o antes de `fecha_inicio`. Si eso
resulta demasiado estricto contra el flujo real de captura (Residente sube
documentación *antes* de activar, así que normalmente ya tendría la fecha
de emisión real a mano), se puede relajar a solo el lado de
`fecha_vigencia` — decidir al implementar, no antes.

Se implementa en `GarantiaSerializer.validate()`
(`backend/documentos/serializers.py`), igual patrón que el chequeo de
`porcentaje_cobertura` que ya existe ahí.

### 15.3 RN-GAR-002 — cobertura dinámica tras un convenio de plazo (decisión propia)

RN-GAR-001 solo se evalúa en el momento de guardar la `Garantia`. Pero un
convenio de plazo aprobado *después* puede extender
`fecha_termino_vigente` más allá de una garantía que ya existía y que sí
era válida en su momento — el propio manual LOPSRM lo confirma como un
caso real (`docs/manual_lopsrm.md` §3.7: "cuando un convenio implica
aumento de monto o plazo, la garantía de cumplimiento debe ajustarse...
el contratista debe ampliarla en 10 días naturales"). Un bloqueo al
guardar no alcanza para este caso — nadie está guardando nada cuando se
aprueba el convenio.

Propuesta: una property calculada `Garantia.cobertura_vigente` (bool) =
`fecha_vigencia >= contrato.fecha_termino_vigente` (solo relevante para
`tipo in (cumplimiento, anticipo)`, `True` por definición para
`vicios_ocultos`), expuesta read-only en `GarantiaSerializer` —
independiente del `estado` existente (`vigente`/`por_vencer`/`vencida`,
que es sobre la fecha de hoy, no sobre la duración del contrato). Sin
migración (no es columna).

**Fase 2 opcional, no pedida, evaluar si vale la pena al implementar**:
notificar a Residente/Dependencia cuando `aprobar()` de un
`ConvenioModificatorio` de plazo deja alguna garantía existente con
`cobertura_vigente=False` — mismo patrón que las demás notificaciones
automáticas del proyecto (`notificaciones.services.crear_notificaciones`),
y con fundamento directo en el manual (§3.7, "10 días naturales").

### 15.4 Frontend (`tab-garantias.tsx`)

- Mostrar `fecha_termino_vigente` del contrato como referencia junto al
  formulario de alta, para que quien captura vea contra qué se está
  validando antes de que el backend rechace.
- Nueva columna/badge de "Cobertura" (usa `cobertura_vigente`),
  independiente del badge de `estado` — una garantía puede estar
  `vigente` (no vencida hoy) y aun así no cubrir todo el contrato.
- Los errores de RN-GAR-001 ya se muestran solos vía el helper
  `errorMessage()` que el componente ya usa para otros 400.

### 15.5 Fuera de alcance

- `vicios_ocultos` (por diseño, es posterior a la entrega — §15.1).
- Sin revalidar/bloquear nada retroactivamente al aprobar un convenio —
  solo se refleja vía `cobertura_vigente` (y, si se decide, la
  notificación de la fase 2 opcional).
- Sin verificación real de la fianza contra la institución afianzadora
  (sigue siendo declarativo, alcance académico, sin cambios aquí).
