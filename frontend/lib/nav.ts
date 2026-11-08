import {
  Bell,
  BookOpen,
  FileSignature,
  FileText,
  FolderCheck,
  FolderOpen,
  Receipt,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
}

const ALL_ROLES: Role[] = [
  "dependencia",
  "residente",
  "superintendente",
  "supervision",
  "finanzas",
];

export const NAV_ITEMS: NavItem[] = [
  { title: "Contratos", href: "/contratos", icon: FileText, roles: ALL_ROLES },
  {
    title: "Bitácora",
    href: "/bitacora",
    icon: BookOpen,
    roles: ["dependencia", "residente", "superintendente", "supervision"],
  },
  {
    title: "Estimaciones",
    href: "/estimaciones",
    icon: Receipt,
    roles: ["dependencia", "residente", "superintendente", "supervision", "finanzas"],
  },
  {
    title: "Convenios modificatorios",
    href: "/convenios",
    icon: FileSignature,
    roles: ["dependencia", "residente", "superintendente"],
  },
  {
    title: "Seguimiento",
    href: "/seguimiento",
    icon: TrendingUp,
    roles: ["dependencia", "residente", "supervision"],
  },
  {
    title: "Cierre y rescisión",
    href: "/cierre",
    icon: FolderCheck,
    roles: ["dependencia", "residente"],
  },
  { title: "Documentos", href: "/documentos", icon: FolderOpen, roles: ALL_ROLES },
  { title: "Notificaciones", href: "/notificaciones", icon: Bell, roles: ALL_ROLES },
  { title: "Auditoría", href: "/auditoria", icon: ShieldCheck, roles: ["dependencia"] },
];
