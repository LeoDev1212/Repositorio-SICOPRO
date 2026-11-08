# Estimación de Obra según la LOPSRM: Números Generadores, Evidencias y Flujo de Presentación

## 1. ¿Qué es una Estimación de Obra?

Una estimación de obra es el documento de cobro periódico (normalmente mensual o quincenal) que formaliza el pago de los trabajos ejecutados durante un período determinado. Recoge las cantidades de obra realizadas, las multiplica por los precios unitarios pactados en el contrato y produce el importe que el contratista tiene derecho a cobrar. 

> **Nota clave:** No es un presupuesto ni una proyección: es el documento contractual que hace exigible el pago de una parte del trabajo contratado.

---

## 2. Los Números Generadores

### ¿Qué son?
El **número generador** (o generador de obra) es el documento que detalla, elemento por elemento, cómo se midieron o calcularon las cantidades de trabajo ejecutadas en cada concepto de una obra. Registra de forma ordenada y verificable las dimensiones, conteos y operaciones aritméticas que justifican la cantidad total reportada en una estimación. 

### ¿Para qué sirven?
* **Soporte de cobro:** Es el respaldo técnico de cada estimación. Sin generador, la estimación no tiene fundamento numérico verificable.
* **Control de avance:** Permite rastrear exactamente qué cantidad de cada concepto ya fue ejecutada y qué falta.
* **Trazabilidad técnica:** En auditorías o controversias, el generador permite reconstruir qué se midió, cuándo y con qué criterio.
* **Base del finiquito:** La suma de todos los generadores debe cuadrar con el total contratado en el catálogo de conceptos. 

### Estructura básica de un número generador

| Campo | Descripción |
| :--- | :--- |
| **Clave** | Número del concepto en el catálogo |
| **Descripción** | Texto del concepto según el catálogo |
| **Unidad** | Unidad de medida ($m^2$, $m^3$, $kg$, $ml$, $pza$) |
| **Elemento** | Identificación del elemento medido (eje, tramo, nivel) |
| **N** | Número de repeticiones |
| **L** | Largo (metros) |
| **A** | Ancho (metros) |
| **H** | Alto o espesor (metros) |
| **Parcial** | Resultado de $N \times L \times A \times H$ |
| **Observaciones** | Referencia al plano, croquis o nota aclaratoria |

Al pie del generador debe constar:
* Total acumulado del concepto en la estimación actual
* Total acumulado en estimaciones anteriores
* Total acumulado a la fecha
* Cantidad contratada pendiente por ejecutar
* Firmas del residente de obra (contratista) y supervisor de obra (dependencia) 

---

## 3. Evidencias Fotográficas

Las evidencias fotográficas son el registro visual que acredita que el trabajo reportado en el número generador y la estimación fue realmente ejecutado en el período correspondiente. Aunque la LOPSRM no define un formato específico para las fotografías, en la práctica de obra pública son un requisito indispensable porque:

* **Complementan los números generadores:** Mientras el generador dice *cuánto* se hizo, la foto dice *dónde* y *cómo* se hizo.
* **Sirven ante auditorías:** La ASF, la SFP u otros órganos de fiscalización pueden solicitarlas para validar que el gasto público corresponde a obra realmente ejecutada.
* **Documentan el estado de los trabajos:** Son útiles para resolver disputas sobre calidad, alcance o fechas de ejecución.

### Buenas prácticas para las evidencias fotográficas
1. Tomarlas durante la medición en campo, con fecha y hora visible.
2. Incluir referencias geográficas o de plano en la imagen (ejes, niveles, croquis).
3. Fotografiar **antes, durante y después** de los trabajos cuando aplique.
4. Numerarlas correlativamente y ligarlas al concepto del catálogo que documentan.
5. Firmarlas o sellarlas por el residente y el supervisor.

---

## 4. Relación con los Precios Unitarios

El flujo de documentos es claro y jerárquico:

```text
Catálogo de Conceptos (contrato)
         ↓
   Número Generador (medición en campo)
         ↓
    Estimación de Obra (cobro)
```

| Documento | Función | Relación con Precios Unitarios |
| :--- | :--- | :--- |
| **Catálogo de conceptos** | Lista de trabajos contratados con precio y cantidad total | Define los precios unitarios pactados en el contrato |
| **Número generador** | Medición detallada de lo ejecutado en un período | No incluye precios, solo cantidades físicas medidas |
| **Estimación** | Documento de cobro | Multiplica las cantidades del generador $\times$ los precios unitarios del catálogo para obtener el importe a pagar |

> **Importante:** Los precios unitarios son inmodificables durante la ejecución del contrato (salvo ajustes de costos por escalatoria cuando el contrato lo prevea). Lo que cambia de estimación en estimación son las cantidades ejecutadas, no los precios.

---

## 5. Partes de una Estimación

Una estimación completa bajo la LOPSRM debe contener:

### A. Encabezado
* Nombre y número del contrato
* Nombre de la obra y ubicación
* Número de estimación consecutivo
* Período de ejecución que cubre
* Fecha de presentación

### B. Cuerpo (cuadro de cantidades y precios)

| Clave | Descripción | Unidad | Cantidad Ejecutada | Precio Unitario | Importe Parcial |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **C-01** | Excavación a mano | $m^3$ | 45.20 | $350.00 | $15,820.00 |
| **C-02** | Muro de mampostería | $m^2$ | 91.05 | $480.00 | $43,704.00 |

### C. Resumen de importes
* **Subtotal** (suma de importes parciales)
* **IVA** (cuando aplique)
* **Importe bruto** (subtotal + IVA)
* **Deducciones:**
  * Amortización de anticipo
  * Fondo de garantía (típicamente 5%)
  * Penalizaciones por atraso (si aplica)
  * Otras deducciones contractuales
* **Importe neto a pagar**

### D. Anexos
* Números generadores de cada concepto reportado
* Evidencias fotográficas de los trabajos ejecutados
* Bitácora de obra (cuando se requiera)
* Programa de ejecución actualizado
* Reporte de materiales (si aplica)

---

## 6. Flujo para Presentar una Estimación (LOPSRM)

El proceso formal en obra pública es el siguiente:

1. **Paso 1: Medición en campo**
   * El residente de obra del contratista sale a campo con el supervisor de la dependencia.
   * Se toman medidas físicas de cada concepto ejecutado en el período.
   * Se toman fotografías de evidencia.
   * Ambas partes firman las mediciones en el momento.

2. **Paso 2: Elaboración del número generador**
   * El residente organiza las mediciones por concepto, elemento por elemento.
   * Se calculan parciales y totales.
   * Se cruza con el acumulado de estimaciones anteriores.
   * Se verifica que no se rebase la cantidad contratada.

3. **Paso 3: Elaboración de la estimación**
   * Se toman las cantidades del número generador.
   * Se multiplican por los precios unitarios del contrato.
   * Se aplican deducciones (anticipo, fondo de garantía, etc.).
   * Se anexan los generadores y evidencias fotográficas.

4. **Paso 4: Presentación al supervisor**
   * El contratista entrega la estimación completa al supervisor de obra de la dependencia.
   * El supervisor verifica las cantidades en campo si lo considera necesario.

5. **Paso 5: Revisión y autorización**
   * La dependencia tiene **15 días hábiles** para revisar la estimación desde su presentación.
   * Si detecta errores, la devuelve para corrección.
   * Si está correcta, la autoriza para pago.

6. **Paso 6: Pago**
   * Una vez autorizada, la dependencia tiene **20 días naturales** para efectuar el pago.
   * Si no paga en ese plazo, el contratista tiene derecho a cobrar intereses a la tasa del Banco de México más dos puntos porcentuales.

---

## 7. Requisitos Legales Clave bajo la LOPSRM

* **Sin número generador aprobado, no hay pago.** La estimación sin generador no es procedente; la dependencia puede devolverla.
* **Fondo de garantía:** El fondo de garantía (generalmente 5%) se retiene de cada estimación y se libera al finiquito, una vez que el contratista acredite cumplimiento fiscal y de seguridad social.
* **Plazos normativos:** Los plazos de pago son normativos y de estricto cumplimiento para la dependencia.

---

### Resumen Visual del Flujo

```text
┌─────────────────────────────────────────────────────────────┐
│  1. MEDICIÓN EN CAMPO                                       │
│     (Residente + Supervisor + Fotografías)                  │
│              ↓                                              │
│  2. NÚMERO GENERADOR                                        │
│     (Cantidades medidas, firmadas por ambas partes)         │
│              ↓                                              │
│  3. ESTIMACIÓN DE OBRA                                      │
│     (Cantidades × Precios Unitarios = Importe bruto)        │
│     (Menos: Anticipo, Fondo de Garantía, Penalizaciones)      │
│              ↓                                              │
│  4. PRESENTACIÓN A LA DEPENDENCIA                           │
│              ↓                                              │
│  5. REVISIÓN (15 días hábiles)                              │
│              ↓                                              │
│  6. AUTORIZACIÓN                                            │
│              ↓                                              │
│  7. PAGO (20 días naturales)                                │
└─────────────────────────────────────────────────────────────┘
```
