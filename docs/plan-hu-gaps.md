# Plan — brechas reales encontradas al comparar contra las HU originales

**Estado:** plan **opcional**, sin implementar y sin priorizar — el usuario
decidió (2026-08-28) que tal vez no sea necesario. Queda documentado por si
se retoma más adelante; no asumir que hay trabajo pendiente aquí sin
confirmar primero. Última actualización: 2026-08-28.

Origen: comparación de las 20 historias de usuario originales del equipo
contra el sistema actual. Del análisis completo (ver el resumen dado al
usuario en conversación, no repetido aquí), se priorizaron 3 brechas para
este plan — **fuera de alcance por decisión explícita**: el tablero de
control con semáforo por portafolio (HU012), que contradice la decisión ya
tomada al construir Seguimiento ("solo por contrato, sin vista de
portafolio" — ver `docs/plan-seguimiento.md` §1).

---

## 1. HU018 — Incumplimiento formal del contratista

### 1.1 Qué pide la HU

Residente de Obra registra incumplimientos formales (atraso, calidad,
seguridad), vinculados a notas/registros/evidencia ya cargados, quedando
clasificados y disponibles para seguimiento o una posible penalización.

### 1.2 Qué existe hoy (el gap real)

`Estimacion.motivo_penalizacion` es texto libre capturado por el Residente
al momento de las deducciones (`EstimacionDeduccionesSerializer`) — sin
ningún registro previo, clasificado, ni vínculo hacia la nota/incidencia
que lo originó. No hay trazabilidad hacia atrás ("¿por qué se penalizó
esto?") ni hacia adelante en el tiempo (un incumplimiento puede registrarse
mucho antes de que exista una estimación a la cual aplicarle la
penalización).

### 1.3 Diseño propuesto

Nuevo modelo `Incumplimiento` en la app `bitacora` (vive ahí porque nace de
evidencia/notas de bitácora ya existentes, mismo criterio que
`NotaBitacora.estimacion`/`.cierre` como FKs opcionales hacia otras apps):

| Campo | Tipo | Notas |
|---|---|---|
| `contrato` | FK → Contract | scoping igual que el resto de la app |
| `clasificacion` | choices: `atraso`, `calidad`, `seguridad` | tal cual la HU |
| `descripcion` | text | obligatorio |
| `nota_referencia` | FK → NotaBitacora, null | evidencia/incidencia que lo origina, opcional (la HU dice "vinculándolos... cuando aplique") |
| `registrado_por` | FK → User | Residente, por permiso |
| `fecha` | datetime auto | |
| `penalizacion_aplicada` | FK → Estimacion, null, `SET_NULL` | se llena cuando el Residente efectivamente lo usa como `motivo_penalizacion` de una estimación — cierra el ciclo de trazabilidad que hoy no existe |

**RN-INC-001**: solo Residente de Obra registra (`action_roles`, mismo
patrón `RoleScopedPermission` del resto del proyecto). Sin edición/borrado
— inmutable, mismo criterio que `NotaBitacora` (RN-BIT-005).

**RN-INC-002**: al capturar deducciones de una Estimación
(`EstimacionDeduccionesSerializer`), si se selecciona un `Incumplimiento`
existente en vez de solo escribir `motivo_penalizacion` a mano, se enlaza
vía `penalizacion_aplicada` — **cambio no disruptivo**: `motivo_penalizacion`
sigue existiendo como texto libre para el caso sin incumplimiento formal
previo (no todas las penalizaciones necesitan haber pasado por este
flujo).

### 1.4 API y frontend

- `IncumplimientoViewSet` en `bitacora/views.py`, mismo `ContratoScopedMixin`
  ya existente ahí. Ruta `/api/bitacora/incumplimientos/`.
- Frontend: nueva sección/tab en `bitacora/[id]/page.tsx` — listado +
  diálogo de alta (clasificación, descripción, nota de referencia opcional
  vía selector de las notas ya existentes de esa bitácora).
- En `EstimacionDeduccionesDialog` (dentro de `estimaciones/[id]/page.tsx`):
  selector opcional de incumplimientos del contrato sin penalización
  aplicada todavía, autocompletando `motivo_penalizacion`.

### 1.5 Migración

Nueva: `bitacora.000X_incumplimiento`.

---

## 2. HU020 — Minuta de reunión de seguimiento

### 2.1 Qué pide la HU

Residente, Superintendente o Supervisión registran minutas de reuniones de
seguimiento (participantes, acuerdos, observaciones, compromisos),
vinculadas a la bitácora o al seguimiento del contrato.

### 2.2 Qué existe hoy

Nada — `NotaClasificacion.COMUNICACION` es lo más cercano, pero es una nota
de una sola descripción libre, sin estructura de participantes/acuerdos/
compromisos.

### 2.3 Diseño propuesto

Nuevo modelo `MinutaReunion`, también en `bitacora` (mismo motivo que
Incumplimiento — la HU explícitamente la ata a "la bitácora o seguimiento
del contrato"):

| Campo | Tipo | Notas |
|---|---|---|
| `contrato` | FK → Contract | |
| `fecha_reunion` | date | puede diferir de `fecha_creacion` (la minuta se sube después) |
| `participantes` | text | lista libre (nombre + rol), **no** FK a `Persona`/`User` — puede haber asistentes externos sin cuenta en el sistema |
| `acuerdos` | text | |
| `observaciones` | text, blank | |
| `compromisos` | text | **MVP: texto libre**, no una lista estructurada con responsable/fecha límite/estatus — evaluar en una fase 2 si se pide seguimiento activo de compromisos individuales; por ahora es documentación, no un tablero de tareas |
| `registrado_por` | FK → User | |
| `fecha_creacion` | datetime auto | |

**RN-MIN-001**: Residente, Superintendente o Supervisión pueden registrar
(igual conjunto de roles que ya usa `AUTORES_NOTA` en `bitacora/views.py`
— se reutiliza esa constante). Sin edición — inmutable, mismo criterio que
el resto del módulo.

### 2.4 API y frontend

- `MinutaReunionViewSet`, ruta `/api/bitacora/minutas/`.
- Frontend: sección nueva en `bitacora/[id]/page.tsx`, patrón idéntico al
  de notas (listado + diálogo de alta) pero con sus propios campos.

### 2.5 Migración

Nueva: `bitacora.000X_minutareunion`.

---

## 3. HU011 — Historial de versiones del contrato

### 3.1 Qué pide la HU

Al aprobar un convenio modificatorio: "se genera una nueva versión del
contrato" y "se conserva el historial de versiones del contrato y de las
modificaciones realizadas."

### 3.2 Qué existe hoy

`Contract` **no está versionado** — es un registro mutable con propiedades
calculadas (`monto_vigente`, `plazo_vigente_dias`, `fecha_termino_vigente`)
que suman los deltas de los convenios `aprobado`. El historial de *qué
cambió* sí existe (cada `ConvenioModificatorio` es inmutable una vez
aprobado, con su `monto_delta`/`dias_delta`/fecha), pero no hay una forma
de "ver el contrato como estaba en la versión 2" de un vistazo.

### 3.3 Decisión de diseño (propuesta, no una nueva pregunta al usuario)

**No crear un modelo de snapshot/versión del contrato.** Sería duplicar
estado que ya es 100% derivable, y contradice el patrón que el proyecto ya
sigue en todos lados (`monto_vigente`, `fondo_garantia_acumulado`, etc. son
siempre calculados, nunca guardados). En vez de eso:

**RN-CONV-006 (nueva)**: exponer un endpoint derivado
`GET /api/contracts/<id>/versiones/` (acción en `ContractViewSet`, mismo
patrón que `documentacion`/`seguimiento` ya existentes ahí) que devuelve,
por cada convenio `aprobado` ordenado por `numero`, un snapshot calculado
en ese punto:

```jsonc
[
  {
    "version": 0,               // el contrato original, antes de cualquier convenio
    "monto": "500000.00",
    "plazo_dias": 180,
    "fecha_termino": "2027-02-24",
    "convenio": null
  },
  {
    "version": 1,
    "monto": "550000.00",       // original + monto_delta acumulado hasta este convenio
    "plazo_dias": 200,
    "fecha_termino": "2027-03-16",
    "convenio": { "id": 3, "numero": 1, "tipo": "ampliacion_monto", "fecha_aprobacion": "..." }
  }
]
```

Esto satisface literalmente "se conserva el historial de versiones" sin
introducir una segunda fuente de verdad que se pueda desincronizar del
propio historial de convenios.

### 3.4 Frontend

- Nueva pestaña/sección "Versiones" en `/convenios` (o en el resumen de
  Convenios dentro de `contratos/[id]/page.tsx`) — tabla simple con las
  filas de arriba.

### 3.5 Migración

Ninguna — todo derivado, sin modelo nuevo.

---

## 4. Fuera de alcance de este plan (recordatorio)

- HU012 (tablero de portafolio con semáforo) — decisión explícita de
  dejarlo fuera por ahora.
- HU019 (alertas por desviación/umbrales) — depende conceptualmente del
  semáforo de HU012; no tiene sentido construirlo sin un lugar donde
  mostrarlo.
- HU004/HU009 (filtros de búsqueda), HU003 (firma explícita en notas) —
  quedaron identificados como gaps reales pero no se priorizaron en esta
  ronda; ver la comparación completa dada en conversación si se quiere
  retomarlos después.
