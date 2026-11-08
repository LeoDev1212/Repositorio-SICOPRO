"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Anticipo, Contract } from "@/lib/types";

export function TabAmortizacion({
  contrato,
  canEdit,
  onChange,
}: {
  contrato: Contract;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [anticipo, setAnticipo] = useState<Anticipo | null | undefined>(undefined);
  const [montoOtorgado, setMontoOtorgado] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<Anticipo[]>(`/documentos/anticipo/?contrato=${contrato.id}`);
    const existing = data[0] ?? null;
    setAnticipo(existing);
    if (existing) {
      setMontoOtorgado(existing.monto_otorgado);
      setPorcentaje(existing.porcentaje_retencion_por_estimacion);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (anticipo) {
        await apiFetch(`/documentos/anticipo/${anticipo.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            monto_otorgado: montoOtorgado,
            porcentaje_retencion_por_estimacion: porcentaje,
          }),
        });
      } else {
        await apiFetch("/documentos/anticipo/", {
          method: "POST",
          body: JSON.stringify({
            contrato: contrato.id,
            monto_otorgado: montoOtorgado,
            porcentaje_retencion_por_estimacion: porcentaje,
          }),
        });
      }
      await load();
      onChange();
      toast.success("Configuración de amortización guardada.");
    } catch (err) {
      setError(
        err instanceof ApiError ? "No se pudo guardar. Revisa los datos." : "Error inesperado.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (anticipo === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <Card className="max-w-md">
      <CardContent className="space-y-4 pt-6">
        {anticipo ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <span className="text-muted-foreground">Monto amortizado</span>
            <span className="text-right font-medium">{formatMoney(anticipo.monto_amortizado)}</span>
            <span className="text-muted-foreground">Saldo pendiente</span>
            <span className="text-right font-medium">{formatMoney(anticipo.saldo_pendiente)}</span>
          </div>
        ) : null}

        {canEdit ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Monto del anticipo otorgado</Label>
              <Input
                type="number"
                value={montoOtorgado}
                onChange={(e) => setMontoOtorgado(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% de retención por estimación</Label>
              <Input type="number" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !montoOtorgado || !porcentaje}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {anticipo ? "Actualizar" : "Configurar amortización"}
            </Button>
          </div>
        ) : !anticipo ? (
          <p className="text-sm text-muted-foreground">Aún no se configura el anticipo.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
