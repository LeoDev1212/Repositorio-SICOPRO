# Plan de integración — Módulo de Seguimiento

**Estado:** en implementación. Última actualización: 2026-08-28.

---

## 1. Alcance

`frontend/lib/nav.ts` ya tenía la entrada `/seguimiento` desde el scaffold
original, visible solo a Dependencia/Residente/Supervisión (no
Superintendente, no Finanzas) — se respeta tal cual, no se cambia.

Decisiones tomadas con el usuario antes de implementar:

1. **Por contrato, no portafolio.** Igual que Estimaciones/Bitácora/
   Convenios/Cierre: una lista de contratos que lleva a un detalle. Sin
   tablero agregado de "todos los contratos a la vez".
2. **Incidencias = notas de Bitácora ya existentes.** `NotaClasificacion`
   ya tiene `avance` e `incidencia` desde el diseño original del módulo
   Bitácora (sin usarse hasta ahora). Seguimiento no crea un modelo de
   incidencias propio — solo lee/filtra las notas que ya existen.

De ahí se sigue una decisión de arquitectura propia (no se le preguntó al
usuario, es de implementación): **este módulo no necesita una app Django
nueva ni modelos nuevos.** Todo el dato ya existe:

- Lo *programado* ya vive en `documentos.ProgramaConceptoMes`
  (`cantidad_programada` por concepto y mes) + `ConceptoCatalogo.precio_unitario`.
- Lo *real/ejecutado* ya vive en `estimaciones.Estimacion` (`importe_bruto`,
  `mes_programa`) y `EstimacionConcepto.cantidad_ejecutada`.
- Las incidencias/avances ya viven en `bitacora.NotaBitacora`.

Por eso Seguimiento se implementa como **una acción derivada más en
`ContractViewSet`** (`GET /api/contracts/<id>/seguimiento/`), exactamente
el mismo patrón que la acción `documentacion` que ya existía ahí
(`_documentacion_resumen`) — un cálculo de solo lectura sobre datos de
otras apps, no un dominio nuevo. Esto evita duplicar el patrón "app con
modelo propio" que tienen Estimaciones/Bitácora/Convenios/Cierre para algo
que no necesita persistencia ni ciclo de vida propio.

---

## 2. Payload de `GET /api/contracts/<id>/seguimiento/`

Reutiliza `ContractPermission`/`AssignmentScopedQuerySetMixin` que
`ContractViewSet` ya tiene (mismo `get_object()` que `retrieve`/
`documentacion`) — sin permisos ni scoping nuevos. Se agrega el rol al
`action_roles` map con el mismo conjunto que `nav.ts` ya declaraba:
Dependencia, Residente, Supervisión (Superintendente y Finanzas quedan
fuera, como ya estaba decidido en la navegación).

```jsonc
{
  "meses_totales": 8,           // igual fórmula que ProgramaConceptoMes.clean: ceil(plazo_vigente_dias / 30)
  "mes_actual": 3,              // Contract.mes_obra_actual (None -> 0 si no hay bitácora)
  "resumen": {
    "monto_vigente": "1000000.00",
    "monto_ejecutado": "350000.00",
    "saldo_por_ejercer": "650000.00",
    "avance_financiero_porcentaje": 35.0,
    "anticipo_otorgado": "150000.00",
    "anticipo_amortizado": "52500.00",
    "anticipo_pendiente": "97500.00",
    "fondo_garantia_acumulado": "17500.00"
  },
  "curva_s": [
    { "mes": 1, "programado_acumulado": "125000.00", "real_acumulado": "110000.00" },
    { "mes": 2, "programado_acumulado": "250000.00", "real_acumulado": "240000.00" },
    { "mes": 3, "programado_acumulado": "375000.00", "real_acumulado": "350000.00" }
  ],
  "conteo_por_estatus": { "borrador": 0, "en_revision_residente": 1, "...": 0 }
}
```

**Definición de "monto ejecutado" / curva real** (decisión propia, no
preguntada): suma de `importe_bruto` de las estimaciones cuyo `status` está
en `Estimacion.ESTADOS_APROBADOS` (`aprobada_residente`, `pendiente_firma`,
`firmada`) — se reutiliza tal cual el mismo conjunto
que el propio modelo ya usa para "una cantidad reportada ya cuenta como
acumulada" (RN-EST-003), en vez de inventar un criterio nuevo. Esto es más
estricto que `Contract.fondo_garantia_acumulado` (que también cuenta
`en_revision_residente`) — son conceptos distintos: el fondo de garantía se
retiene desde que se presenta, pero el avance físico/financiero real no
debería contar una cantidad que el Residente todavía no valida.

**Curva programada**: para cada mes de 1 a `meses_totales`, suma acumulada
de `cantidad_programada * concepto.precio_unitario` de todos los
`ProgramaConceptoMes` del contrato con `mes <= n`.

**Curva real**: para cada mes de 1 a `meses_totales`, suma acumulada de
`importe_bruto` de estimaciones con `mes_programa <= n` y `status` en
`ESTADOS_APROBADOS`.

Sin `anticipo`/`fondo_garantia_acumulado` cuando el contrato no tiene esos
objetos configurados (`Anticipo` es `OneToOneField` opcional) — se devuelven
en `0` en vez de fallar.

---

## 3. Frontend

- `seguimiento/page.tsx`: dejó de ser `ComingSoon`. Lista de contratos con
  `status != "registrado"` (los `registrado` todavía no tienen bitácora ni
  estimaciones que seguir), reutilizando `GET /api/contracts/` — sin
  endpoint de lista nuevo. Link a `/seguimiento/{id}`.
- `seguimiento/[id]/page.tsx` (nuevo): tarjetas de resumen financiero +
  gráfico de Curva S + lista de notas de Bitácora con
  `clasificacion in {avance, incidencia}` (reutiliza
  `GET /api/bitacora/` para encontrar la bitácora del contrato y
  `GET /api/bitacora/notas/?bitacora=<id>` ya existente, filtrando en
  cliente por clasificación — sin parámetro de filtro nuevo en el backend).
- **Gráfico**: el proyecto no tiene ninguna librería de charts instalada
  todavía. Para dos líneas (programada vs. real) no vale la pena agregar
  una dependencia — se construye un componente SVG propio
  (`components/seguimiento/curva-s-chart.tsx`).
- Tipo nuevo en `lib/types.ts` para el payload de `seguimiento` (no hay
  modelo de Seguimiento per se, solo el shape de la respuesta).

---

## 4. Fuera de alcance (igual que el resto del scaffold)

Sin curva "físico" separada de la financiera (en este proyecto, cantidad ×
precio unitario ya son la misma medida — no hay una segunda unidad de
avance físico independiente del valor). Sin exportar a PDF/Excel. Sin
proyección/pronóstico (solo programado vs. real a la fecha).
