"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, Loader2, Ruler, Trash2, Upload } from "lucide-react";
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
import { ESTIMACION_STATUS_LABELS, ESTIMACION_STATUS_VARIANTS } from "@/lib/estimacion-status";
import { formatDate, formatMoney } from "@/lib/format";
import type {
  ConceptoCatalogo,
  Contract,
  Estimacion,
  EstimacionConcepto,
  EstimacionEvento,
  EvidenciaFotografica,
  EvidenciaMomento,
  GeneradorElemento,
} from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

function CantidadEjecutadaCell({
  fila,
  canEdit,
  onSaved,
}: {
  fila: EstimacionConcepto;
  canEdit: boolean;
  onSaved: (actualizada: EstimacionConcepto) => void;
}) {
  const [value, setValue] = useState(fila.cantidad_ejecutada);
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (value === fila.cantidad_ejecutada) return;
    setSaving(true);
    try {
      const actualizada = await apiFetch<EstimacionConcepto>(
        `/estimaciones/conceptos/${fila.id}/`,
        { method: "PATCH", body: JSON.stringify({ cantidad_ejecutada: value }) },
      );
      onSaved(actualizada);
    } catch (err) {
      setValue(fila.cantidad_ejecutada);
      toast.error(errorMessage(err, "No se pudo guardar la cantidad."));
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return <>{fila.cantidad_ejecutada}</>;

  return (
    <Input
      type="number"
      className="w-28"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

const EMPTY_FILA_GENERADOR = {
  elemento: "",
  cantidad_n: "1",
  largo: "",
  ancho: "",
  alto: "",
  observaciones: "",
};

function GeneradorDialog({
  estimacionConcepto,
  canEdit,
  onChange,
}: {
  estimacionConcepto: EstimacionConcepto;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filas, setFilas] = useState<GeneradorElemento[] | null>(null);
  const [nueva, setNueva] = useState(EMPTY_FILA_GENERADOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<GeneradorElemento[]>(
      `/estimaciones/generador/?estimacion_concepto=${estimacionConcepto.id}`,
    );
    setFilas(data);
  }

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleAgregar() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/estimaciones/generador/", {
        method: "POST",
        body: JSON.stringify({
          estimacion_concepto: estimacionConcepto.id,
          elemento: nueva.elemento,
          cantidad_n: nueva.cantidad_n || "1",
          largo: nueva.largo || null,
          ancho: nueva.ancho || null,
          alto: nueva.alto || null,
          observaciones: nueva.observaciones,
        }),
      });
      setNueva(EMPTY_FILA_GENERADOR);
      await load();
      onChange();
    } catch (err) {
      setError(errorMessage(err, "No se pudo agregar la fila."));
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: number) {
    try {
      await apiFetch(`/estimaciones/generador/${id}/`, { method: "DELETE" });
      await load();
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo eliminar la fila."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Ruler className="h-3 w-3" />
        Generador
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Número generador</DialogTitle>
        </DialogHeader>

        {filas === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {filas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Elemento</TableHead>
                    <TableHead>N</TableHead>
                    <TableHead>Largo</TableHead>
                    <TableHead>Ancho</TableHead>
                    <TableHead>Alto</TableHead>
                    <TableHead>Parcial</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((fila) => (
                    <TableRow key={fila.id}>
                      <TableCell>{fila.elemento}</TableCell>
                      <TableCell>{fila.cantidad_n}</TableCell>
                      <TableCell>{fila.largo ?? "—"}</TableCell>
                      <TableCell>{fila.ancho ?? "—"}</TableCell>
                      <TableCell>{fila.alto ?? "—"}</TableCell>
                      <TableCell className="font-medium">{fila.parcial}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEliminar(fila.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin filas de generador todavía — la cantidad ejecutada se captura directo.
              </p>
            )}

            {canEdit ? (
              <div className="grid grid-cols-6 gap-2 border-t pt-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Elemento</Label>
                  <Input
                    value={nueva.elemento}
                    onChange={(e) => setNueva((p) => ({ ...p, elemento: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">N</Label>
                  <Input
                    type="number"
                    value={nueva.cantidad_n}
                    onChange={(e) => setNueva((p) => ({ ...p, cantidad_n: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Largo</Label>
                  <Input
                    type="number"
                    value={nueva.largo}
                    onChange={(e) => setNueva((p) => ({ ...p, largo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ancho</Label>
                  <Input
                    type="number"
                    value={nueva.ancho}
                    onChange={(e) => setNueva((p) => ({ ...p, ancho: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Alto</Label>
                  <Input
                    type="number"
                    value={nueva.alto}
                    onChange={(e) => setNueva((p) => ({ ...p, alto: e.target.value }))}
                  />
                </div>
                <div className="col-span-6 flex items-center justify-between gap-2">
                  <Input
                    placeholder="Observaciones (ref. a plano/croquis)"
                    value={nueva.observaciones}
                    onChange={(e) => setNueva((p) => ({ ...p, observaciones: e.target.value }))}
                  />
                  <Button onClick={handleAgregar} disabled={saving || !nueva.elemento}>
                    {saving ? <Loader2 className="animate-spin" /> : null}
                    Agregar fila
                  </Button>
                </div>
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const MOMENTO_LABELS: Record<Exclude<EvidenciaMomento, "">, string> = {
  antes: "Antes",
  durante: "Durante",
  despues: "Después",
};

function EvidenciasDialog({
  estimacionConcepto,
  canEdit,
  onChange,
}: {
  estimacionConcepto: EstimacionConcepto;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [evidencias, setEvidencias] = useState<EvidenciaFotografica[] | null>(null);
  const [momento, setMomento] = useState<EvidenciaMomento>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await apiFetch<EvidenciaFotografica[]>(
      `/estimaciones/evidencias/?estimacion_concepto=${estimacionConcepto.id}`,
    );
    setEvidencias(data);
  }

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("estimacion_concepto", String(estimacionConcepto.id));
    formData.append("imagen", file);
    if (momento) formData.append("momento", momento);
    try {
      await apiFetch("/estimaciones/evidencias/", { method: "POST", body: formData });
      await load();
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo subir la evidencia."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleEliminar(id: number) {
    try {
      await apiFetch(`/estimaciones/evidencias/${id}/`, { method: "DELETE" });
      await load();
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo eliminar la evidencia."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Camera className="h-3 w-3" />
        Evidencias
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evidencia fotográfica</DialogTitle>
        </DialogHeader>

        {evidencias === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {evidencias.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {evidencias.map((ev) => (
                  <div key={ev.id} className="space-y-1">
                    <a href={ev.imagen} target="_blank" rel="noreferrer">
                      <img
                        src={ev.imagen}
                        alt={ev.momento || "evidencia"}
                        className="h-24 w-full rounded border object-cover"
                      />
                    </a>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{ev.momento ? MOMENTO_LABELS[ev.momento] : "—"}</span>
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEliminar(ev.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin evidencia fotográfica todavía para este concepto.
              </p>
            )}

            {canEdit ? (
              <div className="flex items-center gap-2 border-t pt-3">
                <Select
                  value={momento}
                  onValueChange={(value) => setMomento((value as EvidenciaMomento) ?? "")}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Momento" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MOMENTO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                  Subir foto
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const EVENTO_LABELS: Record<string, string> = {
  presentada: "Presentada",
  aprobada_residente: "Aprobada por Residente",
  rechazada_residente: "Rechazada por Residente",
  firmada: "Firmada",
  orden_pago_emitida: "Evento de pago anterior",
};

function PresentarButton({
  estimacion,
  onChange,
}: {
  estimacion: Estimacion;
  onChange: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePresentar() {
    setLoading(true);
    try {
      await apiFetch(`/estimaciones/${estimacion.id}/presentar/`, { method: "POST" });
      toast.success("Estimación presentada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo presentar la estimación."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePresentar} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : null}
      Presentar
    </Button>
  );
}

function AprobarRechazarButtons({
  estimacion,
  onChange,
}: {
  estimacion: Estimacion;
  onChange: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAprobar() {
    setLoading(true);
    try {
      await apiFetch(`/estimaciones/${estimacion.id}/aprobar_residente/`, { method: "POST" });
      toast.success("Estimación aprobada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo aprobar la estimación."));
    } finally {
      setLoading(false);
    }
  }

  async function handleRechazar() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/estimaciones/${estimacion.id}/rechazar_residente/`, {
        method: "POST",
        body: JSON.stringify({ motivo }),
      });
      toast.success("Estimación rechazada.");
      setOpen(false);
      setMotivo("");
      onChange();
    } catch (err) {
      setError(errorMessage(err, "No se pudo rechazar la estimación."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleAprobar} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        Aprobar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="destructive" disabled={loading} />}>
          Rechazar
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar estimación</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (obligatorio)</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={loading || !motivo.trim()}
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FirmarButton({
  estimacion,
  onChange,
}: {
  estimacion: Estimacion;
  onChange: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleFirmar() {
    setLoading(true);
    try {
      await apiFetch(`/estimaciones/${estimacion.id}/firmar/`, { method: "POST" });
      toast.success("Firma registrada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo firmar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleFirmar} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : null}
      Firmar
    </Button>
  );
}

function DeduccionesForm({
  estimacion,
  onChange,
}: {
  estimacion: Estimacion;
  onChange: () => void;
}) {
  const [penalizaciones, setPenalizaciones] = useState(estimacion.penalizaciones);
  const [motivoPenalizacion, setMotivoPenalizacion] = useState(estimacion.motivo_penalizacion);
  const [otrasDeducciones, setOtrasDeducciones] = useState(estimacion.otras_deducciones);
  const [motivoOtras, setMotivoOtras] = useState(estimacion.motivo_otras_deducciones);
  const [saving, setSaving] = useState(false);

  async function handleGuardar() {
    setSaving(true);
    try {
      await apiFetch(`/estimaciones/${estimacion.id}/deducciones/`, {
        method: "PATCH",
        body: JSON.stringify({
          penalizaciones,
          motivo_penalizacion: motivoPenalizacion,
          otras_deducciones: otrasDeducciones,
          motivo_otras_deducciones: motivoOtras,
        }),
      });
      toast.success("Deducciones actualizadas.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudieron guardar las deducciones."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-xs">Penalizaciones</Label>
        <Input
          type="number"
          value={penalizaciones}
          onChange={(e) => setPenalizaciones(e.target.value)}
        />
        <Textarea
          placeholder="Motivo"
          value={motivoPenalizacion}
          onChange={(e) => setMotivoPenalizacion(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Otras deducciones</Label>
        <Input
          type="number"
          value={otrasDeducciones}
          onChange={(e) => setOtrasDeducciones(e.target.value)}
        />
        <Textarea
          placeholder="Motivo"
          value={motivoOtras}
          onChange={(e) => setMotivoOtras(e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <Button size="sm" onClick={handleGuardar} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar deducciones
        </Button>
      </div>
    </div>
  );
}

function PagoPanel({
  estimacion,
  esFinanzas,
  onChange,
}: {
  estimacion: Estimacion;
  esFinanzas: boolean;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleTogglePago() {
    setSaving(true);
    try {
      await apiFetch(`/estimaciones/${estimacion.id}/pago/`, {
        method: "PATCH",
        body: JSON.stringify({ pagada: !estimacion.pagada }),
      });
      toast.success(estimacion.pagada ? "Pago marcado como pendiente." : "Pago registrado.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo actualizar el estado de pago."));
    } finally {
      setSaving(false);
    }
  }

  if (estimacion.status !== "firmada") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pago</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 text-sm">
        <Badge variant={estimacion.pagada ? "default" : "outline"}>
          {estimacion.pagada ? "Pagada" : "Pendiente"}
        </Badge>
        {esFinanzas ? (
          <Button variant="outline" size="sm" onClick={handleTogglePago} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {estimacion.pagada ? "Marcar pendiente" : "Marcar pagada"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function EstimacionDetallePage() {
  const params = useParams<{ id: string }>();
  const estimacionId = Number(params.id);
  const { me } = useAuth();

  const [estimacion, setEstimacion] = useState<Estimacion | null>(null);
  const [contrato, setContrato] = useState<Contract | null>(null);
  const [conceptosEstimacion, setConceptosEstimacion] = useState<EstimacionConcepto[] | null>(
    null,
  );
  const [catalogo, setCatalogo] = useState<Record<number, ConceptoCatalogo>>({});
  const [generadorPorConcepto, setGeneradorPorConcepto] = useState<Record<number, number>>({});
  const [eventos, setEventos] = useState<EstimacionEvento[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const est = await apiFetch<Estimacion>(`/estimaciones/${estimacionId}/`);
      setEstimacion(est);
      const [contratoData, filas, conceptosCatalogo, generador, historial] = await Promise.all([
        apiFetch<Contract>(`/contratos/${est.contrato}/`),
        apiFetch<EstimacionConcepto[]>(`/estimaciones/conceptos/?estimacion=${estimacionId}`),
        apiFetch<ConceptoCatalogo[]>(`/documentos/conceptos/?contrato=${est.contrato}`),
        apiFetch<GeneradorElemento[]>(`/estimaciones/generador/?estimacion=${estimacionId}`),
        apiFetch<EstimacionEvento[]>(`/estimaciones/${estimacionId}/eventos/`),
      ]);
      setContrato(contratoData);
      setConceptosEstimacion(filas);
      setCatalogo(Object.fromEntries(conceptosCatalogo.map((c) => [c.id, c])));
      const conteo: Record<number, number> = {};
      for (const fila of generador) {
        conteo[fila.estimacion_concepto] = (conteo[fila.estimacion_concepto] ?? 0) + 1;
      }
      setGeneradorPorConcepto(conteo);
      setEventos(historial);
    } catch {
      setError("No se pudo cargar la estimación.");
    }
  }, [estimacionId]);

  useEffect(() => {
    const timeout = setTimeout(() => reload(), 0);
    return () => clearTimeout(timeout);
  }, [reload]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!estimacion || !contrato || !conceptosEstimacion) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canEdit = me?.role === "superintendente" && estimacion.status === "borrador";
  const yaFirmo = estimacion.firmas.some((f) => f.firmante === me?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contrato.no_contrato} — Estimación {estimacion.numero}
            </h1>
            <Badge variant={ESTIMACION_STATUS_VARIANTS[estimacion.status]}>
              {ESTIMACION_STATUS_LABELS[estimacion.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Mes {estimacion.mes_programa} · {formatDate(estimacion.periodo_inicio)} —{" "}
            {formatDate(estimacion.periodo_fin)}
          </p>
        </div>
        <div>
          {me?.role === "superintendente" && estimacion.status === "borrador" ? (
            <PresentarButton estimacion={estimacion} onChange={reload} />
          ) : null}
          {me?.role === "residente" && estimacion.status === "en_revision_residente" ? (
            <AprobarRechazarButtons estimacion={estimacion} onChange={reload} />
          ) : null}
          {["residente", "superintendente", "supervision"].includes(me?.role ?? "") &&
          estimacion.status === "pendiente_firma" &&
          !yaFirmo ? (
            <FirmarButton estimacion={estimacion} onChange={reload} />
          ) : null}
        </div>
      </div>

      {estimacion.status === "borrador" && estimacion.motivo_rechazo ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-destructive">Rechazada por el Residente</p>
            <p className="text-muted-foreground">{estimacion.motivo_rechazo}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de importes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold">{formatMoney(estimacion.subtotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">IVA ({estimacion.iva_tasa}%)</p>
            <p className="text-lg font-semibold">{formatMoney(estimacion.iva)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Importe bruto</p>
            <p className="text-lg font-semibold">{formatMoney(estimacion.importe_bruto)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Amortización de anticipo</p>
            <p className="text-lg font-semibold">
              -{formatMoney(estimacion.amortizacion_anticipo)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">
              Fondo de garantía ({estimacion.porcentaje_fondo_garantia}%)
            </p>
            <p className="text-lg font-semibold">-{formatMoney(estimacion.fondo_garantia)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">
              Cinco al millar ({estimacion.porcentaje_cinco_al_millar}%)
            </p>
            <p className="text-lg font-semibold">
              -{formatMoney(estimacion.retencion_cinco_al_millar)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Penalizaciones / otras deducciones</p>
            <p className="text-lg font-semibold">
              -
              {formatMoney(
                Number(estimacion.penalizaciones) + Number(estimacion.otras_deducciones),
              )}
            </p>
          </div>
          <div className="col-span-3 border-t pt-3">
            <p className="text-muted-foreground">Importe neto a pagar</p>
            <p className="text-xl font-bold">{formatMoney(estimacion.importe_neto)}</p>
          </div>
        </CardContent>
        {me?.role === "residente" && estimacion.status === "en_revision_residente" ? (
          <CardContent className="border-t pt-4">
            <DeduccionesForm estimacion={estimacion} onChange={reload} />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuadro de cantidades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {conceptosEstimacion.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Esta estimación no tiene conceptos programados para el mes {estimacion.mes_programa}
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clave</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Acum. anterior</TableHead>
                  <TableHead>Ejecutada este periodo</TableHead>
                  <TableHead>Acumulada</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {conceptosEstimacion.map((fila) => {
                  const concepto = catalogo[fila.concepto];
                  const tieneGenerador = (generadorPorConcepto[fila.id] ?? 0) > 0;
                  return (
                    <TableRow key={fila.id}>
                      <TableCell className="font-medium">{concepto?.clave ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {concepto?.descripcion ?? "—"}
                      </TableCell>
                      <TableCell>{concepto?.unidad ?? "—"}</TableCell>
                      <TableCell>{fila.cantidad_acumulada_anterior}</TableCell>
                      <TableCell>
                        <CantidadEjecutadaCell
                          key={`${fila.id}:${fila.cantidad_ejecutada}`}
                          fila={fila}
                          canEdit={canEdit && !tieneGenerador}
                          onSaved={(actualizada) =>
                            setConceptosEstimacion((prev) =>
                              (prev ?? []).map((f) => (f.id === actualizada.id ? actualizada : f)),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>{fila.cantidad_acumulada}</TableCell>
                      <TableCell>{fila.cantidad_pendiente}</TableCell>
                      <TableCell>{formatMoney(fila.importe)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <GeneradorDialog
                            estimacionConcepto={fila}
                            canEdit={canEdit}
                            onChange={reload}
                          />
                          <EvidenciasDialog
                            estimacionConcepto={fila}
                            canEdit={canEdit}
                            onChange={reload}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Firmas</CardTitle>
        </CardHeader>
        <CardContent>
          {estimacion.firmas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía nadie ha firmado.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {estimacion.firmas.map((f) => (
                <li key={f.id} className="flex justify-between">
                  <span>
                    {f.firmante_nombre} ({f.rol})
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(f.fecha_firma.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PagoPanel
        estimacion={estimacion}
        esFinanzas={me?.role === "finanzas"}
        onChange={reload}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos todavía.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {eventos.map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-medium">{EVENTO_LABELS[ev.tipo] ?? ev.tipo}</span>
                    <span className="text-muted-foreground"> — {ev.actor_nombre}</span>
                    {ev.comentario ? (
                      <p className="text-muted-foreground">{ev.comentario}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(ev.fecha).toLocaleString("es-MX")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
