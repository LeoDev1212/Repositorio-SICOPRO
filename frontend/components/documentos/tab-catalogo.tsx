"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { BulkUploadResult, ConceptoCatalogo, Contract } from "@/lib/types";

const EMPTY_DRAFT = {
  clave: "",
  descripcion: "",
  unidad: "",
  cantidad: "",
  precio_unitario: "",
  no_sujeto_ajuste_costos: false,
};

export function TabCatalogo({
  contrato,
  canEdit,
  onChange,
}: {
  contrato: Contract;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [conceptos, setConceptos] = useState<ConceptoCatalogo[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await apiFetch<ConceptoCatalogo[]>(
        `/documentos/conceptos/?contrato=${contrato.id}`,
      );
      setConceptos(data);
    } catch {
      setConceptos([]);
    }
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
      await apiFetch("/documentos/conceptos/", {
        method: "POST",
        body: JSON.stringify({
          contrato: contrato.id,
          clave: draft.clave,
          descripcion: draft.descripcion,
          unidad: draft.unidad,
          cantidad: draft.cantidad,
          precio_unitario: draft.precio_unitario,
          no_sujeto_ajuste_costos: draft.no_sujeto_ajuste_costos,
        }),
      });
      setDialogOpen(false);
      setDraft(EMPTY_DRAFT);
      await load();
      onChange();
      toast.success("Concepto agregado.");
    } catch (err) {
      setError(
        err instanceof ApiError ? "No se pudo guardar. Revisa los datos." : "Error inesperado.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("contrato", String(contrato.id));
    formData.append("archivo", file);
    try {
      const result = await apiFetch<BulkUploadResult>("/documentos/conceptos/bulk_upload/", {
        method: "POST",
        body: formData,
      });
      await load();
      onChange();
      if (result.coincide_monto) {
        toast.success(
          `${result.creados} conceptos cargados. La suma coincide con el monto del contrato.`,
        );
      } else {
        toast.warning(
          `${result.creados} conceptos cargados, pero la suma (${formatMoney(result.suma_importes)}) no coincide con el monto del contrato (${formatMoney(result.monto_contrato)}).`,
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.body && typeof err.body === "object"
          ? JSON.stringify((err.body as Record<string, unknown>).errores ?? err.body)
          : "No se pudo procesar el archivo.";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const sumaImportes = (conceptos ?? []).reduce((acc, c) => acc + Number(c.importe), 0);
  const coincide = Math.abs(sumaImportes - Number(contrato.monto)) <= Number(contrato.monto) * 0.005;

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              Agregar concepto
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo concepto</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Clave</Label>
                  <Input
                    value={draft.clave}
                    onChange={(e) => setDraft((p) => ({ ...p, clave: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unidad</Label>
                  <Input
                    value={draft.unidad}
                    onChange={(e) => setDraft((p) => ({ ...p, unidad: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    value={draft.descripcion}
                    onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    value={draft.cantidad}
                    onChange={(e) => setDraft((p) => ({ ...p, cantidad: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio unitario</Label>
                  <Input
                    type="number"
                    value={draft.precio_unitario}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, precio_unitario: e.target.value }))
                    }
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Checkbox
                    id="no-ajuste"
                    checked={draft.no_sujeto_ajuste_costos}
                    onCheckedChange={(checked) =>
                      setDraft((p) => ({ ...p, no_sujeto_ajuste_costos: checked === true }))
                    }
                  />
                  <Label htmlFor="no-ajuste" className="text-sm font-normal">
                    No sujeto a ajuste de costos
                  </Label>
                </div>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={saving || !draft.clave || !draft.descripcion}
                >
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            Cargar CSV/XLSX
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {conceptos === null ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
          ) : conceptos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Aún no hay conceptos cargados en el catálogo.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clave</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Vigente</TableHead>
                    <TableHead>P.U.</TableHead>
                    <TableHead>Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conceptos.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.clave}</TableCell>
                      <TableCell className="max-w-xs truncate">{c.descripcion}</TableCell>
                      <TableCell>{c.unidad}</TableCell>
                      <TableCell>{c.cantidad}</TableCell>
                      <TableCell>
                        {c.cantidad_vigente !== c.cantidad ? (
                          <span className="font-medium text-primary">{c.cantidad_vigente}</span>
                        ) : (
                          c.cantidad_vigente
                        )}
                      </TableCell>
                      <TableCell>{formatMoney(c.precio_unitario)}</TableCell>
                      <TableCell>{formatMoney(c.importe)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t p-4 text-sm">
                <span className="text-muted-foreground">
                  Suma de importes: <strong>{formatMoney(sumaImportes)}</strong> · Monto del
                  contrato: <strong>{formatMoney(contrato.monto)}</strong>
                </span>
                <Badge variant={coincide ? "default" : "outline"}>
                  {coincide ? "Coincide" : "No coincide"}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
