export const AUDITORIA_MODULOS: { value: string; label: string }[] = [
  { value: "contracts", label: "Contratos" },
  { value: "documentos", label: "Documentos / Convenios" },
  { value: "estimaciones", label: "Estimaciones" },
  { value: "bitacora", label: "Bitácora" },
  { value: "notificaciones", label: "Notificaciones" },
  { value: "cierre", label: "Cierre y rescisión" },
  { value: "users", label: "Usuarios" },
];

export const AUDITORIA_MODULO_LABELS: Record<string, string> = Object.fromEntries(
  AUDITORIA_MODULOS.map((m) => [m.value, m.label]),
);
