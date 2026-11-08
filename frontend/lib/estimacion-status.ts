import type { EstimacionStatus } from "@/lib/types";

export const ESTIMACION_STATUS_LABELS: Record<EstimacionStatus, string> = {
  borrador: "Borrador",
  en_revision_residente: "En revisión (Residente)",
  rechazada_residente: "Rechazada",
  aprobada_residente: "Aprobada por Residente",
  pendiente_firma: "Pendiente de firma",
  firmada: "Firmada",
};

export const ESTIMACION_STATUS_VARIANTS: Record<
  EstimacionStatus,
  "secondary" | "default" | "outline" | "destructive"
> = {
  borrador: "secondary",
  en_revision_residente: "outline",
  rechazada_residente: "destructive",
  aprobada_residente: "default",
  pendiente_firma: "outline",
  firmada: "default",
};
