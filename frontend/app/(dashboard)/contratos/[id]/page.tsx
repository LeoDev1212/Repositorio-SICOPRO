"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Check, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { TabAmortizacion } from "@/components/documentos/tab-amortizacion";
import { TabCatalogo } from "@/components/documentos/tab-catalogo";
import { TabConvenios } from "@/components/documentos/tab-convenios";
import { TabDocumentos } from "@/components/documentos/tab-documentos";
import { TabGarantias } from "@/components/documentos/tab-garantias";
import { TabPrograma } from "@/components/documentos/tab-programa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, ApiError } from "@/lib/api";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/contract-status";
import { formatMoney } from "@/lib/format";
import type { Contract, DocumentacionResumen } from "@/lib/types";

const CIERRE_BANNER: Record<string, string> = {
  en_cierre: "Este contrato está en proceso de cierre — hay un cierre o rescisión en curso.",
  cerrado: "Este contrato está cerrado.",
};

function ActivarContratoButton({
  contrato,
  resumen,
  onActivated,
}: {
  contrato: Contract;
  resumen: DocumentacionResumen | null;
  onActivated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activando, setActivando] = useState(false);

  const documentacionCompleta = resumen?.documentacion_completa ?? false;

  async function handleActivar() {
    setActivando(true);
    try {
      await apiFetch<Contract>(`/contratos/${contrato.id}/activar/`, { method: "POST" });
      toast.success("Contrato activado.");
      setOpen(false);
      onActivated();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.body && typeof err.body === "object"
          ? String((err.body as Record<string, unknown>).detail ?? "No se pudo activar el contrato.")
          : "No se pudo activar el contrato.",
      );
    } finally {
      setActivando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" disabled={!documentacionCompleta} />}
      >
        Activar contrato
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Activar {contrato.no_contrato}?</DialogTitle>
          <DialogDescription>
            El contrato pasará de &quot;Registrado&quot; a &quot;Activo&quot;. Esta acción no se
            puede deshacer desde aquí.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={activando}>
            Cancelar
          </Button>
          <Button onClick={handleActivar} disabled={activando}>
            {activando ? <Loader2 className="animate-spin" /> : null}
            Confirmar activación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ContratoDetallePage() {
  const params = useParams<{ id: string }>();
  const contratoId = Number(params.id);
  const { me } = useAuth();
  const canEdit = me?.role === "residente";

  const [contrato, setContrato] = useState<Contract | null>(null);
  const [resumen, setResumen] = useState<DocumentacionResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [contratoData, resumenData] = await Promise.all([
        apiFetch<Contract>(`/contratos/${contratoId}/`),
        apiFetch<DocumentacionResumen>(`/contratos/${contratoId}/documentacion/`),
      ]);
      setContrato(contratoData);
      setResumen(resumenData);
    } catch {
      setError("No se pudo cargar el contrato.");
    }
  }, [contratoId]);

  useEffect(() => {
    const timeout = setTimeout(() => reload(), 0);
    return () => clearTimeout(timeout);
  }, [reload]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!contrato) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{contrato.no_contrato}</h1>
            <Badge variant={STATUS_VARIANTS[contrato.status]}>
              {STATUS_LABELS[contrato.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">{contrato.objeto}</p>
          <p className="text-sm text-muted-foreground">{formatMoney(contrato.monto)}</p>
        </div>
        {me?.role === "dependencia" && contrato.status === "registrado" ? (
          <div className="flex flex-col items-end gap-1">
            <ActivarContratoButton contrato={contrato} resumen={resumen} onActivated={reload} />
            {resumen && !resumen.documentacion_completa ? (
              <p className="text-xs text-muted-foreground">
                Faltan documentos por cargar para poder activar.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {contrato.status === "en_cierre" || contrato.status === "cerrado" ? (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
              <span>{CIERRE_BANNER[contrato.status]}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/cierre?contrato=${contrato.id}`} />}
            >
              Ver en Cierre y rescisión
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {resumen ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(resumen.bloques).map(([key, bloque]) => (
            <Badge
              key={key}
              variant={bloque.completo ? "default" : "outline"}
              className="gap-1"
            >
              {bloque.completo ? <Check className="h-3 w-3" /> : null}
              {bloque.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="programa">Programa de obra</TabsTrigger>
          <TabsTrigger value="garantias">Garantías</TabsTrigger>
          <TabsTrigger value="amortizacion">Amortización</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="convenios">Convenios</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogo" className="pt-4">
          <TabCatalogo contrato={contrato} canEdit={canEdit} onChange={reload} />
        </TabsContent>
        <TabsContent value="programa" className="pt-4">
          <TabPrograma contrato={contrato} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="garantias" className="pt-4">
          <TabGarantias contrato={contrato} canEdit={canEdit} onChange={reload} />
        </TabsContent>
        <TabsContent value="amortizacion" className="pt-4">
          <TabAmortizacion contrato={contrato} canEdit={canEdit} onChange={reload} />
        </TabsContent>
        <TabsContent value="documentos" className="pt-4">
          <TabDocumentos contrato={contrato} canEdit={canEdit} onChange={reload} />
        </TabsContent>
        <TabsContent value="convenios" className="pt-4">
          <TabConvenios contrato={contrato} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
