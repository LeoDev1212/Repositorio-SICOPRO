"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileSignature, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  CONVENIO_AFECTA_MONTO,
  CONVENIO_AFECTA_PLAZO,
  CONVENIO_STATUS_LABELS,
  CONVENIO_STATUS_VARIANTS,
  CONVENIO_TIPO_LABELS,
} from "@/lib/convenio-status";
import type { Contract, ConvenioModificatorio, ConvenioTipo } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

function NuevoConvenioDialog({
  contratoInicial,
  onCreated,
}: {
  contratoInicial: string;
  onCreated: (id: number) => void;
}) {
  const [contratos, setContratos] = useState<Contract[] | null>(null);
  const [open, setOpen] = useState(false);
  const [contrato, setContrato] = useState(contratoInicial);
  const [tipo, setTipo] = useState<ConvenioTipo>("ampliacion_cantidad");
  const [justificacion, setJustificacion] = useState("");
  const [montoDelta, setMontoDelta] = useState("");
  const [diasDelta, setDiasDelta] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || contratos !== null) return;
    apiFetch<Contract[]>("/contratos/").then(setContratos);
  }, [open, contratos]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const creado = await apiFetch<ConvenioModificatorio>("/documentos/convenios/", {
        method: "POST",
        body: JSON.stringify({
          contrato: Number(contrato),
          tipo,
          justificacion,
          monto_delta: CONVENIO_AFECTA_MONTO.includes(tipo) ? montoDelta || "0" : "0",
          dias_delta: CONVENIO_AFECTA_PLAZO.includes(tipo) ? diasDelta || "0" : "0",
        }),
      });
      setOpen(false);
      setJustificacion("");
      setMontoDelta("");
      setDiasDelta("");
      toast.success("Convenio creado en borrador.");
      onCreated(creado.id);
    } catch (err) {
      setError(errorMessage(err, "No se pudo crear el convenio."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
        <Plus />
        Nuevo convenio
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo convenio modificatorio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Contrato</Label>
            {contratos === null ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={contrato} onValueChange={(v) => setContrato(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.no_contrato} — {c.objeto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo((v as ConvenioTipo) ?? tipo)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONVENIO_TIPO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Justificación</Label>
            <Textarea value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
          </div>
          {CONVENIO_AFECTA_MONTO.includes(tipo) ? (
            <div className="space-y-1">
              <Label className="text-xs">Monto adicional/deductivo</Label>
              <Input
                type="number"
                value={montoDelta}
                onChange={(e) => setMontoDelta(e.target.value)}
                placeholder="Negativo si es una reducción"
              />
            </div>
          ) : null}
          {CONVENIO_AFECTA_PLAZO.includes(tipo) ? (
            <div className="space-y-1">
              <Label className="text-xs">Días adicionales/deducidos</Label>
              <Input
                type="number"
                value={diasDelta}
                onChange={(e) => setDiasDelta(e.target.value)}
                placeholder="Negativo si es una reducción"
              />
            </div>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !contrato || !justificacion.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConveniosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ConveniosPageInner />
    </Suspense>
  );
}

function ConveniosPageInner() {
  const { me } = useAuth();
  const searchParams = useSearchParams();
  const contratoFiltro = searchParams.get("contrato") ?? "";

  const [convenios, setConvenios] = useState<ConvenioModificatorio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const query = contratoFiltro ? `?contrato=${contratoFiltro}` : "";
    apiFetch<ConvenioModificatorio[]>(`/documentos/convenios/${query}`)
      .then(setConvenios)
      .catch(() => setError("No se pudieron cargar los convenios."));
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoFiltro]);

  const puedeCrear = me?.role === "residente" || me?.role === "dependencia";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Convenios modificatorios</h1>
          <p className="text-muted-foreground">
            Solicitud, aprobación y rechazo — actualiza el monto y plazo vigente del contrato.
          </p>
        </div>
        {puedeCrear ? (
          <NuevoConvenioDialog contratoInicial={contratoFiltro} onCreated={load} />
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : convenios === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : convenios.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              eyebrow="Modificaciones contractuales"
              title="Sin convenios registrados"
              description="Las solicitudes de ampliación o ajuste aparecerán aquí con su justificación, estado y efecto sobre monto o plazo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>No.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Justificación</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenios.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.contrato_no}</TableCell>
                    <TableCell>{c.numero}</TableCell>
                    <TableCell>{CONVENIO_TIPO_LABELS[c.tipo]}</TableCell>
                    <TableCell className="max-w-xs truncate">{c.justificacion}</TableCell>
                    <TableCell>
                      <Badge variant={CONVENIO_STATUS_VARIANTS[c.status]}>
                        {CONVENIO_STATUS_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/convenios/${c.id}`} />}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
