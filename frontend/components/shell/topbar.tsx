"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { apiFetch } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/roles";
import { NAV_ITEMS } from "@/lib/nav";
import type { Notificacion } from "@/lib/types";

function NotificacionesBell() {
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      apiFetch<Notificacion[]>("/notificaciones/")
        .then((data) => setNoLeidas(data.filter((n) => !n.leida).length))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Ver notificaciones"
      title="Ver notificaciones"
      nativeButton={false}
      render={<Link href="/notificaciones" />}
    >
      <Bell className="h-4 w-4" />
      {noLeidas > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
          {noLeidas > 9 ? "9+" : noLeidas}
        </span>
      ) : null}
    </Button>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useAuth();
  const activeItem = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  async function handleLogout() {
    await apiFetch("/auth/logout/", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const displayName = me
    ? [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email
    : "";

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-card/90 px-4 backdrop-blur-md sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-7" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {activeItem?.title ?? "Panel"}
        </p>
        <p className="hidden truncate font-mono text-[10px] uppercase text-muted-foreground sm:block">
          {me ? ROLE_LABELS[me.role] : ""} / SICOPRO
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {me ? <NotificacionesBell /> : null}
        {me ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="text-xs">{me.initials || "??"}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{displayName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{me.email}</span>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
