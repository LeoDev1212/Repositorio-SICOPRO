"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api";
import {
  CONVENIO_AFECTA_CANTIDAD,
  CONVENIO_AFECTA_MONTO,
  CONVENIO_AFECTA_PLAZO,
  CONVENIO_STATUS_LABELS,
  CONVENIO_STATUS_VARIANTS,
  CONVENIO_TIPO_LABELS,
} from "@/lib/convenio-status";
import { formatMoney } from "@/lib/format";
import type { ConceptoCatalogo, ConvenioModificatorio } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

export default function ConvenioDetallePage() {
  const params = useParams<{ id: string }>();
  const convenioId = Number(params.id);
  const { me } = useAuth();

  const [convenio, setConvenio] = useState<ConvenioModificatorio | null>(null);
  const [catalogo, setCatalogo] = useState<ConceptoCatalogo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [concepto, setConcepto] = useState("");
  const [delta, setDelta] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [agregarError, setAgregarError] = useState<string | null>(null);

  const [aprobando, setAprobando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);

  const reload = useCallback(async () => {
    try {
      const c = await apiFetch<ConvenioModificatorio>(`/documentos/convenios/${convenioId}/`);
      setConvenio(c);
      const cat = await apiFetch<ConceptoCatalogo[]>(
        `/documentos/conceptos/?contrato=${c.contrato}`,
      );
      setCatalogo(cat);
    } catch {
      setError("No se pudo cargar el convenio.");
    }
  }, [convenioId]);

  useEffect(() => {
    const timeout = setTimeout(() => reload(), 0);
    return () => clearTimeout(timeout);
  }, [reload]);

  async function handleAgregarConcepto() {
    setAgregando(true);
    setAgregarError(null);
    try {
      await apiFetch("/documentos/convenio-conceptos/", {
        method: "POST",
        body: JSON.stringify({
          convenio: convenioId,
          concepto: Number(concepto),
          cantidad_delta: delta,
        }),
      });
      setConcepto("");
      setDelta("");
      await reload();
    } catch (err) {
      setAgregarError(errorMessage(err, "No se pudo agregar el concepto."));
    } finally {
      setAgregando(false);
    }
  }

  async function handleAprobar() {
    setAprobando(true);
    try {
      await apiFetch(`/documentos/convenios/${convenioId}/aprobar/`, { method: "POST" });
      toast.success("Convenio aprobado.");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo aprobar el convenio."));
    } finally {
      setAprobando(false);
    }
  }

  async function handleRechazar() {
    setRechazando(true);
    try {
      await apiFetch(`/documentos/convenios/${convenioId}/rechazar/`, {
        method: "POST",
        body: JSON.stringify({ motivo: motivoRechazo }),
      });
      toast.success("Convenio rechazado.");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo rechazar el convenio."));
    } finally {
      setRechazando(false);
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!convenio) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const esBorrador = convenio.status === "borrador";
  const canEdit = (me?.role === "residente" || me?.role === "dependencia") && esBorrador;
  const canAprobar = me?.role === "dependencia" && esBorrador;
  const convenioListoParaAprobar =
    (!CONVENIO_AFECTA_CANTIDAD.includes(convenio.tipo) || convenio.conceptos.length > 0) &&
    (!CONVENIO_AFECTA_MONTO.includes(convenio.tipo) || Number(convenio.monto_delta) !== 0) &&
    (!CONVENIO_AFECTA_PLAZO.includes(convenio.tipo) || convenio.dias_delta !== 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {convenio.contrato_no} — Convenio {convenio.numero}
        </h1>
        <Badge variant={CONVENIO_STATUS_VARIANTS[convenio.status]}>
          {CONVENIO_STATUS_LABELS[convenio.status]}
        </Badge>
      </div>
      <p className="text-muted-foreground">{CONVENIO_TIPO_LABELS[convenio.tipo]}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Justificación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{convenio.justificacion}</p>

          {CONVENIO_AFECTA_MONTO.includes(convenio.tipo) ||
          CONVENIO_AFECTA_PLAZO.includes(convenio.tipo) ? (
            <div className="mt-4 flex gap-6 border-t pt-4 text-sm">
              {CONVENIO_AFECTA_MONTO.includes(convenio.tipo) ? (
                <div>
                  <p className="text-muted-foreground">Monto adicional/deductivo</p>
                  <p className="font-medium">
                    {Number(convenio.monto_delta) >= 0 ? "+" : ""}
                    {formatMoney(convenio.monto_delta)}
                  </p>
                </div>
              ) : null}
              {CONVENIO_AFECTA_PLAZO.includes(convenio.tipo) ? (
                <div>
                  <p className="text-muted-foreground">Días adicionales/deducidos</p>
                  <p className="font-medium">
                    {convenio.dias_delta >= 0 ? "+" : ""}
                    {convenio.dias_delta} días
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {convenio.status === "rechazado" && convenio.motivo_rechazo ? (
            <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              Rechazado: {convenio.motivo_rechazo}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {CONVENIO_AFECTA_CANTIDAD.includes(convenio.tipo) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conceptos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {convenio.conceptos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convenio.conceptos.map((c) => {
                    const cat = catalogo.find((k) => k.id === c.concepto);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{cat?.clave ?? c.concepto}</TableCell>
                        <TableCell>
                          {Number(c.cantidad_delta) >= 0 ? "+" : ""}
                          {c.cantidad_delta}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Sin conceptos capturados todavía.</p>
            )}

            {canEdit ? (
              <div className="flex items-end gap-2 border-t pt-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Concepto</Label>
                  <Select value={concepto} onValueChange={(v) => setConcepto(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogo.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.clave} — {c.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Delta</Label>
                  <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
                </div>
                <Button onClick={handleAgregarConcepto} disabled={agregando || !concepto || !delta}>
                  {agregando ? <Loader2 className="animate-spin" /> : null}
                  Agregar
                </Button>
              </div>
            ) : null}
            {agregarError ? <p className="text-sm text-destructive">{agregarError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {canAprobar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decisión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Motivo de rechazo (si aplica)</Label>
              <Textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Requerido solo para rechazar"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleRechazar}
                disabled={rechazando || !motivoRechazo.trim()}
              >
                {rechazando ? <Loader2 className="animate-spin" /> : null}
                Rechazar
              </Button>
              <Button onClick={handleAprobar} disabled={aprobando || !convenioListoParaAprobar}>
                {aprobando ? <Loader2 className="animate-spin" /> : null}
                Aprobar convenio
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
