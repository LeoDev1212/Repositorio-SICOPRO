import type { BitacoraEstado, NotaClasificacion } from "@/lib/types";

export const BITACORA_ESTADO_LABELS: Record<BitacoraEstado, string> = {
  abierta: "Abierta",
  cerrada: "Cerrada",
};

export const BITACORA_ESTADO_VARIANTS: Record<
  BitacoraEstado,
  "secondary" | "default" | "outline" | "destructive"
> = {
  abierta: "default",
  cerrada: "secondary",
};

export const NOTA_CLASIFICACION_LABELS: Record<NotaClasificacion, string> = {
  apertura: "Apertura",
  avance: "Avance",
  modificacion: "Modificación",
  incidencia: "Incidencia",
  calidad: "Calidad",
  seguridad: "Seguridad",
  comunicacion: "Comunicación",
  cierre: "Cierre",
};

// Clasificaciones que genera el sistema automáticamente — no se ofrecen en
// el formulario de captura manual de notas (mismo criterio que el backend,
// ver NotaBitacoraSerializer.validate).
export const NOTA_CLASIFICACIONES_CAPTURABLES: NotaClasificacion[] = [
  "avance",
  "modificacion",
  "incidencia",
  "calidad",
  "seguridad",
  "comunicacion",
];
