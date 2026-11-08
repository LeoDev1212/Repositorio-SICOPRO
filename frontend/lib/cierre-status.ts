import type { CierreStatus, CierreTipo, SuspensionCausal } from "@/lib/types";

export const SUSPENSION_CAUSAL_LABELS: Record<SuspensionCausal, string> = {
  interes_general: "Razones de interés general",
  causa_justificada: "Causa justificada que impide continuar",
  caso_fortuito: "Caso fortuito o fuerza mayor",
};

export const CIERRE_TIPO_LABELS: Record<CierreTipo, string> = {
  terminacion_cumplimiento: "Terminación por cumplimiento",
  terminacion_anticipada: "Terminación anticipada",
  rescision_administrativa: "Rescisión administrativa",
  rescision_judicial: "Rescisión judicial",
};

export const CIERRE_STATUS_LABELS: Record<CierreStatus, string> = {
  propuesta: "Propuesta",
  en_proceso: "En proceso",
  finiquitado: "Finiquitado",
  descartado: "Descartado",
};

export const CIERRE_STATUS_VARIANTS: Record<
  CierreStatus,
  "secondary" | "default" | "outline" | "destructive"
> = {
  propuesta: "outline",
  en_proceso: "default",
  finiquitado: "secondary",
  descartado: "destructive",
};

// Tipos habilitados hoy — el resto existe en el modelo (mismo criterio que
// ConvenioModificatorio.Tipo) pero su flujo todavía no está implementado.
export const CIERRE_TIPOS_DISPONIBLES: CierreTipo[] = [
  "terminacion_cumplimiento",
  "rescision_administrativa",
  "terminacion_anticipada",
  "rescision_judicial",
];

// RN-CIERRE-002: qué tipo(s) puede iniciar cada rol (mismo mapeo que
// `roles_por_tipo` en cierre/serializers.py).
export const CIERRE_TIPOS_POR_ROL: Partial<Record<string, CierreTipo[]>> = {
  superintendente: ["terminacion_cumplimiento", "terminacion_anticipada"],
  residente: ["rescision_administrativa", "terminacion_anticipada"],
  dependencia: ["rescision_administrativa", "terminacion_anticipada", "rescision_judicial"],
};
