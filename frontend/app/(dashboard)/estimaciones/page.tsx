"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Receipt } from "lucide-react";
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
import { apiFetch, ApiError } from "@/lib/api";
import { ESTIMACION_STATUS_LABELS, ESTIMACION_STATUS_VARIANTS } from "@/lib/estimacion-status";
import { formatDate, formatMoney } from "@/lib/format";
import type { Contract, Estimacion } from "@/lib/types";

const EMPTY_DRAFT = {
  contrato: "",
  mes_programa: "",
};

function NuevaEstimacionDialog({ onCreated }: { onCreated: () => void }) {
  const [contratos, setContratos] = useState<Contract[] | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || contratos !== null) return;
    apiFetch<Contract[]>("/contratos/").then((data) =>
      setContratos(data.filter((c) => c.status === "activo")),
    );
  }, [open, contratos]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/estimaciones/", {
        method: "POST",
        body: JSON.stringify({
          contrato: Number(draft.contrato),
          mes_programa: Number(draft.mes_programa),
        }),
      });
      setOpen(false);
      setDraft(EMPTY_DRAFT);
      onCreated();
      toast.success("Estimación creada.");
    } catch (err) {
      setError(
        err instanceof ApiError && err.body && typeof err.body === "object"
          ? String(Object.values(err.body as Record<string, unknown>)[0])
          : "No se pudo crear la estimación.",
      );
    } finally {
      setSaving(false);
    }
  }

  const puedeGuardar = draft.contrato && draft.mes_programa;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
        <Plus />
        Nueva estimación
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva estimación</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Contrato</Label>
            {contratos === null ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={draft.contrato}
                onValueChange={(value) => setDraft((p) => ({ ...p, contrato: value ?? "" }))}
              >
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
            <Label className="text-xs">Mes del programa</Label>
            <Input
              type="number"
              min={1}
              value={draft.mes_programa}
              onChange={(e) => setDraft((p) => ({ ...p, mes_programa: e.target.value }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            El periodo que cubre se calcula automáticamente a partir del mes del programa; no se
            captura a mano.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !puedeGuardar}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EstimacionesPage() {
  const { me } = useAuth();
  const [estimaciones, setEstimaciones] = useState<Estimacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Estimacion[]>("/estimaciones/")
      .then(setEstimaciones)
      .catch(() => setError("No se pudieron cargar las estimaciones."));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estimaciones</h1>
          <p className="text-muted-foreground">
            Captura, revisión, firma y control de pago de estimaciones de obra.
          </p>
        </div>
        {me?.role === "superintendente" ? <NuevaEstimacionDialog onCreated={load} /> : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : estimaciones === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : estimaciones.length === 0 ? (
            <EmptyState
              icon={Receipt}
              eyebrow="Control de estimaciones"
              title="No hay estimaciones en esta cartera"
              description="Las estimaciones aparecerán aquí cuando se registren para contratos asignados. El estado muestra su avance de revisión, firma y pago."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Importe bruto</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimaciones.map((estimacion) => (
                  <TableRow key={estimacion.id}>
                    <TableCell className="font-medium">{estimacion.numero}</TableCell>
                    <TableCell>{estimacion.mes_programa}</TableCell>
                    <TableCell>
                      {formatDate(estimacion.periodo_inicio)} — {formatDate(estimacion.periodo_fin)}
                    </TableCell>
                    <TableCell>{formatMoney(estimacion.importe_bruto)}</TableCell>
                    <TableCell>
                      <Badge variant={ESTIMACION_STATUS_VARIANTS[estimacion.status]}>
                        {ESTIMACION_STATUS_LABELS[estimacion.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/estimaciones/${estimacion.id}`} />}
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
