# Plan — Mínimos de registro de contrato (RN-CONTRATO-001/002)

**Estado:** implementado y verificado. Última actualización: 2026-08-28.

---

## 1. Origen

Durante la corrección de los 9 campos sin validar encontrados en la
"Radiografía de Contrato" (artifact, ver
[[project-validation-gaps-2026-08-28]] en memoria), `Contract.monto` y
`Contract.plazo_dias` solo se corrigieron para rechazar valores absurdos
(≤ 0). El usuario pidió después subir el mínimo real de negocio, no solo
cerrar el caso degenerado:

- **`plazo_dias`**: mínimo un mes (30 días).
- **`monto`**: mayor a $10,000.00.

## 2. Regla

`backend/contracts/serializers.py`, `ContractSerializer`:

```python
def validate_monto(self, value):
    if value <= 10000:
        raise serializers.ValidationError("Debe ser mayor a $10,000.00 (RN-CONTRATO-001).")
    return value

def validate_plazo_dias(self, value):
    if value < 30:
        raise serializers.ValidationError("Debe ser de al menos 30 días (un mes) (RN-CONTRATO-002).")
    return value
```

- `RN-CONTRATO-001`: `monto` debe ser **estrictamente mayor** a $10,000.00
  (10,000.00 exacto se rechaza).
- `RN-CONTRATO-002`: `plazo_dias` debe ser **mayor o igual** a 30 (30 exacto
  se acepta — "un mes" se interpretó como el piso, no como el primer valor
  excluido, a diferencia del monto).

Ambas corren tanto al crear como al editar un contrato (son
`validate_<campo>` de DRF, se evalúan en cualquier `create`/`update` que
pase por `ContractSerializer`).

## 3. Verificación

Probado contra Docker real con los 4 valores frontera:

| monto | plazo_dias | Resultado |
|---|---|---|
| 10,000.00 | 30 | `400` — monto en el límite exacto, rechazado |
| 10,000.01 | 30 | `201` — un centavo arriba, aceptado |
| 15,000.00 | 29 | `400` — un día debajo del mínimo, rechazado |
| 15,000.00 | 30 | `201` — plazo en el límite exacto, aceptado |

`manage.py check`/`makemigrations --check` limpios — sin migración, es
validación de serializer.

## 4. Fuera de alcance

- No se tocó `Contract.plazo_vigente_dias` (el cómputo con convenios/
  suspensiones ya existente) — el mínimo aplica solo al plazo *original*
  capturado al registrar el contrato.
- Sin mínimo distinto por tipo de obra ni por dependencia — un solo mínimo
  global, igual que el resto de las reglas de este proyecto (alcance
  académico, sin catálogos de excepción).
