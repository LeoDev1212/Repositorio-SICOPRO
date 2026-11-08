"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CurvaSChart } from "@/components/seguimiento/curva-s-chart";
import { apiFetch } from "@/lib/api";
import { NOTA_CLASIFICACION_LABELS } from "@/lib/bitacora-status";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/contract-status";
import { formatMoney } from "@/lib/format";
import type { Bitacora, Contract, NotaBitacora, SeguimientoResumen } from "@/lib/types";

const CLASIFICACIONES_SEGUIMIENTO = new Set(["avance", "incidencia"]);

function Estadistica({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}

export default function SeguimientoDetallePage() {
  const params = useParams<{ id: string }>();
  const contratoId = params.id;

  const [contrato, setContrato] = useState<Contract | null>(null);
  const [seguimiento, setSeguimiento] = useState<SeguimientoResumen | null>(null);
  const [notas, setNotas] = useState<NotaBitacora[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      Promise.all([
        apiFetch<Contract>(`/contratos/${contratoId}/`),
        apiFetch<SeguimientoResumen>(`/contratos/${contratoId}/seguimiento/`),
      ])
        .then(([contratoData, seguimientoData]) => {
          setContrato(contratoData);
          setSeguimiento(seguimientoData);
        })
        .catch(() => setError("No se pudo cargar el seguimiento de este contrato."));

      apiFetch<Bitacora[]>("/bitacora/")
        .then((bitacoras) => {
          const bitacora = bitacoras.find((b) => String(b.contrato) === String(contratoId));
          if (!bitacora) {
            setNotas([]);
            return;
          }
          return apiFetch<NotaBitacora[]>(`/bitacora/notas/?bitacora=${bitacora.id}`).then(
            (data) =>
              setNotas(
                data
                  .filter((n) => CLASIFICACIONES_SEGUIMIENTO.has(n.clasificacion))
                  .sort((a, b) => b.fecha.localeCompare(a.fecha)),
              ),
          );
        })
        .catch(() => setNotas([]));
    }, 0);
    return () => clearTimeout(timeout);
  }, [contratoId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/seguimiento" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contrato ? contrato.no_contrato : <Skeleton className="h-7 w-40" />}
          </h1>
          {contrato ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{contrato.objeto}</span>
              <Badge variant={STATUS_VARIANTS[contrato.status]}>
                {STATUS_LABELS[contrato.status]}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!seguimiento && !error ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {seguimiento ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Avance financiero</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Estadistica
                label="Monto vigente"
                valor={formatMoney(seguimiento.resumen.monto_vigente)}
              />
              <Estadistica
                label="Monto ejecutado"
                valor={formatMoney(seguimiento.resumen.monto_ejecutado)}
              />
              <Estadistica
                label="Saldo por ejercer"
                valor={formatMoney(seguimiento.resumen.saldo_por_ejercer)}
              />
              <Estadistica
                label="Avance financiero"
                valor={`${seguimiento.resumen.avance_financiero_porcentaje}%`}
              />
              <Estadistica
                label="Anticipo pendiente"
                valor={formatMoney(seguimiento.resumen.anticipo_pendiente)}
              />
              <Estadistica
                label="Anticipo amortizado"
                valor={formatMoney(seguimiento.resumen.anticipo_amortizado)}
              />
              <Estadistica
                label="Fondo de garantía acumulado"
                valor={formatMoney(seguimiento.resumen.fondo_garantia_acumulado)}
              />
              <Estadistica label="Mes de obra actual" valor={String(seguimiento.mes_actual)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Curva S — programado vs. real</CardTitle>
            </CardHeader>
            <CardContent>
              <CurvaSChart puntos={seguimiento.curva_s} mesActual={seguimiento.mes_actual} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avances e incidencias</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notas === null ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : notas.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Sin notas de avance o incidencia registradas en la bitácora todavía.
                </p>
              ) : (
                <ul className="divide-y">
                  {notas.map((nota) => (
                    <li key={nota.id} className="flex items-start gap-3 p-4 text-sm">
                      <Badge variant={nota.clasificacion === "incidencia" ? "destructive" : "default"}>
                        {NOTA_CLASIFICACION_LABELS[nota.clasificacion]}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{nota.autor_nombre}</span>
                          <span>·</span>
                          <span>{new Date(nota.fecha).toLocaleString("es-MX")}</span>
                        </div>
                        <p className="mt-1">{nota.descripcion}</p>
                        {nota.clasificacion === "incidencia" && nota.causa ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Causa: {nota.causa}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
