import type { ContractStatus } from "@/lib/types";

export const STATUS_LABELS: Record<ContractStatus, string> = {
  registrado: "Registrado",
  activo: "Activo",
  en_cierre: "En cierre",
  cerrado: "Cerrado",
};

export const STATUS_VARIANTS: Record<ContractStatus, "secondary" | "default" | "outline"> = {
  registrado: "secondary",
  activo: "default",
  en_cierre: "outline",
  cerrado: "outline",
};
