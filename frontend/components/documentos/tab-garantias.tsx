"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Contract, Garantia, GarantiaTipo } from "@/lib/types";

const TIPO_LABELS: Record<GarantiaTipo, string> = {
  cumplimiento: "Cumplimiento",
  anticipo: "Anticipo",
  vicios_ocultos: "Vicios ocultos",
};

const ESTADO_VARIANTS = {
  vigente: "default",
  por_vencer: "outline",
  vencida: "destructive",
} as const;

const ESTADO_LABELS = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencida: "Vencida",
};

const EMPTY_DRAFT = {
  tipo: "cumplimiento" as GarantiaTipo,
  numero_fianza: "",
  institucion_afianzadora: "",
  monto: "",
  porcentaje_cobertura: "",
  fecha_emision: "",
  fecha_vigencia: "",
};

export function TabGarantias({
  contrato,
  canEdit,
  onChange,
}: {
  contrato: Contract;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [garantias, setGarantias] = useState<Garantia[] | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<Garantia[]>(`/documentos/garantias/?contrato=${contrato.id}`);
    setGarantias(data);
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/documentos/garantias/", {
        method: "POST",
        body: JSON.stringify({ contrato: contrato.id, ...draft }),
      });
      setOpen(false);
      setDraft(EMPTY_DRAFT);
      await load();
      onChange();
      toast.success("Garantía registrada.");
    } catch (err) {
      setError(
        err instanceof ApiError && err.body && typeof err.body === "object"
          ? String(Object.values(err.body as Record<string, unknown>)[0])
          : "No se pudo guardar la garantía.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            Agregar garantía
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva garantía / fianza</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={draft.tipo}
                  onValueChange={(value) =>
                    setDraft((p) => ({ ...p, tipo: value as GarantiaTipo }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">No. de fianza</Label>
                <Input
                  value={draft.numero_fianza}
                  onChange={(e) => setDraft((p) => ({ ...p, numero_fianza: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Institución afianzadora</Label>
                <Input
                  value={draft.institucion_afianzadora}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, institucion_afianzadora: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  value={draft.monto}
                  onChange={(e) => setDraft((p) => ({ ...p, monto: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">% Cobertura</Label>
                <Input
                  type="number"
                  value={draft.porcentaje_cobertura}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, porcentaje_cobertura: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de emisión</Label>
                <Input
                  type="date"
                  value={draft.fecha_emision}
                  onChange={(e) => setDraft((p) => ({ ...p, fecha_emision: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de vigencia</Label>
                <Input
                  type="date"
                  value={draft.fecha_vigencia}
                  onChange={(e) => setDraft((p) => ({ ...p, fecha_vigencia: e.target.value }))}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !draft.numero_fianza}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {garantias === null ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
          ) : garantias.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Aún no hay garantías registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>No. fianza</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {garantias.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{TIPO_LABELS[g.tipo]}</TableCell>
                    <TableCell>{g.numero_fianza}</TableCell>
                    <TableCell>{g.institucion_afianzadora}</TableCell>
                    <TableCell>{formatMoney(g.monto)}</TableCell>
                    <TableCell>{g.fecha_vigencia}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANTS[g.estado]}>
                        {ESTADO_LABELS[g.estado]}
                      </Badge>
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
