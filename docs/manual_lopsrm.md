# Manual de Obra Pública bajo la LOPSRM

---

## Índice

1. [Estimación de Obra](#1-estimación-de-obra)
2. [Evaluación de las Estimaciones](#2-evaluación-de-las-estimaciones)
3. [Convenios Modificatorios](#3-convenios-modificatorios)
4. [Bitácora de Obra e Implementación en Sistema](#4-bitácora-de-obra-e-implementación-en-sistema)

---

## 1. Estimación de Obra

### 1.1 ¿Qué es una Estimación de Obra?

Una **estimación de obra** es el **documento de cobro periódico** (normalmente mensual o quincenal) que formaliza el pago de los trabajos ejecutados durante un período determinado. Recoge las cantidades de obra realizadas, las multiplica por los **precios unitarios** pactados en el contrato y produce el importe que el contratista tiene derecho a cobrar.

No es un presupuesto ni una proyección: es el **documento contractual que hace exigible el pago** de una parte del trabajo contratado.

---

### 1.2 Los Números Generadores

#### ¿Qué son?

El **número generador** (o generador de obra) es el documento que detalla, elemento por elemento, **cómo se midieron o calcularon las cantidades de trabajo ejecutadas** en cada concepto de una obra. Registra de forma ordenada y verificable las dimensiones, conteos y operaciones aritméticas que justifican la cantidad total reportada en una estimación.

#### ¿Para qué sirven?

| Función | Descripción |
|---------|-------------|
| **Soporte de cobro** | Es el respaldo técnico de cada estimación. Sin generador, la estimación no tiene fundamento numérico verificable. |
| **Control de avance** | Permite rastrear exactamente qué cantidad de cada concepto ya fue ejecutada y qué falta. |
| **Trazabilidad técnica** | En auditorías o controversias, el generador permite reconstruir qué se midió, cuándo y con qué criterio. |
| **Base del finiquito** | La suma de todos los generadores debe cuadrar con el total contratado en el catálogo de conceptos. |

#### Estructura básica de un número generador

| Campo | Descripción |
|-------|-------------|
| **Clave** | Número del concepto en el catálogo |
| **Descripción** | Texto del concepto según el catálogo |
| **Unidad** | Unidad de medida (m², m³, kg, ml, pza) |
| **Elemento** | Identificación del elemento medido (eje, tramo, nivel) |
| **N** | Número de repeticiones |
| **L** | Largo (metros) |
| **A** | Ancho (metros) |
| **H** | Alto o espesor (metros) |
| **Parcial** | Resultado de N × L × A × H |
| **Observaciones** | Referencia al plano, croquis o nota aclaratoria |

Al pie del generador debe constar:
- Total acumulado del concepto en la estimación actual
- Total acumulado en estimaciones anteriores
- Total acumulado a la fecha
- Cantidad contratada pendiente por ejecutar
- Firmas del residente de obra (contratista) y supervisor de obra (dependencia)

---

### 1.3 Evidencias Fotográficas

Las **evidencias fotográficas** son el registro visual que acredita que el trabajo reportado en el número generador y la estimación **fue realmente ejecutado** en el período correspondiente. Aunque la LOPSRM no define un formato específico para las fotografías, en la práctica de obra pública son un requisito indispensable porque:

- **Complementan los números generadores:** Mientras el generador dice *cuánto* se hizo, la foto dice *dónde* y *cómo* se hizo.
- **Sirven ante auditorías:** La ASF, la SFP u otros órganos de fiscalización pueden solicitarlas para validar que el gasto público corresponde a obra realmente ejecutada.
- **Documentan el estado de los trabajos:** Son útiles para resolver disputas sobre calidad, alcance o fechas de ejecución.

#### Buenas prácticas para las evidencias fotográficas

- Tomarlas **durante la medición en campo**, con fecha y hora visible.
- Incluir **referencias geográficas o de plano** en la imagen (ejes, niveles, croquis).
- Fotografiar **antes, durante y después** de los trabajos cuando aplique.
- Numerarlas correlativamente y ligarlas al concepto del catálogo que documentan.
- Firmarlas o sellarlas por el residente y el supervisor.

---

### 1.4 Relación con los Precios Unitarios

El flujo de documentos es claro y jerárquico:

```
Catálogo de Conceptos (contrato)
         ↓
   Número Generador (medición en campo)
         ↓
    Estimación de Obra (cobro)
```

| Documento | Función | Relación con Precios Unitarios |
|-----------|---------|-------------------------------|
| **Catálogo de conceptos** | Lista de trabajos contratados con precio y cantidad total | Define los **precios unitarios pactados** en el contrato |
| **Número generador** | Medición detallada de lo ejecutado en un período | **No incluye precios**, solo cantidades físicas medidas |
| **Estimación** | Documento de cobro | **Multiplica las cantidades del generador × los precios unitarios del catálogo** para obtener el importe a pagar |

> **Importante:** Los precios unitarios son **inmodificables** durante la ejecución del contrato (salvo ajustes de costos por escalatoria cuando el contrato lo prevea). Lo que cambia de estimación en estimación son las **cantidades ejecutadas**, no los precios.

---

### 1.5 Partes de una Estimación

Una estimación completa bajo la LOPSRM debe contener:

#### A. Encabezado
- Nombre y número del contrato
- Nombre de la obra y ubicación
- Número de estimación consecutivo
- Período de ejecución que cubre
- Fecha de presentación

#### B. Cuerpo (cuadro de cantidades y precios)

| Clave | Descripción | Unidad | Cantidad Ejecutada | Precio Unitario | Importe Parcial |
|-------|-------------|--------|-------------------|-----------------|-----------------|
| C-01 | Excavación a mano | m³ | 45.20 | $350.00 | $15,820.00 |
| C-02 | Muro de mampostería | m² | 91.05 | $480.00 | $43,704.00 |

#### C. Resumen de importes
- **Subtotal** (suma de importes parciales)
- **IVA** (cuando aplique)
- **Importe bruto** (subtotal + IVA)
- **Deducciones:**
  - Amortización de anticipo
  - Fondo de garantía (típicamente 5%)
  - Penalizaciones por atraso (si aplica)
  - Otras deducciones contractuales
- **Importe neto a pagar**

#### D. Anexos
- **Números generadores** de cada concepto reportado
- **Evidencias fotográficas** de los trabajos ejecutados
- **Bitácora de obra** (cuando se requiera)
- **Programa de ejecución** actualizado
- **Reporte de materiales** (si aplica)

---

### 1.6 Flujo para Presentar una Estimación (LOPSRM)

#### Paso 1: Medición en campo
- El **residente de obra** del contratista sale a campo con el supervisor de la dependencia.
- Se toman medidas físicas de cada concepto ejecutado en el período.
- Se toman **fotografías de evidencia**.
- Ambas partes firman las mediciones en el momento.

#### Paso 2: Elaboración del número generador
- El residente organiza las mediciones por concepto, elemento por elemento.
- Se calculan parciales y totales.
- Se cruza con el acumulado de estimaciones anteriores.
- Se verifica que no se rebase la cantidad contratada.

#### Paso 3: Elaboración de la estimación
- Se toman las cantidades del número generador.
- Se multiplican por los **precios unitarios del contrato**.
- Se aplican deducciones (anticipo, fondo de garantía, etc.).
- Se anexan los generadores y evidencias fotográficas.

#### Paso 4: Presentación al supervisor
- El contratista entrega la estimación completa al supervisor de obra de la dependencia.
- El supervisor verifica las cantidades en campo si lo considera necesario.

#### Paso 5: Revisión y autorización
- La dependencia tiene **15 días hábiles** para revisar la estimación desde su presentación.
- Si detecta errores, la devuelve para corrección.
- Si está correcta, la autoriza para pago.

#### Paso 6: Pago
- Una vez autorizada, la dependencia tiene **20 días naturales** para efectuar el pago.
- Si no paga en ese plazo, el contratista tiene derecho a cobrar **intereses** a la tasa del Banco de México más dos puntos porcentuales.

---

### 1.7 Requisitos Legales Clave bajo la LOPSRM

- **Sin número generador aprobado, no hay pago.** La estimación sin generador no es procedente; la dependencia puede devolverla.
- El **fondo de garantía** (generalmente 5%) se retiene de cada estimación y se libera al finiquito, una vez que el contratista acredite cumplimiento fiscal y de seguridad social.
- Los **plazos de pago** son normativos y de estricto cumplimiento para la dependencia.

---

## 2. Evaluación de las Estimaciones

### 2.1 La Residencia de Obra (Autoridad Única de Aprobación)

Es el **actor central** en la evaluación de estimaciones. La **Residencia de Obra** es un **servidor público designado por la dependencia o entidad contratante**, ubicado en el sitio de ejecución de los trabajos.

#### Funciones de la Residencia respecto a las estimaciones:

| Función | Descripción |
|---------|-------------|
| **Revisión y autorización** | Es el **único responsable legal** de autorizar o desautorizar las estimaciones para efectos de pago. |
| **Plazo de 15 días** | Tiene **15 días naturales** para revisar y resolver sobre la procedencia de la estimación desde su presentación. |
| **Registro en bitácora** | Debe hacer constar en la bitácora la fecha de presentación de cada estimación. |
| **Resolución de diferencias** | Si surgen diferencias técnicas o numéricas que no puedan resolverse en el plazo, las incorpora en la siguiente estimación. |

> **Dato clave:** Si la residencia **omite resolver** sobre una estimación dentro de los 15 días, ésta **se tiene por autorizada** por efectos de la ley.

---

### 2.2 La Supervisión (Revisora, NO Autorizadora)

La supervisión (ya sea interna o contratada externamente) **revisa las estimaciones**, pero **NO tiene facultad legal para autorizar el pago**. Su rol es de **mero revisor, mediador y conciliador**.

#### Funciones de la Supervisión:

- **Revisar detalladamente** las estimaciones antes de que la residencia las autorice.
- **Firmar conjuntamente** con la superintendencia las estimaciones para su trámite de pago.
- **Verificar** que las estimaciones incluyan los documentos de soporte (números generadores, evidencias fotográficas, bitácora).
- **Llevar el control** de las cantidades de obra ejecutadas y las faltantes por ejecutar.
- **Conciliar** las cantidades con la superintendencia del contratista.

---

### 2.3 La Superintendencia (Parte del Contratista)

El **superintendente** es el representante del **contratista** en la obra. Aunque no "evalúa" en sentido de autoridad pública, participa activamente en el proceso:

- **Presenta las estimaciones** ante la residencia dentro de los 6 días naturales siguientes a la fecha de corte.
- **Firma los números generadores** junto con el residente o supervisor, dando fe de las cantidades medidas en campo.
- **Entrega la documentación comprobatoria** de consumos y recursos empleados.

---

### 2.4 La Dependencia o Entidad (Pagadora)

Una vez que la residencia autoriza la estimación, la **dependencia o entidad contratante** tiene la obligación de:

- **Efectuar el pago** en un plazo no mayor de **20 días naturales** contados desde la autorización.
- **Pagar gastos financieros** si incumple con el pago en el plazo establecido.

---

### 2.5 Flujo de Evaluación Resumido

```
┌─────────────────────────────────────────────────────────────┐
│  1. CONTRATISTA (Superintendente)                           │
│     Presenta la estimación + números generadores            │
│     + evidencias fotográficas + documentación de soporte    │
│                    ↓                                        │
│  2. SUPERVISIÓN                                             │
│     Revisa técnicamente las cantidades y documentos         │
│     Firma como revisor (NO autoriza pago)                   │
│                    ↓                                        │
│  3. RESIDENCIA DE OBRA                                      │
│     Autoriza o desautoriza la estimación                    │
│     Plazo: 15 días naturales                                │
│     Si omite resolver → se tiene por AUTORIZADA             │
│                    ↓                                        │
│  4. DEPENDENCIA / ENTIDAD                                   │
│     Efectúa el pago                                         │
│     Plazo: 20 días naturales desde la autorización          │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.6 Jerarquía de Responsabilidades

| Actor | Rol en la estimación | ¿Autoriza pago? |
|-------|----------------------|-----------------|
| **Residencia de Obra** | Revisa, controla y aprueba | ✅ **Sí — única autoridad legal** |
| **Supervisión** | Revisa técnica y numéricamente | ❌ No — solo recomienda |
| **Superintendente** | Presenta y sustenta | ❌ No — es parte del contratista |
| **Dependencia/Entidad** | Ejecuta el pago | ❌ No — paga lo que la residencia autorizó |

---

### 2.7 Consejos Prácticos para el Contratista

1. **Documenta la fecha de presentación** de cada estimación (sello de recepción, bitácora, oficio con acuse de recibo).
2. **Verifica que la residencia registre la presentación en la bitácora**; si no lo hace, envía un oficio a la dependencia como constancia legal.
3. **Adjunta un oficio contra-recibo** de todo lo que entregues para revisión, como prueba documental del cumplimiento de tus obligaciones.

---

## 3. Convenios Modificatorios

### 3.1 ¿Qué es un Convenio Modificatorio?

Un **convenio modificatorio** es el instrumento legal mediante el cual la **dependencia o entidad contratante** y el **contratista** acuerdan cambiar las condiciones originales de un contrato de obra pública. Puede modificarse el **monto**, el **plazo de ejecución**, las **especificaciones técnicas** o las **condiciones contractuales**, siempre dentro de los límites que establece la ley.

> **Regla fundamental:** Los convenios modificatorios **se consideran parte del contrato original** y son obligatorios para quienes los suscriben.

---

### 3.2 Tipos de Convenios Modificatorios

#### A. Por el objeto de la modificación

| Tipo | Descripción |
|------|-------------|
| **En monto** | Aumento o reducción del importe total del contrato por cantidades adicionales, conceptos nuevos o reducción de alcance. |
| **En plazo** | Ampliación o reducción del tiempo de ejecución de los trabajos. |
| **En monto y plazo** | Modificación simultánea de ambos elementos. |
| **En especificaciones técnicas** | Cambios en materiales, procesos constructivos o diseño derivados de avances tecnológicos o de ingeniería. |
| **En términos y condiciones** | Modificaciones que no representan incremento o disminución en monto o plazo (ej. cambio de representantes legales, ajustes administrativos). |

#### B. Por su magnitud (según el Art. 59 LOPSRM)

| Tipo | Límite | Autorización requerida |
|------|--------|------------------------|
| **Convenio ordinario** | Hasta el **25%** del monto o plazo original | El servidor público que determine la dependencia en sus lineamientos. |
| **Convenio adicional** | **Más del 25%** pero sin variar el objeto del proyecto | Titular del área responsable de la contratación. |
| **Convenio excepcional** | Más del **50%** del monto o plazo (Art. 59 Bis) | **Secretaría de la Función Pública** (ahora Secretaría Anticorrupción y Buen Gobierno). |

---

### 3.3 Límites Legales: El 25% y el 50%

#### El límite del 25%

La LOPSRM establece que los convenios modificatorios, **considerados conjunta o separadamente**, no pueden rebasar el **25% del monto o del plazo** pactados originalmente en el contrato.

**Importante:** Las modificaciones al **plazo** y al **monto** se consideran **independientes y separadas**. Es decir, puedes tener un convenio de plazo del 20% y otro de monto del 20%, y ambos son válidos porque se miden por separado.

#### ¿Qué pasa si se excede el 25%?

Si las modificaciones **exceden el 25%** pero **no varían el objeto del proyecto**, se pueden celebrar **convenios adicionales**, pero requieren:
- Justificación **fundada y explícita** de las razones.
- Autorización del **titular del área responsable de la contratación**.
- Informe mensual al **órgano interno de control** de la dependencia.

#### El límite del 50% (Art. 59 Bis)

Cuando la modificación implique una diferencia **superior al 50%** del importe original o del plazo (o ambos), se activa el **ajuste de costos indirectos y financiamiento**:

| Acción | Plazo | Responsable |
|--------|-------|-------------|
| El contratista puede solicitar ajuste de indirectos y financiamiento | **15 días naturales** desde la recepción física de los trabajos | Contratista |
| La dependencia puede solicitar ajuste a la baja | **15 días naturales** desde la recepción física | Dependencia |
| La dependencia solicita autorización a la Secretaría | **15 días naturales** siguientes a la solicitud del contratista | Dependencia |
| Revisión de indirectos y financiamiento | Una vez autorizada la Secretaría | Área responsable + contratista |

> Si se pierde el plazo de 15 días, **se pierde la posibilidad** de solicitar el ajuste.

---

### 3.4 Prohibiciones y Restricciones

#### Lo que NUNCA se puede hacer con un convenio modificatorio:

| Prohibición | Fundamento Legal |
|-------------|-----------------|
| **Modificar contratos a precio alzado** en monto o plazo | Art. 59 LOPSRM (excepto casos excepcionales del Art. 59 Ter) |
| **Cambiar la naturaleza o características esenciales** del objeto del contrato | Art. 59 LOPSRM |
| **Celebrar convenios para eludir** el cumplimiento de la LOPSRM o tratados internacionales | Art. 59 LOPSRM |
| **Exceder el presupuesto autorizado** de la dependencia | Art. 59 LOPSRM |
| **Modificar sin justificación fundada y explícita** | Art. 59 LOPSRM |

#### Casos excepcionales para precio alzado (Art. 59 Ter)

Desde la reforma de 2025, los contratos a precio alzado **sí pueden modificarse** en tres supuestos muy específicos:

1. **Circunstancias económicas generales ajenas a las partes** (variaciones cambiarias, cambios en precios internacionales).
2. **Actualización de costos por retraso en el inicio** (más de 120 días desde la presentación de proposiciones).
3. **Trabajos extraordinarios no considerados** originalmente pero necesarios para concluir la obra.

---

### 3.5 Requisitos para Celebrar un Convenio Modificatorio

#### A. Requisitos de fondo

| Requisito | Descripción |
|-----------|-------------|
| **Razones fundadas y explícitas** | La dependencia debe justificar por escrito por qué se requiere la modificación. |
| **Presupuesto autorizado y disponible** | Debe existir suficiencia presupuestaria para cubrir el incremento. |
| **Dictamen técnico** | El residente de obra debe emitir un dictamen que funde y motive las causas. |
| **No variación sustancial del proyecto** | La modificación no puede alterar la esencia de la obra. |

#### B. Requisitos de forma (Art. 109 del Reglamento)

Todo convenio modificatorio debe contener **como mínimo**:

1. **Identificación del tipo de convenio** y de las partes (nombre, cargo de representantes, acreditamiento de personalidad).
2. **Dictamen técnico** y documentos justificativos.
3. **Objeto del convenio**: descripción sucinta de las modificaciones.
4. **Programa de ejecución valorizado** con periodicidad de estimaciones.
5. **Cláusula de sujeción al contrato original**: que, salvo lo expresamente estipulado, rigen todas las cláusulas del contrato original.
6. **Si implica plazo**: plazo de ejecución del convenio, porcentaje que representa, y plazo total (original + nuevo).
7. **Si implica monto**:
   - Disponibilidad presupuestaria.
   - Importe del convenio (número y letra), suma con el contrato original y porcentaje respecto del original.
   - Obligación del contratista de ampliar la garantía de cumplimiento.
   - Catálogo de conceptos valorizado con cantidades y precios unitarios.

---

### 3.6 Plazos para la Celebración

| Etapa | Plazo | Responsable |
|-------|-------|-------------|
| **Determinación de las modificaciones** | — | Dependencia / Residente |
| **Suscripción del convenio** | **Máximo 45 días naturales** desde la determinación | Dependencia o entidad |
| **Entrega de ampliación de garantía** | **Máximo 10 días naturales** siguientes a la firma del convenio | Contratista |
| **Solicitud de ampliación de plazo** | Dentro del plazo de ejecución de los trabajos | Contratista |
| **Dictamen de resolución de plazo** | **30 días naturales** siguientes a la solicitud | Dependencia (si no resuelve, se tiene por aceptada) |
| **Formalización del convenio de plazo** | **45 días naturales** siguientes al dictamen o afirmativa ficta | Dependencia |

---

### 3.7 Garantías y Convenios Modificatorios

#### Ampliación de la garantía de cumplimiento

Cuando un convenio implica **aumento de monto o plazo**, la garantía de cumplimiento debe ajustarse:

| Situación | Acción |
|-----------|--------|
| El incremento **está cubierto** por la garantía original | No se requiere ampliación. |
| El incremento **NO está cubierto** | El contratista debe ampliar la garantía en la misma proporción sobre el monto del convenio. |
| **Plazo para entregar** | Máximo 10 días naturales después de la firma del convenio. |
| **Cláusula resolutoria** | El convenio debe incluir una cláusula que lo resuelva si no se entrega la garantía a tiempo. |

#### Anticipos en convenios modificatorios

Las dependencias pueden otorgar **anticipos para los convenios** celebrados al amparo del Art. 59, **sin que puedan exceder el porcentaje originalmente autorizado** en el contrato.

---

### 3.8 Pagos Previos a la Formalización del Convenio

La LOPSRM permite una **flexibilidad importante**: cuando se requieren cantidades o conceptos adicionales, la dependencia puede **autorizar el pago de las estimaciones ejecutadas previamente a la celebración del convenio**, siempre que:

- Los incrementos **no rebasen el presupuesto autorizado** en el contrato.
- Las **cantidades adicionales** se paguen a los **precios unitarios pactados originalmente**.
- Los **conceptos no previstos** en el catálogo original deban ser **conciliados y autorizados previamente a su pago**.

> **Práctica recomendada:** Aunque la ley permite pagar antes de formalizar el convenio, lo ideal es **no ejecutar trabajo sin convenio firmado**. Si no es posible, documenta todo en la bitácora y conserva oficios de autorización.

---

### 3.9 Control y Seguimiento de los Conceptos del Convenio

Cuando se realizan conceptos de trabajo al amparo de un convenio, estos deben:

- **Considerarse y administrarse independientemente** de los originalmente pactados.
- **Formular estimaciones específicas** para tener control y seguimiento adecuado.
- **Incluirse en la misma estimación** que los conceptos originales, pero **distinguiéndolos claramente** y anexando la documentación de soporte.

---

### 3.10 Información en la Plataforma Digital Nacional

Desde la reforma de 2025, los convenios modificatorios deben **publicarse en la Plataforma Digital Nacional de Contrataciones Públicas**. El Art. 74 Bis de la LOPSRM establece que la plataforma concentrará:

> *"la información de los contratos y los convenios modificatorios"*

Esto significa que **todos los convenios modificatorios son públicos** y sujetos a escrutinio ciudadano.

---

### 3.11 Procedimiento Paso a Paso para Formalizar un Convenio

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: IDENTIFICAR LA NECESIDAD                               │
│  El residente detecta la necesidad de modificar monto, plazo    │
│  o especificaciones. Documenta en bitácora.                     │
│                    ↓                                              │
│  PASO 2: DICTAMEN TÉCNICO                                       │
│  El residente emite dictamen técnico que funde y motive         │
│  las causas de la modificación.                                 │
│                    ↓                                              │
│  PASO 3: VERIFICAR PRESUPUESTO                                  │
│  La dependencia confirma disponibilidad presupuestaria          │
│  (Oficio de Suficiencia Presupuestal).                          │
│                    ↓                                              │
│  PASO 4: VERIFICAR LÍMITE DEL 25%                               │
│  ¿La modificación excede el 25% del monto o plazo original?    │
│     ├─ NO → Autoriza el servidor público designado              │
│     └─ SÍ → ¿Excede el 50%?                                     │
│            ├─ NO → Autoriza el titular del área de contratación │
│            └─ SÍ → Solicita autorización a la Secretaría        │
│                    (SFP / SABG)                                 │
│                    ↓                                              │
│  PASO 5: NEGOCIACIÓN CON EL CONTRATISTA                         │
│  Se acuerdan las nuevas condiciones (monto, plazo, precios).    │
│                    ↓                                              │
│  PASO 6: ELABORACIÓN DEL CONVENIO                               │
│  Se redacta el convenio con todos los requisitos del Art. 109   │
│  del Reglamento.                                                │
│                    ↓                                              │
│  PASO 7: FIRMA DEL CONVENIO (máx. 45 días desde la              │
│  determinación de las modificaciones).                          │
│                    ↓                                              │
│  PASO 8: AMPLIACIÓN DE GARANTÍA (si aplica)                     │
│  El contratista entrega la ampliación de garantía en 10 días.   │
│                    ↓                                              │
│  PASO 9: PUBLICACIÓN EN LA PLATAFORMA DIGITAL                   │
│  La dependencia registra el convenio en el sistema.             │
│                    ↓                                              │
│  PASO 10: EJECUCIÓN Y ESTIMACIONES INDEPENDIENTES              │
│  Se ejecutan los trabajos y se formulan estimaciones             │
│  separadas para los conceptos del convenio.                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.12 Sanciones y Riesgos

| Situación | Consecuencia |
|-----------|--------------|
| Celebrar convenios para **eludir la LOPSRM** | Nulidad del convenio, responsabilidad administrativa, penal. |
| **Exceder el 25%** sin autorización del titular | Irregularidad grave ante la ASF, posible denuncia penal. |
| **No publicar** el convenio en la plataforma | Incumplimiento de obligaciones de transparencia. |
| **No ampliar la garantía** en el plazo de 10 días | El convenio puede resolverse por cláusula resolutoria. |
| **Modificar contrato a precio alzado** sin excepción del Art. 59 Ter | Nulidad, responsabilidad del servidor público. |

---

### 3.13 Resumen de Puntos Clave

| Aspecto | Regla |
|-----------|-------|
| **Límite ordinario** | 25% del monto o plazo original (separados) |
| **Límite excepcional** | Más del 25% con autorización del titular del área |
| **Límite para ajuste de indirectos** | Más del 50% con autorización de la Secretaría |
| **Plazo para firmar** | Máximo 45 días desde la determinación |
| **Garantía** | Ampliar en 10 días si el incremento no está cubierto |
| **Precio alzado** | No modificable (salvo 3 excepciones del Art. 59 Ter) |
| **Publicación** | Obligatoria en la Plataforma Digital Nacional |
| **Estimaciones** | Conceptos del convenio deben ir separados en las estimaciones |

---

## 4. Bitácora de Obra e Implementación en Sistema

### 4.1 ¿Qué es la Bitácora de Obra?

El **Reglamento de la LOPSRM** la define como:

> *"El instrumento técnico que constituye el medio de comunicación entre las partes que formalizan los contratos, en el cual se registran los asuntos y eventos importantes que se presenten durante la ejecución de los trabajos."*

Es el **documento vivo del contrato**: todo lo que ocurre en la obra — bueno o malo — debe quedar asentado ahí. Tiene **valor probatorio pleno** en controversias, auditorías y juicios.

---

### 4.2 Bitácora Convencional vs. Electrónica

| Característica | **Bitácora Convencional** | **Bitácora Electrónica (BESOP)** |
|----------------|---------------------------|----------------------------------|
| **Formato** | Libro físico foliado, original + 2 copias | Sistema digital en línea |
| **Firma** | Firmas manuscritas | Firma electrónica avanzada (e.Firma) |
| **Ubicación** | Debe permanecer **en la residencia de obra** | Acceso remoto vía web |
| **Regla general** | Solo cuando se acreditan **supuestos de excepción** autorizados | Es la **regla general** en obra pública federal |
| **Transparencia** | Consulta presencial | Información en tiempo real, trazabilidad digital |
| **Respaldo** | Copias físicas | Respaldo digital en servidores de la autoridad |

> **Dato clave:** La reforma de 2025 no derogó la obligatoriedad de la bitácora ni del sistema BESOP. Mantiene su naturaleza jurídica y valor probatorio pleno.

---

### 4.3 Obligatoriedad Legal

La bitácora es **obligatoria** en toda obra pública federal. Las normas que lo establecen son:

- **Art. 46, último párrafo de la LOPSRM**
- **Art. 52 Bis de la LOPSRM**
- **Art. 122 del Reglamento de la LOPSRM**

El **residente de obra** debe abrir la bitácora con una **nota de apertura previo a la fecha de inicio** de los trabajos establecida en el contrato.

---

### 4.4 ¿Qué Eventos se Registran?

Todo evento relevante de la ejecución. Los más comunes son:

| Categoría | Eventos típicos |
|-----------|-----------------|
| **Inicio** | Apertura de bitácora, inicio de trabajos, entrega de sitio |
| **Avance** | Estimaciones presentadas y autorizadas, hitos del programa |
| **Modificaciones** | Convenios modificatorios, cambios al proyecto ejecutivo |
| **Incidencias** | Suspensiones, retrasos, casos fortuitos, fuerza mayor |
| **Calidad** | Pruebas de laboratorio, ensayos, no conformidades |
| **Seguridad** | Accidentes, incidentes, reportes de seguridad e higiene |
| **Comunicación** | Oficios, reuniones de obra, instrucciones del residente |
| **Cierre** | Terminación anticipada, rescisión, finiquito, cierre de bitácora |

---

### 4.5 Requisitos Mínimos de Cada Anotación (Art. 94 RLOPSRM)

Cada nota en la bitácora debe contener **como mínimo**:

| Campo | Descripción |
|-------|-------------|
| **Número** | Numeración correlativa de la nota |
| **Clasificación** | Tipo de evento (incidencia, avance, comunicación, etc.) |
| **Fecha** | Fecha del evento |
| **Descripción del asunto** | Narrativa clara y objetiva de lo ocurrido |
| **Ubicación** | Lugar específico dentro de la obra |
| **Causa** | Razón que originó el evento |
| **Solución** | Medidas adoptadas para resolverlo |
| **Prevención** | Acciones para evitar que se repita |
| **Consecuencia económica** | Impacto en costos, si lo hubiere |
| **Responsabilidad** | Quién asume la responsabilidad, si aplica |
| **Fecha de atención** | Cuándo se atendió el asunto |
| **Referencia** | Número de la nota que se contesta (si es respuesta) |

#### Nota de apertura obligatoria (Art. 123 RLOPSRM)

La bitácora debe iniciar con una **nota especial** que incluya:

- Fecha de apertura
- Datos generales de las partes involucradas
- Nombre y firma del personal autorizado
- Domicilios y teléfonos
- Datos particulares del contrato
- Alcances descriptivos de los trabajos
- Características del sitio
- Documentos de identificación del personal técnico facultado como representante de la contratante y del contratista

---

### 4.6 Reglas de Uso Importantes

1. **Firma electrónica avanzada** para el registro inicial y cada anotación en la bitácora electrónica.
2. **La bitácora física debe permanecer en la residencia de obra**. Sacarla del sitio es ilegal y puede generar responsabilidad administrativa.
3. **Se pueden validar y adjuntar oficios** dentro de la bitácora.
4. **Debe cerrarse al concluir la obra** con una nota de cierre.
5. **Las anotaciones deben ser consistentes** con programas, estimaciones, convenios y demás documentos del contrato.

---

### 4.7 Implementación en un Sistema Digital

#### A. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA DE PRESENTACIÓN                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Web (React) │  │ App Móvil   │  │ Panel de Administración │ │
│  │             │  │ (React      │  │                         │ │
│  │             │  │  Native/    │  │                         │ │
│  │             │  │  Flutter)   │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       CAPA DE API / BACKEND                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  REST API / GraphQL  →  Node.js / Python / Java         │   │
│  │  Autenticación: OAuth 2.0 + e.Firma (FIEL)              │   │
│  │  Validación de firmas electrónicas avanzadas            │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      CAPA DE LÓGICA DE NEGOCIO                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Módulo de   │  │ Módulo de   │  │ Módulo de Reportes      │ │
│  │ Bitácora    │  │ Estimaciones│  │ y Alertas               │ │
│  │             │  │             │  │                         │ │
│  │ Módulo de   │  │ Módulo de   │  │ Módulo de Notificaciones│ │
│  │ Documentos  │  │ Programas   │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                        CAPA DE DATOS                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Base de datos relacional (PostgreSQL)                  │   │
│  │  Almacenamiento de archivos (AWS S3 / Azure Blob)       │   │
│  │  Blockchain / Ledger inmutable para auditoría (opcional)│   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

#### B. Módulos Principales

Esta sección describe una referencia funcional para un sistema de producción,
no las funciones actualmente implementadas en GACM. Por alcance académico,
GACM no incluye adjuntos, geolocalización ni firma electrónica en Bitácora;
la evidencia fotográfica se gestiona únicamente desde Estimaciones.

**Módulo 1: Gestión de Contratos y Obras**
- Alta de obra con datos del contrato (número, dependencia, contratista, monto, plazo).
- Designación de roles: Residente, Supervisor, Superintendente, Contratista.
- Configuración de permisos por rol.

**Módulo 2: Bitácora Electrónica**
- **Nota de apertura**: Formulario estructurado con todos los campos obligatorios del Art. 123.
- **Registro de notas**: Formulario con los campos del Art. 94 (número, clasificación, fecha, descripción, ubicación, causa, solución, prevención, consecuencia económica, responsabilidad, fecha de atención, referencia).
- **Editor de texto enriquecido** para la descripción del asunto.
- **Adjuntos**: Fotografías, oficios PDF, planos, videos.
- **Geolocalización**: Captura automática de coordenadas GPS desde la app móvil.
- **Firma electrónica**: Cada nota se firma con e.Firma (FIEL) del usuario que la registra.
- **Sellado de tiempo**: Timestamp certificado por una autoridad de certificación (TSA).
- **Nota de cierre**: Formulario especial para cerrar la bitácora al terminar la obra.

**Módulo 3: Control de Firmas y Trazabilidad**
- Registro de quién firmó qué y cuándo.
- Hash criptográfico de cada nota para garantizar inmutabilidad.
- Historial de cambios (si se permite corrección, debe quedar registro del original y la corrección, con justificación).

**Módulo 4: Estimaciones y Avance**
- Vinculación directa entre bitácora y estimaciones.
- El residente registra en la bitácora la fecha de presentación de cada estimación (obligación legal).
- Alerta si una estimación se presentó pero no se registró en la bitácora.

**Módulo 5: Documentos y Evidencias**
- Repositorio centralizado de oficios, actas, fotografías, reportes de laboratorio.
- Cada documento se vincula a una o más notas de bitácora.
- Metadatos automáticos: fecha de captura, dispositivo, geolocalización, usuario.

**Módulo 6: Alertas y Notificaciones**
- Notificación al contratista cuando el residente hace una anotación.
- Notificación al residente cuando el contratista responde o adjunta documentos.
- Alertas de plazos: estimaciones pendientes, vencimientos de garantías, fechas límite de convenios.

**Módulo 7: Reportes y Dashboards**
- Reporte de bitácora en formato PDF (simula el libro físico foliado).
- Dashboard de avance físico y financiero.
- Exportación a Excel de todas las notas.
- Búsqueda avanzada por fecha, clasificación, concepto, responsable.

---

#### C. Flujo de Datos de una Nota

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  USUARIO        │────→│  APP / WEB      │────→│  VALIDACIÓN     │
│  (Residente,    │     │  (Formulario    │     │  (Campos        │
│  Supervisor,    │     │  de nota)       │     │  obligatorios,  │
│  Contratista)   │     │                 │     │  e.Firma)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌─────────────────────────┘
                              ▼
                       ┌─────────────────┐
                       │  GENERACIÓN DE  │
                       │  HASH + SELLO   │
                       │  DE TIEMPO      │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  ALMACENAMIENTO │
                       │  - BD relacional│
                       │  - Archivos S3  │
                       │  - Ledger       │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  NOTIFICACIÓN   │
                       │  A LAS PARTES   │
                       └─────────────────┘
```

---

#### D. Consideraciones Técnicas Clave

| Aspecto | Recomendación |
|---------|---------------|
| **Firma electrónica** | Integración con el **SAT** para validación de e.Firma (FIEL). Cada nota debe estar firmada digitalmente por quien la redacta. |
| **Inmutabilidad** | Usar **hash SHA-256** de cada nota y almacenarlo en una tabla de auditoría. Opcionalmente, usar blockchain para sellos de tiempo inmutables. |
| **Respaldo** | Backups automáticos diarios en almacenamiento georedundante. |
| **Seguridad** | Cifrado en tránsito (TLS 1.3) y en reposo (AES-256). Control de acceso basado en roles (RBAC). |
| **Disponibilidad offline** | La app móvil debe permitir capturar notas sin conexión y sincronizar al recuperarla. |
| **Cumplimiento normativo** | El sistema debe poder generar un **reporte PDF foliado** que simule la bitácora física para auditorías de la ASF. |
| **Integración BESOP** | Si es para obra pública federal, el sistema debe poder exportar datos en el formato que requiere el **Sistema BESOP** de la Secretaría Anticorrupción y Buen Gobierno. |

---

#### E. Roles y Permisos en el Sistema

| Rol | Permisos |
|-----|----------|
| **Residente de Obra** | Crear, editar (con trazabilidad), firmar y cerrar notas. Aprobar estimaciones. Registrar fecha de presentación de estimaciones. |
| **Supervisor** | Crear notas, adjuntar documentos, revisar estimaciones. No puede cerrar la bitácora. |
| **Superintendente (Contratista)** | Crear notas, responder notas del residente, adjuntar evidencias fotográficas, presentar estimaciones. |
| **Administrador de la Dependencia** | Crear obras, asignar roles, generar reportes, auditar bitácoras. |
| **Auditor / ASF** | Solo lectura de todas las bitácoras, exportación de datos, trazabilidad completa. |

---

#### F. Modelo de Datos Simplificado (Entidades Principales)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     OBRA        │◄─────►│    CONTRATO     │◄─────►│    BITACORA     │
│  - id           │       │  - numero       │       │  - id           │
│  - nombre       │       │  - monto        │       │  - obra_id      │
│  - ubicacion    │       │  - plazo        │       │  - estado       │
│  - dependencia  │       │  - fecha_inicio │       │  (abierta/cerr) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                              │                           │
                              ▼                           ▼
                       ┌─────────────────┐       ┌─────────────────┐
                       │    USUARIO      │       │     NOTA        │
                       │  - id           │       │  - id           │
                       │  - nombre       │       │  - bitacora_id  │
                       │  - rol          │       │  - numero       │
                       │  - fiel_cert    │       │  - clasificacion│
                       └─────────────────┘       │  - fecha        │
                                                 │  - descripcion  │
                                                 │  - ubicacion    │
                                                 │  - causa        │
                                                 │  - solucion     │
                                                 │  - prevencion   │
                                                 │  - consecuencia │
                                                 │  - responsable  │
                                                 │  - fecha_atenc  │
                                                 │  - referencia   │
                                                 │  - usuario_id   │
                                                 │  - hash_sha256  │
                                                 │  - sello_tiempo │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   ADJUNTO       │
                                                 │  - id           │
                                                 │  - nota_id      │
                                                 │  - tipo         │
                                                 │  - url          │
                                                 │  - metadatos    │
                                                 └─────────────────┘
```

---

### 4.8 Checklist de Implementación

Si vas a desarrollar o contratar un sistema de bitácora, verifica que cumpla con:

- [ ] Registro de nota de apertura con todos los datos del Art. 123 RLOPSRM.
- [ ] Formulario de notas con todos los campos del Art. 94 RLOPSRM.
- [ ] Firma electrónica avanzada (e.Firma / FIEL) en cada anotación.
- [ ] Sello de tiempo certificado en cada nota.
- [ ] Adjunto de fotografías, oficios y documentos con metadatos.
- [ ] Geolocalización de las notas (especialmente desde app móvil).
- [ ] Vinculación con estimaciones y registro de fechas de presentación.
- [ ] Nota de cierre de bitácora.
- [ ] Generación de reporte PDF foliado para auditorías.
- [ ] Exportación compatible con BESOP (si aplica obra federal).
- [ ] Control de acceso por roles.
- [ ] Trazabilidad inmutable (hash + auditoría).
- [ ] Disponibilidad offline en app móvil.
- [ ] Cumplimiento de seguridad (cifrado, backups, acceso restringido).

---

*Documento elaborado con base en la Ley de Obras Públicas y Servicios Relacionados con las Mismas (LOPSRM) y su Reglamento, vigentes al 2026.*
