"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FolderCheck, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shell/empty-state";
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
import {
  CIERRE_STATUS_LABELS,
  CIERRE_STATUS_VARIANTS,
  CIERRE_TIPO_LABELS,
  SUSPENSION_CAUSAL_LABELS,
} from "@/lib/cierre-status";
import { formatDate, formatMoney } from "@/lib/format";
import type { Cierre, CierreTipo, Contract, Suspension, SuspensionCausal } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

function NuevoCierreDialog({
  tipo,
  triggerLabel,
  dialogTitle,
  motivoLabel,
  helpText,
  permiteSuspensionOrigen,
  requiereResolucionJudicial,
  contratoInicial,
  onCreated,
}: {
  tipo: CierreTipo;
  triggerLabel: string;
  dialogTitle: string;
  motivoLabel: string;
  helpText: string;
  permiteSuspensionOrigen?: boolean;
  requiereResolucionJudicial?: boolean;
  contratoInicial: string;
  onCreated: (id: number) => void;
}) {
  const [contratos, setContratos] = useState<Contract[] | null>(null);
  const [open, setOpen] = useState(false);
  const [contrato, setContrato] = useState(contratoInicial);
  const [motivo, setMotivo] = useState("");
  const [suspensiones, setSuspensiones] = useState<Suspension[] | null>(null);
  const [suspensionOrigen, setSuspensionOrigen] = useState("");
  const [fechaResolucionJudicial, setFechaResolucionJudicial] = useState("");
  const [montoResolucionJudicial, setMontoResolucionJudicial] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || contratos !== null) return;
    apiFetch<Contract[]>("/contratos/").then((data) =>
      setContratos(data.filter((c) => c.status === "activo")),
    );
  }, [open, contratos]);

  useEffect(() => {
    if (!permiteSuspensionOrigen || !contrato) {
      const timeout = setTimeout(() => {
        setSuspensiones(null);
        setSuspensionOrigen("");
      }, 0);
      return () => clearTimeout(timeout);
    }
    apiFetch<Suspension[]>(`/cierre/suspensiones/?contrato=${contrato}`).then((data) =>
      setSuspensiones(data.filter((s) => s.activa && s.es_indeterminada)),
    );
  }, [permiteSuspensionOrigen, contrato]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const creado = await apiFetch<Cierre>("/cierre/", {
        method: "POST",
        body: JSON.stringify({
          contrato: Number(contrato),
          tipo,
          motivo,
          suspension_origen: suspensionOrigen ? Number(suspensionOrigen) : null,
          ...(requiereResolucionJudicial
            ? {
                fecha_resolucion_judicial: fechaResolucionJudicial,
                monto_resolucion_judicial: montoResolucionJudicial,
              }
            : {}),
        }),
      });
      setOpen(false);
      setMotivo("");
      setSuspensionOrigen("");
      setFechaResolucionJudicial("");
      setMontoResolucionJudicial("");
      toast.success("Cierre registrado.");
      onCreated(creado.id);
    } catch (err) {
      setError(errorMessage(err, "No se pudo registrar el cierre."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full sm:w-auto" variant="outline" />}>
        <Plus />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Contrato</Label>
            {contratos === null ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={contrato} onValueChange={(v) => setContrato(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un contrato activo" />
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
            <Label className="text-xs">{motivoLabel}</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {requiereResolucionJudicial ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Fecha de la resolución judicial</Label>
                <Input
                  type="date"
                  value={fechaResolucionJudicial}
                  onChange={(e) => setFechaResolucionJudicial(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto de la resolución</Label>
                <Input
                  type="number"
                  value={montoResolucionJudicial}
                  onChange={(e) => setMontoResolucionJudicial(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          {permiteSuspensionOrigen && contrato && suspensiones && suspensiones.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Suspensión de origen (opcional)</Label>
              <Select value={suspensionOrigen} onValueChange={(v) => setSuspensionOrigen(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin suspensión de origen" />
                </SelectTrigger>
                <SelectContent>
                  {suspensiones.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {formatDate(s.fecha_inicio)} — {SUSPENSION_CAUSAL_LABELS[s.causal]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo aparecen las suspensiones activas marcadas como indeterminadas de este
                contrato (Art. 60).
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">{helpText}</p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={
              saving ||
              !contrato ||
              !motivo.trim() ||
              (requiereResolucionJudicial &&
                (!fechaResolucionJudicial || !montoResolucionJudicial))
            }
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaSuspensionDialog({
  contratoInicial,
  onCreated,
}: {
  contratoInicial: string;
  onCreated: () => void;
}) {
  const [contratos, setContratos] = useState<Contract[] | null>(null);
  const [open, setOpen] = useState(false);
  const [contrato, setContrato] = useState(contratoInicial);
  const [causal, setCausal] = useState<SuspensionCausal>("interes_general");
  const [motivo, setMotivo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [gastos, setGastos] = useState("");
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
      await apiFetch("/cierre/suspensiones/", {
        method: "POST",
        body: JSON.stringify({
          contrato: Number(contrato),
          causal,
          motivo,
          fecha_inicio: fechaInicio,
          monto_gastos_no_recuperables: gastos || "0",
        }),
      });
      setOpen(false);
      setMotivo("");
      setFechaInicio("");
      setGastos("");
      toast.success("Suspensión registrada.");
      onCreated();
    } catch (err) {
      setError(errorMessage(err, "No se pudo registrar la suspensión."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Nueva suspensión
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar suspensión temporal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Contrato</Label>
            {contratos === null ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={contrato} onValueChange={(v) => setContrato(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un contrato activo" />
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
            <Label className="text-xs">Causal (Art. 60 LOPSRM)</Label>
            <Select
              value={causal}
              onValueChange={(v) => setCausal((v as SuspensionCausal) ?? causal)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUSPENSION_CAUSAL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha de inicio</Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gastos no recuperables (si aplica)</Label>
            <Input type="number" value={gastos} onChange={(e) => setGastos(e.target.value)} />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={saving || !contrato || !motivo.trim() || !fechaInicio}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolverSuspensionDialog({
  suspension,
  onResolved,
}: {
  suspension: Suspension;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fechaFin, setFechaFin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolver() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/cierre/suspensiones/${suspension.id}/resolver/`, {
        method: "POST",
        body: JSON.stringify({ fecha_fin: fechaFin }),
      });
      setOpen(false);
      toast.success("Suspensión resuelta.");
      onResolved();
    } catch (err) {
      setError(errorMessage(err, "No se pudo resolver la suspensión."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Resolver</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver suspensión — reanudación de trabajos</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label className="text-xs">Fecha de reanudación</Label>
          <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleResolver} disabled={saving || !fechaFin}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Confirmar reanudación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CierrePageInner() {
  const { me } = useAuth();
  const searchParams = useSearchParams();
  const contratoFiltro = searchParams.get("contrato") ?? "";

  const [suspensiones, setSuspensiones] = useState<Suspension[] | null>(null);
  const [cierres, setCierres] = useState<Cierre[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const query = contratoFiltro ? `?contrato=${contratoFiltro}` : "";
    apiFetch<Suspension[]>(`/cierre/suspensiones/${query}`)
      .then(setSuspensiones)
      .catch(() => setError("No se pudieron cargar las suspensiones."));
    apiFetch<Cierre[]>(`/cierre/${query}`)
      .then(setCierres)
      .catch(() => setError("No se pudieron cargar los cierres."));
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoFiltro]);

  async function marcarIndeterminada(id: number) {
    try {
      await apiFetch(`/cierre/suspensiones/${id}/marcar_indeterminada/`, { method: "POST" });
      toast.success("Marcada como indeterminada.");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo marcar."));
    }
  }

  const puedeGestionar = me?.role === "residente" || me?.role === "dependencia";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cierre y rescisión</h1>
          <p className="text-muted-foreground">
            Suspensiones temporales, terminación y finiquito de contratos.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {me?.role === "superintendente" ? (
            <NuevoCierreDialog
              tipo="terminacion_cumplimiento"
              triggerLabel="Nueva terminación por cumplimiento"
              dialogTitle="Notificar terminación por cumplimiento"
              motivoLabel="Notificación de conclusión de los trabajos"
              helpText='Al notificar, el contrato pasa a "en cierre" de inmediato.'
              contratoInicial={contratoFiltro}
              onCreated={(id) => {
                load();
                toast.message(`Cierre #${id} creado — ábrelo en la tabla de abajo.`);
              }}
            />
          ) : null}
          {me?.role === "residente" ? (
            <NuevoCierreDialog
              tipo="rescision_administrativa"
              triggerLabel="Proponer rescisión administrativa"
              dialogTitle="Proponer rescisión administrativa"
              motivoLabel="Incumplimiento que motiva la propuesta"
              helpText="Se registra como propuesta — el contrato no se congela todavía. Dependencia debe notificar el inicio para que tenga efectos legales (RN-CIERRE-009)."
              contratoInicial={contratoFiltro}
              onCreated={(id) => {
                load();
                toast.message(`Propuesta #${id} creada — ábrela en la tabla de abajo.`);
              }}
            />
          ) : null}
          {me?.role === "dependencia" ? (
            <NuevoCierreDialog
              tipo="rescision_administrativa"
              triggerLabel="Iniciar rescisión administrativa"
              dialogTitle="Iniciar rescisión administrativa"
              motivoLabel="Incumplimiento que motiva la rescisión"
              helpText="Al iniciar, el contrato se congela de inmediato (RN-CIERRE-009): no se podrán crear nuevas estimaciones ni convenios."
              contratoInicial={contratoFiltro}
              onCreated={(id) => {
                load();
                toast.message(`Cierre #${id} creado — ábrelo en la tabla de abajo.`);
              }}
            />
          ) : null}
          {me?.role === "residente" || me?.role === "dependencia" || me?.role === "superintendente" ? (
            <NuevoCierreDialog
              tipo="terminacion_anticipada"
              triggerLabel="Solicitar terminación anticipada"
              dialogTitle="Solicitar terminación anticipada"
              motivoLabel="Causal (interés general, causa justificada o caso fortuito)"
              helpText="La solicitud ya tiene efecto formal: el contrato se congela de inmediato (RN-CIERRE-009). Dependencia tiene 15 días naturales para rechazarla; pasado ese plazo opera la afirmativa ficta."
              permiteSuspensionOrigen
              contratoInicial={contratoFiltro}
              onCreated={(id) => {
                load();
                toast.message(`Cierre #${id} creado — ábrelo en la tabla de abajo.`);
              }}
            />
          ) : null}
          {me?.role === "dependencia" ? (
            <NuevoCierreDialog
              tipo="rescision_judicial"
              triggerLabel="Registrar rescisión judicial"
              dialogTitle="Registrar rescisión judicial"
              motivoLabel="Resolución del Tribunal (referencia/expediente)"
              helpText="No se modela el litigio — se registra el resultado ya resuelto. El contrato se congela de inmediato."
              requiereResolucionJudicial
              contratoInicial={contratoFiltro}
              onCreated={(id) => {
                load();
                toast.message(`Cierre #${id} creado — ábrelo en la tabla de abajo.`);
              }}
            />
          ) : null}
          {puedeGestionar ? (
            <NuevaSuspensionDialog contratoInicial={contratoFiltro} onCreated={load} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cierres</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cierres === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : cierres.length === 0 ? (
            <EmptyState
              icon={FolderCheck}
              eyebrow="Cierre de contrato"
              title="No hay procesos de cierre"
              description="Las terminaciones, suspensiones y rescisión de contratos se organizarán aquí con su historial de eventos."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cierres.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.contrato_no}</TableCell>
                    <TableCell>{CIERRE_TIPO_LABELS[c.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant={CIERRE_STATUS_VARIANTS[c.status]}>
                        {CIERRE_STATUS_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(c.fecha_inicio).toLocaleDateString("es-MX")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/cierre/${c.id}`} />}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suspensiones temporales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : suspensiones === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : suspensiones.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No hay suspensiones registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Causal</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Días</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead>Gastos no recuperables</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspensiones.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.contrato_no}</TableCell>
                    <TableCell>{SUSPENSION_CAUSAL_LABELS[s.causal]}</TableCell>
                    <TableCell>{formatDate(s.fecha_inicio)}</TableCell>
                    <TableCell>{s.dias_suspendidos}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={s.activa ? "default" : "secondary"}>
                          {s.activa ? "Activa" : "Resuelta"}
                        </Badge>
                        {s.es_indeterminada ? (
                          <Badge variant="destructive">Indeterminada</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {Number(s.monto_gastos_no_recuperables) > 0
                        ? formatMoney(s.monto_gastos_no_recuperables)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.activa && puedeGestionar ? (
                        <div className="flex justify-end gap-2">
                          {!s.es_indeterminada ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => marcarIndeterminada(s.id)}
                            >
                              Marcar indeterminada
                            </Button>
                          ) : null}
                          <ResolverSuspensionDialog suspension={s} onResolved={load} />
                        </div>
                      ) : null}
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

export default function CierrePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CierrePageInner />
    </Suspense>
  );
}
