import type { ConvenioStatus, ConvenioTipo } from "@/lib/types";

export const CONVENIO_TIPO_LABELS: Record<ConvenioTipo, string> = {
  ampliacion_cantidad: "Ampliación de cantidad",
  ampliacion_monto: "Ampliación de monto",
  ampliacion_plazo: "Ampliación de plazo",
  mixto: "Mixto",
};

export const CONVENIO_STATUS_LABELS: Record<ConvenioStatus, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export const CONVENIO_STATUS_VARIANTS: Record<
  ConvenioStatus,
  "secondary" | "default" | "outline" | "destructive"
> = {
  borrador: "secondary",
  aprobado: "default",
  rechazado: "destructive",
};

// RN-CONV-004: qué exige `aprobar()` según el tipo declarado.
export const CONVENIO_AFECTA_MONTO: ConvenioTipo[] = ["ampliacion_monto", "mixto"];
export const CONVENIO_AFECTA_PLAZO: ConvenioTipo[] = ["ampliacion_plazo", "mixto"];
export const CONVENIO_AFECTA_CANTIDAD: ConvenioTipo[] = ["ampliacion_cantidad", "mixto"];
