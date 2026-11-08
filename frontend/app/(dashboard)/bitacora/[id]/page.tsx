"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api";
import {
  BITACORA_ESTADO_LABELS,
  BITACORA_ESTADO_VARIANTS,
  NOTA_CLASIFICACIONES_CAPTURABLES,
  NOTA_CLASIFICACION_LABELS,
} from "@/lib/bitacora-status";
import { formatDate } from "@/lib/format";
import type { Bitacora, Contract, NotaBitacora } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

const EMPTY_NOTA = {
  clasificacion: "avance" as string,
  descripcion: "",
  ubicacion: "",
  causa: "",
  solucion: "",
  prevencion: "",
  consecuencia_economica: "",
  responsable: "",
  fecha_atencion: "",
  nota_referencia: "" as string,
};

function NuevaNotaDialog({
  bitacoraId,
  notas,
  onCreated,
}: {
  bitacoraId: number;
  notas: NotaBitacora[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_NOTA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/bitacora/notas/", {
        method: "POST",
        body: JSON.stringify({
          bitacora: bitacoraId,
          clasificacion: draft.clasificacion,
          descripcion: draft.descripcion,
          ubicacion: draft.ubicacion,
          causa: draft.causa,
          solucion: draft.solucion,
          prevencion: draft.prevencion,
          consecuencia_economica: draft.consecuencia_economica || null,
          responsable: draft.responsable,
          fecha_atencion: draft.fecha_atencion || null,
          nota_referencia: draft.nota_referencia ? Number(draft.nota_referencia) : null,
        }),
      });
      setOpen(false);
      setDraft(EMPTY_NOTA);
      onCreated();
      toast.success("Nota registrada.");
    } catch (err) {
      setError(errorMessage(err, "No se pudo registrar la nota."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Nueva nota
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva nota de bitácora</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Clasificación</Label>
            <Select
              value={draft.clasificacion}
              onValueChange={(value) => setDraft((p) => ({ ...p, clasificacion: value ?? "avance" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTA_CLASIFICACIONES_CAPTURABLES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {NOTA_CLASIFICACION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              value={draft.descripcion}
              onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ubicación</Label>
              <Input
                value={draft.ubicacion}
                onChange={(e) => setDraft((p) => ({ ...p, ubicacion: e.target.value }))}
                placeholder="Eje, tramo, nivel"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsable</Label>
              <Input
                value={draft.responsable}
                onChange={(e) => setDraft((p) => ({ ...p, responsable: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Causa</Label>
            <Textarea
              value={draft.causa}
              onChange={(e) => setDraft((p) => ({ ...p, causa: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Solución</Label>
            <Textarea
              value={draft.solucion}
              onChange={(e) => setDraft((p) => ({ ...p, solucion: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prevención</Label>
            <Textarea
              value={draft.prevencion}
              onChange={(e) => setDraft((p) => ({ ...p, prevencion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Consecuencia económica</Label>
              <Input
                type="number"
                value={draft.consecuencia_economica}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, consecuencia_economica: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de atención</Label>
              <Input
                type="date"
                value={draft.fecha_atencion}
                onChange={(e) => setDraft((p) => ({ ...p, fecha_atencion: e.target.value }))}
              />
            </div>
          </div>
          {notas.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Responde a la nota (opcional)</Label>
              <Select
                value={draft.nota_referencia}
                onValueChange={(value) => setDraft((p) => ({ ...p, nota_referencia: value ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  {notas.map((n) => (
                    <SelectItem key={n.id} value={String(n.id)}>
                      Nota {n.numero} — {NOTA_CLASIFICACION_LABELS[n.clasificacion]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !draft.descripcion.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CerrarBitacoraDialog({
  bitacoraId,
  onClosed,
}: {
  bitacoraId: number;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCerrar() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/bitacora/${bitacoraId}/cerrar/`, {
        method: "POST",
        body: JSON.stringify({ motivo }),
      });
      setOpen(false);
      setMotivo("");
      onClosed();
      toast.success("Bitácora cerrada.");
    } catch (err) {
      setError(errorMessage(err, "No se pudo cerrar la bitácora."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Cerrar bitácora</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar bitácora</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label className="text-xs">Motivo / resumen de cierre</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Se registra como la nota de cierre. Una bitácora cerrada no admite más notas.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleCerrar} disabled={saving || !motivo.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BitacoraDetallePage() {
  const params = useParams<{ id: string }>();
  const bitacoraId = Number(params.id);
  const { me } = useAuth();

  const [bitacora, setBitacora] = useState<Bitacora | null>(null);
  const [contrato, setContrato] = useState<Contract | null>(null);
  const [notas, setNotas] = useState<NotaBitacora[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const bit = await apiFetch<Bitacora>(`/bitacora/${bitacoraId}/`);
      setBitacora(bit);
      const [contratoData, notasData] = await Promise.all([
        apiFetch<Contract>(`/contratos/${bit.contrato}/`),
        apiFetch<NotaBitacora[]>(`/bitacora/notas/?bitacora=${bitacoraId}`),
      ]);
      setContrato(contratoData);
      setNotas(notasData);
    } catch {
      setError("No se pudo cargar la bitácora.");
    }
  }, [bitacoraId]);

  useEffect(() => {
    const timeout = setTimeout(() => reload(), 0);
    return () => clearTimeout(timeout);
  }, [reload]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!bitacora || !contrato) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const puedeCrearNota =
    bitacora.estado === "abierta" &&
    ["residente", "superintendente", "supervision"].includes(me?.role ?? "");

  const notasPorId = Object.fromEntries(notas.map((n) => [n.id, n]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contrato.no_contrato} — Bitácora
            </h1>
            <Badge variant={BITACORA_ESTADO_VARIANTS[bitacora.estado]}>
              {BITACORA_ESTADO_LABELS[bitacora.estado]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Apertura {formatDate(bitacora.fecha_apertura)} · {bitacora.abierta_por_nombre}
            {bitacora.fecha_cierre ? ` · Cierre ${formatDate(bitacora.fecha_cierre)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {me?.role === "residente" && bitacora.estado === "abierta" ? (
            <CerrarBitacoraDialog bitacoraId={bitacora.id} onClosed={reload} />
          ) : null}
          {puedeCrearNota ? (
            <NuevaNotaDialog bitacoraId={bitacora.id} notas={notas} onCreated={reload} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          {notas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin notas todavía.</p>
          ) : (
            <ul className="space-y-4">
              {notas.map((nota) => (
                <li key={nota.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Nota {nota.numero}</span>
                      <Badge variant="outline">{NOTA_CLASIFICACION_LABELS[nota.clasificacion]}</Badge>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(nota.fecha).toLocaleString("es-MX")}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{nota.autor_nombre}</p>
                  <p className="mt-2 whitespace-pre-wrap">{nota.descripcion}</p>
                  {nota.ubicacion ? (
                    <p className="mt-1 text-muted-foreground">Ubicación: {nota.ubicacion}</p>
                  ) : null}
                  {nota.causa ? (
                    <p className="mt-1 text-muted-foreground">Causa: {nota.causa}</p>
                  ) : null}
                  {nota.solucion ? (
                    <p className="mt-1 text-muted-foreground">Solución: {nota.solucion}</p>
                  ) : null}
                  {nota.prevencion ? (
                    <p className="mt-1 text-muted-foreground">Prevención: {nota.prevencion}</p>
                  ) : null}
                  {nota.responsable ? (
                    <p className="mt-1 text-muted-foreground">Responsable: {nota.responsable}</p>
                  ) : null}
                  {nota.consecuencia_economica ? (
                    <p className="mt-1 text-muted-foreground">
                      Consecuencia económica: {nota.consecuencia_economica}
                    </p>
                  ) : null}
                  {nota.fecha_atencion ? (
                    <p className="mt-1 text-muted-foreground">
                      Atendida: {formatDate(nota.fecha_atencion)}
                    </p>
                  ) : null}
                  {nota.nota_referencia && notasPorId[nota.nota_referencia] ? (
                    <p className="mt-1 text-muted-foreground">
                      En respuesta a la nota {notasPorId[nota.nota_referencia].numero}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
