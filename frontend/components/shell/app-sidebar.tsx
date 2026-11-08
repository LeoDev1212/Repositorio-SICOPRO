"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Construction } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_ITEMS } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { me, loading } = useAuth();
  const items = me ? NAV_ITEMS.filter((item) => item.roles.includes(me.role)) : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 pb-5 pt-5">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="relative grid size-10 shrink-0 place-items-center rounded-md bg-sidebar-primary font-heading text-lg font-bold text-sidebar-primary-foreground">
            <Construction className="size-5" aria-hidden="true" />
            <span className="absolute -bottom-1 -right-1 size-2 rounded-full border border-sidebar bg-sidebar-foreground/70" />
          </div>
          <div className="flex min-w-0 flex-col gap-1 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-mono text-[10px] uppercase text-sidebar-primary">SICOPRO / OBRA</span>
            <span className="truncate text-sm font-semibold text-sidebar-foreground">Gestión de contratos</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="px-3 font-mono text-[10px] uppercase text-sidebar-foreground/50">
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <SidebarMenuItem key={index}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))
                : items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={
                          <Link
                            href={item.href}
                            onClick={() => isMobile && setOpenMobile(false)}
                          />
                        }
                        isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                        tooltip={item.title}
                        className="h-10 rounded-md px-3 text-sidebar-foreground/75 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto p-0">
        <div className="border-t border-sidebar-border px-5 py-4 group-data-[collapsible=icon]:hidden">
          <p className="font-mono text-[10px] uppercase text-sidebar-foreground/45">Entorno académico</p>
          <p className="mt-1 text-xs text-sidebar-foreground/75">Control y seguimiento de obra</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
