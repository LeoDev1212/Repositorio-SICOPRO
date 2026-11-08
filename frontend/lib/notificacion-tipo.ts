import type { NotificacionTipo } from "@/lib/types";

export const NOTIFICACION_TIPO_LABELS: Record<NotificacionTipo, string> = {
  estimacion_aprobada: "Estimación aprobada",
  estimacion_rechazada: "Estimación rechazada",
  estimacion_firmada: "Estimación firmada",
  estimacion_pago: "Aviso de pago anterior",
  convenio_aprobado: "Convenio aprobado",
  convenio_rechazado: "Convenio rechazado",
  cierre_propuesta: "Propuesta de rescisión registrada",
  cierre_iniciado: "Inicio de cierre notificado",
  cierre_resolucion_rescision: "Rescisión administrativa resuelta",
  cierre_finiquitado: "Cierre finiquitado",
  suspension_registrada: "Suspensión registrada",
  suspension_resuelta: "Suspensión resuelta",
  contratista_inhabilitado: "Contratista inhabilitado",
};
