"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { NOTIFICACION_TIPO_LABELS } from "@/lib/notificacion-tipo";
import type { Notificacion } from "@/lib/types";

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Notificacion[]>("/notificaciones/")
      .then(setNotificaciones)
      .catch(() => setError("No se pudieron cargar las notificaciones."));
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
  }, []);

  async function marcarLeida(id: number) {
    setNotificaciones((prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
    await apiFetch(`/notificaciones/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ leida: true }),
    }).catch(() => load());
  }

  async function marcarTodasLeidas() {
    setNotificaciones((prev) => (prev ?? []).map((n) => ({ ...n, leida: true })));
    await apiFetch("/notificaciones/marcar_todas_leidas/", { method: "POST" }).catch(() => load());
  }

  const hayNoLeidas = (notificaciones ?? []).some((n) => !n.leida);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground">Alertas de plataforma para plazos y acciones pendientes.</p>
        </div>
        {hayNoLeidas ? (
          <Button className="w-full sm:w-auto" variant="outline" onClick={marcarTodasLeidas}>
            Marcar todas como leídas
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : notificaciones === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : notificaciones.length === 0 ? (
            <EmptyState
              icon={Bell}
              eyebrow="Avisos de plataforma"
              title="Bandeja al día"
              description="Las alertas dirigidas a tu usuario aparecerán aquí cuando cambie el estado de un proceso asignado."
            />
          ) : (
            <ul className="divide-y">
              {notificaciones.map((n) => {
                const contenido = (
                  <div
                    className={`flex items-start gap-3 p-4 text-sm ${
                      n.leida ? "" : "bg-muted/40"
                    }`}
                  >
                    <Bell
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        n.leida ? "text-muted-foreground" : "text-primary"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={n.leida ? "secondary" : "default"}>
                          {NOTIFICACION_TIPO_LABELS[n.tipo]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(n.fecha_creacion).toLocaleString("es-MX")}
                        </span>
                      </div>
                      <p className="mt-1">{n.mensaje}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.enlace ? (
                      <Link
                        href={n.enlace}
                        onClick={() => !n.leida && marcarLeida(n.id)}
                        className="block hover:bg-muted/60"
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !n.leida && marcarLeida(n.id)}
                        className="block w-full text-left hover:bg-muted/60"
                      >
                        {contenido}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
