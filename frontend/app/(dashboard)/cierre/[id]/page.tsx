"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api";
import {
  CIERRE_STATUS_LABELS,
  CIERRE_STATUS_VARIANTS,
  CIERRE_TIPO_LABELS,
} from "@/lib/cierre-status";
import { ESTIMACION_STATUS_LABELS } from "@/lib/estimacion-status";
import { formatDate, formatMoney } from "@/lib/format";
import type { Cierre, CierreEvento, Contract, Estimacion } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

const EVENTO_LABELS: Record<string, string> = {
  propuesto: "Propuesta registrada",
  notificado_inicio: "Inicio notificado",
  iniciado: "Iniciado",
  acta_entrega_recepcion: "Acta de entrega-recepción",
  liquidacion_vinculada: "Estimación de liquidación vinculada",
  alegatos_recibidos: "Alegatos recibidos",
  resolucion_rescision: "Resolución de rescisión",
  resolucion_terminacion: "Resolución de terminación anticipada",
  resolucion_judicial_registrada: "Resolución judicial registrada",
  acta_circunstanciada: "Acta circunstanciada",
  descartado: "Descartado",
  finiquitado: "Finiquitado",
};

function ActaEntregaCard({ cierre, canEdit, onChange }: { cierre: Cierre; canEdit: boolean; onChange: () => void }) {
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!fecha || !file) {
      toast.error("Se requiere fecha y documento.");
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append("fecha_acta_entrega_recepcion", fecha);
    formData.append("documento", file);
    try {
      await apiFetch(`/cierre/${cierre.id}/acta_entrega/`, { method: "POST", body: formData });
      toast.success("Acta de entrega-recepción registrada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo registrar el acta."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acta de entrega-recepción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {cierre.fecha_acta_entrega_recepcion ? (
          <>
            <p>Fecha: {new Date(`${cierre.fecha_acta_entrega_recepcion}T00:00:00`).toLocaleDateString("es-MX")}</p>
            {cierre.documento_acta_entrega ? (
              <a
                href={cierre.documento_acta_entrega}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Ver documento
              </a>
            ) : null}
          </>
        ) : canEdit ? (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Documento</Label>
              <input ref={fileInputRef} type="file" className="block text-sm" />
            </div>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Registrar
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">Todavía no se registra.</p>
        )}
      </CardContent>
    </Card>
  );
}

function LiquidacionCard({
  cierre,
  contrato,
  canEdit,
  onChange,
}: {
  cierre: Cierre;
  contrato: Contract;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [estimaciones, setEstimaciones] = useState<Estimacion[] | null>(null);
  const [seleccion, setSeleccion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Estimacion[]>(`/estimaciones/?contrato=${contrato.id}`).then(setEstimaciones);
  }, [contrato.id]);

  const liquidacion = estimaciones?.find((e) => e.id === cierre.estimacion_liquidacion) ?? null;

  async function handleVincular() {
    setSaving(true);
    try {
      await apiFetch(`/cierre/${cierre.id}/vincular_liquidacion/`, {
        method: "POST",
        body: JSON.stringify({ estimacion: Number(seleccion) }),
      });
      toast.success("Estimación de liquidación vinculada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo vincular la estimación."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estimación de liquidación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {estimaciones === null ? (
          <Skeleton className="h-9 w-full" />
        ) : liquidacion ? (
          <p>
            Estimación {liquidacion.numero} —{" "}
            <Badge variant="outline">{ESTIMACION_STATUS_LABELS[liquidacion.status]}</Badge>
          </p>
        ) : (
          <p className="text-muted-foreground">Todavía no se vincula ninguna.</p>
        )}
        {canEdit ? (
          <div className="flex items-end gap-2 border-t pt-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Estimación</Label>
              <Select value={seleccion} onValueChange={(v) => setSeleccion(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {(estimaciones ?? []).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      Estimación {e.numero} — {ESTIMACION_STATUS_LABELS[e.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleVincular} disabled={saving || !seleccion}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Vincular
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FiniquitoCard({
  cierre,
  contrato,
  canFiniquitar,
  onChange,
}: {
  cierre: Cierre;
  contrato: Contract;
  canFiniquitar: boolean;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const liquidacionLista =
    cierre.estimacion_liquidacion !== null; // el backend valida el status exacto (RN-CIERRE-008)
  const requisitos = [
    { ok: !!cierre.fecha_acta_entrega_recepcion, label: "Acta de entrega-recepción registrada" },
    { ok: liquidacionLista, label: "Estimación de liquidación vinculada (debe estar firmada o pagada)" },
  ];
  const listoParaIntentar = requisitos.every((r) => r.ok);

  async function handleFiniquitar() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Se requiere el documento de finiquito.");
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append("documento", file);
    try {
      await apiFetch(`/cierre/${cierre.id}/finiquitar/`, { method: "POST", body: formData });
      toast.success("Cierre finiquitado — el contrato queda cerrado.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo finiquitar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Finiquito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {cierre.status === "finiquitado" ? (
          <>
            <p>
              Finiquitado el{" "}
              {cierre.fecha_finiquito ? new Date(cierre.fecha_finiquito).toLocaleString("es-MX") : "—"}
            </p>
            {cierre.documento_finiquito ? (
              <a
                href={cierre.documento_finiquito}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Ver documento
              </a>
            ) : null}
          </>
        ) : (
          <>
            <ul className="space-y-1">
              {requisitos.map((r) => (
                <li key={r.label} className={r.ok ? "text-foreground" : "text-muted-foreground"}>
                  {r.ok ? "✓" : "○"} {r.label}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Fondo de garantía acumulado: {formatMoney(contrato.fondo_garantia_acumulado)} — se
              libera 12 meses después del acta de entrega-recepción (fuera del flujo de este
              sistema, es un recordatorio).
            </p>
            {canFiniquitar ? (
              <div className="flex items-end gap-2 border-t pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Acta de extinción de derechos y obligaciones</Label>
                  <input ref={fileInputRef} type="file" className="block text-sm" />
                </div>
                <Button onClick={handleFiniquitar} disabled={saving || !listoParaIntentar}>
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  Finiquitar
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PropuestaCard({
  cierre,
  canGestionar,
  onChange,
}: {
  cierre: Cierre;
  canGestionar: boolean;
  onChange: () => void;
}) {
  const [descartando, setDescartando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState<"notificar" | "descartar" | null>(null);

  async function notificar() {
    setSaving("notificar");
    try {
      await apiFetch(`/cierre/${cierre.id}/notificar_inicio/`, { method: "POST" });
      toast.success("Inicio notificado — el contrato queda congelado (RN-CIERRE-009).");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo notificar el inicio."));
    } finally {
      setSaving(null);
    }
  }

  async function descartar() {
    setSaving("descartar");
    try {
      await apiFetch(`/cierre/${cierre.id}/descartar/`, {
        method: "POST",
        body: JSON.stringify({ comentario }),
      });
      toast.success("Propuesta descartada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo descartar la propuesta."));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Propuesta de rescisión</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Registrada por el Residente. El contrato no se congela hasta que Dependencia notifique
          el inicio (RN-CIERRE-009).
        </p>
        {canGestionar ? (
          descartando ? (
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">Motivo para descartar (opcional)</Label>
              <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={descartar} disabled={saving !== null}>
                  {saving === "descartar" ? <Loader2 className="animate-spin" /> : null}
                  Confirmar descarte
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDescartando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 border-t pt-3">
              <Button onClick={notificar} disabled={saving !== null}>
                {saving === "notificar" ? <Loader2 className="animate-spin" /> : null}
                Notificar inicio
              </Button>
              <Button variant="outline" onClick={() => setDescartando(true)} disabled={saving !== null}>
                Descartar
              </Button>
            </div>
          )
        ) : (
          <p className="text-muted-foreground">Esperando notificación de Dependencia.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AlegatosCard({
  cierre,
  canCapturar,
  onChange,
}: {
  cierre: Cierre;
  canCapturar: boolean;
  onChange: () => void;
}) {
  const [alegatos, setAlegatos] = useState("");
  const [saving, setSaving] = useState(false);

  async function enviar() {
    setSaving(true);
    try {
      await apiFetch(`/cierre/${cierre.id}/alegatos/`, {
        method: "POST",
        body: JSON.stringify({ alegatos }),
      });
      toast.success("Alegatos capturados.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudieron capturar los alegatos."));
    } finally {
      setSaving(false);
    }
  }

  const plazoVencido =
    !!cierre.fecha_limite_alegatos && new Date(cierre.fecha_limite_alegatos) < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alegatos del contratista</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Plazo de 15 días hábiles desde la notificación
          {cierre.fecha_limite_alegatos ? ` — vence el ${formatDate(cierre.fecha_limite_alegatos)}` : ""}
          {plazoVencido && !cierre.fecha_alegatos ? " (vencido)" : ""}.
        </p>
        {cierre.fecha_alegatos ? (
          <>
            <p className="whitespace-pre-wrap">{cierre.alegatos_contratista}</p>
            <p className="text-xs text-muted-foreground">
              Capturados el {new Date(cierre.fecha_alegatos).toLocaleString("es-MX")}
            </p>
          </>
        ) : canCapturar && !cierre.fecha_resolucion ? (
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs">Alegatos presentados por el contratista</Label>
            <Textarea value={alegatos} onChange={(e) => setAlegatos(e.target.value)} />
            <Button onClick={enviar} disabled={saving || !alegatos.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Capturar alegatos
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">Todavía no se capturan.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ResolucionCard({
  cierre,
  canResolver,
  onChange,
}: {
  cierre: Cierre;
  canResolver: boolean;
  onChange: () => void;
}) {
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState<"true" | "false" | null>(null);

  const plazoVencido =
    !!cierre.fecha_limite_alegatos && new Date(cierre.fecha_limite_alegatos) < new Date();
  const puedeResolver = canResolver && (!!cierre.fecha_alegatos || plazoVencido);

  async function resolver(seRescinde: boolean) {
    setSaving(seRescinde ? "true" : "false");
    try {
      await apiFetch(`/cierre/${cierre.id}/resolver_rescision/`, {
        method: "POST",
        body: JSON.stringify({ se_rescinde: seRescinde, comentario }),
      });
      toast.success(
        seRescinde ? "Rescisión resuelta afirmativamente." : "Rescisión descartada — el contrato se reactiva.",
      );
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo resolver."));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolución</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {cierre.fecha_resolucion ? (
          <>
            <Badge variant={cierre.se_rescinde ? "destructive" : "secondary"}>
              {cierre.se_rescinde ? "Se rescinde el contrato" : "No procede la rescisión"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Resuelto el {new Date(cierre.fecha_resolucion).toLocaleString("es-MX")}
            </p>
          </>
        ) : puedeResolver ? (
          <div className="space-y-2">
            <Label className="text-xs">Comentario (opcional)</Label>
            <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => resolver(true)} disabled={saving !== null}>
                {saving === "true" ? <Loader2 className="animate-spin" /> : null}
                Rescindir
              </Button>
              <Button variant="outline" onClick={() => resolver(false)} disabled={saving !== null}>
                {saving === "false" ? <Loader2 className="animate-spin" /> : null}
                No rescindir
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Esperando los alegatos del contratista o el vencimiento de su plazo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActaCircunstanciadaCard({
  cierre,
  canEdit,
  onChange,
}: {
  cierre: Cierre;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Se requiere el documento.");
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append("documento", file);
    try {
      await apiFetch(`/cierre/${cierre.id}/acta_circunstanciada/`, {
        method: "POST",
        body: formData,
      });
      toast.success("Acta circunstanciada registrada.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo registrar el acta."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acta circunstanciada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {cierre.documento_acta_circunstanciada ? (
          <a
            href={cierre.documento_acta_circunstanciada}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Ver documento
          </a>
        ) : canEdit ? (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Documento</Label>
              <input ref={fileInputRef} type="file" className="block text-sm" />
            </div>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Registrar
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Se registra una vez que la rescisión se resuelve afirmativamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResolucionAnticipadaCard({
  cierre,
  canResolver,
  onChange,
}: {
  cierre: Cierre;
  canResolver: boolean;
  onChange: () => void;
}) {
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState<"aceptar" | "rechazar" | null>(null);

  async function accionar(accion: "aceptar" | "rechazar") {
    setSaving(accion);
    try {
      await apiFetch(`/cierre/${cierre.id}/${accion}/`, {
        method: "POST",
        body: JSON.stringify({ comentario }),
      });
      toast.success(
        accion === "aceptar"
          ? "Terminación anticipada aceptada."
          : "Terminación anticipada rechazada — el contrato se reactiva.",
      );
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo resolver."));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolución</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {cierre.fecha_resolucion ? (
          <>
            <Badge variant={cierre.se_rescinde ? "default" : "destructive"}>
              {cierre.se_rescinde ? "Aceptada" : "Rechazada"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Resuelto el {new Date(cierre.fecha_resolucion).toLocaleString("es-MX")}
            </p>
          </>
        ) : (
          <>
            {cierre.aceptada_tacitamente ? (
              <p className="text-amber-600 dark:text-amber-500">
                Vencieron los 15 días naturales sin resolución expresa — opera la afirmativa
                ficta. Ya no se puede rechazar; se puede finiquitar directamente.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Dependencia tiene 15 días naturales desde la notificación para rechazarla. Pasado
                ese plazo, opera la afirmativa ficta.
              </p>
            )}
            {canResolver ? (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">Comentario (opcional)</Label>
                <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => accionar("aceptar")} disabled={saving !== null}>
                    {saving === "aceptar" ? <Loader2 className="animate-spin" /> : null}
                    Aceptar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => accionar("rechazar")}
                    disabled={saving !== null || cierre.aceptada_tacitamente}
                  >
                    {saving === "rechazar" ? <Loader2 className="animate-spin" /> : null}
                    Rechazar
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResolucionJudicialCard({ cierre }: { cierre: Cierre }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolución judicial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          No se modela el litigio — este es el resultado ya resuelto por el Tribunal, registrado
          por Dependencia al crear el cierre.
        </p>
        <p>
          Fecha de la resolución:{" "}
          {cierre.fecha_resolucion_judicial
            ? formatDate(cierre.fecha_resolucion_judicial)
            : "—"}
        </p>
        <p>
          Monto de la resolución:{" "}
          {cierre.monto_resolucion_judicial ? formatMoney(cierre.monto_resolucion_judicial) : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

function FiniquitoBalanceCard({
  cierre,
  canFiniquitar,
  onChange,
}: {
  cierre: Cierre;
  canFiniquitar: boolean;
  onChange: () => void;
}) {
  const [montoTrabajos, setMontoTrabajos] = useState("");
  const [montoPenas, setMontoPenas] = useState("");
  const [montoGastos, setMontoGastos] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requisitos =
    cierre.tipo === "rescision_administrativa"
      ? [
          { ok: cierre.se_rescinde === true, label: "Rescisión resuelta afirmativamente" },
          { ok: !!cierre.documento_acta_circunstanciada, label: "Acta circunstanciada registrada" },
        ]
      : cierre.tipo === "rescision_judicial"
        ? [{ ok: !!cierre.documento_acta_circunstanciada, label: "Acta circunstanciada registrada" }]
        : [];
  const listoParaIntentar = requisitos.every((r) => r.ok);

  async function handleFiniquitar() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Se requiere el documento de finiquito.");
      return;
    }
    if (!montoTrabajos.trim()) {
      toast.error("Se requiere el monto de trabajos ejecutados.");
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append("documento", file);
    formData.append("monto_trabajos_ejecutados", montoTrabajos);
    if (montoPenas) formData.append("monto_penas_convencionales", montoPenas);
    if (montoGastos) formData.append("monto_gastos_no_recuperables", montoGastos);
    try {
      await apiFetch(`/cierre/${cierre.id}/finiquitar/`, { method: "POST", body: formData });
      toast.success("Cierre finiquitado — el contrato queda cerrado.");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo finiquitar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Balance y finiquito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {cierre.status === "finiquitado" ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p>Trabajos ejecutados: {formatMoney(cierre.monto_trabajos_ejecutados)}</p>
              <p>Gastos no recuperables: {formatMoney(cierre.monto_gastos_no_recuperables)}</p>
              <p>Penas convencionales: {formatMoney(cierre.monto_penas_convencionales)}</p>
              <p>Anticipo no amortizado: {formatMoney(cierre.anticipo_no_amortizado)}</p>
            </div>
            <p className="font-medium">
              Importe neto del finiquito: {formatMoney(cierre.importe_neto_finiquito)}
            </p>
            <p>
              Finiquitado el{" "}
              {cierre.fecha_finiquito ? new Date(cierre.fecha_finiquito).toLocaleString("es-MX") : "—"}
            </p>
            {cierre.documento_finiquito ? (
              <a
                href={cierre.documento_finiquito}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Ver documento
              </a>
            ) : null}
          </>
        ) : (
          <>
            {requisitos.length > 0 ? (
              <ul className="space-y-1">
                {requisitos.map((r) => (
                  <li key={r.label} className={r.ok ? "text-foreground" : "text-muted-foreground"}>
                    {r.ok ? "✓" : "○"} {r.label}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-muted-foreground">
              Anticipo no amortizado: {formatMoney(cierre.anticipo_no_amortizado)} — se descuenta del
              finiquito.
            </p>
            {canFiniquitar && listoParaIntentar ? (
              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Trabajos ejecutados</Label>
                    <Input
                      type="number"
                      value={montoTrabajos}
                      onChange={(e) => setMontoTrabajos(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Penas convencionales</Label>
                    <Input
                      type="number"
                      value={montoPenas}
                      onChange={(e) => setMontoPenas(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gastos no recuperables</Label>
                    <Input
                      type="number"
                      value={montoGastos}
                      onChange={(e) => setMontoGastos(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Documento de finiquito</Label>
                  <input ref={fileInputRef} type="file" className="block text-sm" />
                </div>
                <Button onClick={handleFiniquitar} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  Finiquitar
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CierreDetallePage() {
  const params = useParams<{ id: string }>();
  const cierreId = Number(params.id);
  const { me } = useAuth();

  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [contrato, setContrato] = useState<Contract | null>(null);
  const [eventos, setEventos] = useState<CierreEvento[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const c = await apiFetch<Cierre>(`/cierre/${cierreId}/`);
      setCierre(c);
      const [contratoData, historial] = await Promise.all([
        apiFetch<Contract>(`/contratos/${c.contrato}/`),
        apiFetch<CierreEvento[]>(`/cierre/${cierreId}/eventos/`),
      ]);
      setContrato(contratoData);
      setEventos(historial);
    } catch {
      setError("No se pudo cargar el cierre.");
    }
  }, [cierreId]);

  useEffect(() => {
    const timeout = setTimeout(() => reload(), 0);
    return () => clearTimeout(timeout);
  }, [reload]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!cierre || !contrato) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const enProceso = cierre.status === "en_proceso";
  const esRescisionAdministrativa = cierre.tipo === "rescision_administrativa";
  const esTerminacionAnticipada = cierre.tipo === "terminacion_anticipada";
  const esRescisionJudicial = cierre.tipo === "rescision_judicial";
  const fueNotificado = cierre.fecha_notificacion_inicio !== null;

  const canEditActa = enProceso && (me?.role === "residente" || me?.role === "dependencia");
  const canVincular = enProceso && me?.role === "superintendente";
  const canFiniquitar = enProceso && me?.role === "dependencia";

  const canGestionarPropuesta = me?.role === "dependencia";
  const canCapturarAlegatos = enProceso && me?.role === "superintendente";
  const canResolver = enProceso && me?.role === "dependencia";
  const canActaCircunstanciada = enProceso && (me?.role === "residente" || me?.role === "dependencia");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {contrato.no_contrato} — {CIERRE_TIPO_LABELS[cierre.tipo]}
        </h1>
        <Badge variant={CIERRE_STATUS_VARIANTS[cierre.status]}>
          {CIERRE_STATUS_LABELS[cierre.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Motivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm">{cierre.motivo}</p>
          {cierre.suspension_origen ? (
            <p className="text-xs text-muted-foreground">
              Nace de la suspensión indeterminada #{cierre.suspension_origen} (Art. 60).
            </p>
          ) : null}
        </CardContent>
      </Card>

      {cierre.tipo === "terminacion_cumplimiento" ? (
        <>
          <ActaEntregaCard cierre={cierre} canEdit={canEditActa} onChange={reload} />
          <LiquidacionCard cierre={cierre} contrato={contrato} canEdit={canVincular} onChange={reload} />
          <FiniquitoCard
            cierre={cierre}
            contrato={contrato}
            canFiniquitar={canFiniquitar}
            onChange={reload}
          />
        </>
      ) : null}

      {esRescisionAdministrativa && cierre.status === "propuesta" ? (
        <PropuestaCard cierre={cierre} canGestionar={canGestionarPropuesta} onChange={reload} />
      ) : null}

      {esRescisionAdministrativa && fueNotificado ? (
        <>
          <AlegatosCard cierre={cierre} canCapturar={canCapturarAlegatos} onChange={reload} />
          <ResolucionCard cierre={cierre} canResolver={canResolver} onChange={reload} />
          {cierre.se_rescinde === true ? (
            <ActaCircunstanciadaCard
              cierre={cierre}
              canEdit={canActaCircunstanciada}
              onChange={reload}
            />
          ) : null}
          {cierre.se_rescinde === true ? (
            <FiniquitoBalanceCard cierre={cierre} canFiniquitar={canFiniquitar} onChange={reload} />
          ) : null}
        </>
      ) : null}

      {esTerminacionAnticipada && fueNotificado ? (
        <>
          <ResolucionAnticipadaCard cierre={cierre} canResolver={canResolver} onChange={reload} />
          {cierre.status !== "descartado" ? (
            <FiniquitoBalanceCard cierre={cierre} canFiniquitar={canFiniquitar} onChange={reload} />
          ) : null}
        </>
      ) : null}

      {esRescisionJudicial ? (
        <>
          <ResolucionJudicialCard cierre={cierre} />
          <ActaCircunstanciadaCard
            cierre={cierre}
            canEdit={canActaCircunstanciada}
            onChange={reload}
          />
          <FiniquitoBalanceCard cierre={cierre} canFiniquitar={canFiniquitar} onChange={reload} />
        </>
      ) : null}

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
                    {ev.comentario ? <p className="text-muted-foreground">{ev.comentario}</p> : null}
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
