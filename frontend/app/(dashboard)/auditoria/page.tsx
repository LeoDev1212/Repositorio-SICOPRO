"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { AUDITORIA_MODULOS, AUDITORIA_MODULO_LABELS } from "@/lib/auditoria";
import type { AuditoriaEvento } from "@/lib/types";

const EXITOSA_OPCIONES = [
  { value: "todas", label: "Todas" },
  { value: "true", label: "Solo exitosas" },
  { value: "false", label: "Solo fallidas" },
];

function buildQuery(filtros: { modulo: string; accion: string; actor: string; exitosa: string }) {
  const params = new URLSearchParams();
  if (filtros.modulo) params.set("modulo", filtros.modulo);
  if (filtros.accion) params.set("accion", filtros.accion);
  if (filtros.actor) params.set("actor", filtros.actor);
  if (filtros.exitosa !== "todas") params.set("exitosa", filtros.exitosa);
  const qs = params.toString();
  return qs ? `/auditoria/?${qs}` : "/auditoria/";
}

export default function AuditoriaPage() {
  const [modulo, setModulo] = useState("");
  const [accion, setAccion] = useState("");
  const [actor, setActor] = useState("");
  const [exitosa, setExitosa] = useState("todas");

  const [eventos, setEventos] = useState<AuditoriaEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<AuditoriaEvento | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      apiFetch<AuditoriaEvento[]>(buildQuery({ modulo, accion, actor, exitosa }))
        .then(setEventos)
        .catch(() => setError("No se pudo cargar el registro de auditoría."));
    }, 300);
    return () => clearTimeout(timeout);
  }, [modulo, accion, actor, exitosa]);

  function limpiar() {
    setModulo("");
    setAccion("");
    setActor("");
    setExitosa("todas");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground">
          Registro técnico de quién hizo qué, cuándo y desde dónde en toda la plataforma.
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={modulo || "todos"}
            onValueChange={(v) => setModulo(!v || v === "todos" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los módulos</SelectItem>
              {AUDITORIA_MODULOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar por acción..."
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
          />

          <Input
            placeholder="Buscar por usuario..."
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          />

          <Select value={exitosa} onValueChange={(v) => setExitosa(v ?? "todas")}>
            <SelectTrigger>
              <SelectValue placeholder="Resultado" />
            </SelectTrigger>
            <SelectContent>
              {EXITOSA_OPCIONES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={limpiar}>
            Limpiar filtros
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : eventos === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : eventos.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              eyebrow="Bitácora de actividad"
              title="Sin eventos para estos filtros"
              description="Prueba otra combinación de módulo, acción, usuario o resultado para ampliar la consulta."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((evento) => (
                  <TableRow
                    key={evento.id}
                    className="cursor-pointer"
                    onClick={() => setSeleccionado(evento)}
                  >
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(evento.fecha).toLocaleString("es-MX")}
                    </TableCell>
                    <TableCell className="font-medium">{evento.actor_nombre}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{evento.metodo}</span>{" "}
                      {evento.accion}
                    </TableCell>
                    <TableCell>
                      {AUDITORIA_MODULO_LABELS[evento.modulo] ?? evento.modulo}
                    </TableCell>
                    <TableCell>
                      <Badge variant={evento.exitosa ? "default" : "destructive"}>
                        {evento.status_code}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={seleccionado !== null} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalle del evento</SheetTitle>
            <SheetDescription>
              Solo metadato de la acción — sin el cuerpo de la petición/respuesta.
            </SheetDescription>
          </SheetHeader>
          {seleccionado ? (
            <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Usuario</p>
                <p>{seleccionado.actor_nombre}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Acción</p>
                <p>
                  {seleccionado.metodo} — {seleccionado.accion}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Módulo / recurso</p>
                <p>
                  {AUDITORIA_MODULO_LABELS[seleccionado.modulo] ?? seleccionado.modulo} /{" "}
                  {seleccionado.recurso}
                </p>
              </div>
              {seleccionado.objeto_id !== null ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">ID del objeto</p>
                  <p>{seleccionado.objeto_id}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase text-muted-foreground">Ruta</p>
                <p className="break-all font-mono text-xs">{seleccionado.ruta}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Resultado</p>
                <Badge variant={seleccionado.exitosa ? "default" : "destructive"}>
                  {seleccionado.status_code}
                </Badge>
              </div>
              {seleccionado.ip ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">IP</p>
                  <p>{seleccionado.ip}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase text-muted-foreground">Fecha y hora</p>
                <p>{new Date(seleccionado.fecha).toLocaleString("es-MX")}</p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
