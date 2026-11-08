"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import {
  CONVENIO_STATUS_LABELS,
  CONVENIO_STATUS_VARIANTS,
  CONVENIO_TIPO_LABELS,
} from "@/lib/convenio-status";
import { formatMoney } from "@/lib/format";
import type { Contract, ConvenioModificatorio } from "@/lib/types";

// Solo lectura a propósito: la captura/aprobación/rechazo de convenios vive
// en /convenios (lista) y /convenios/[id] (detalle) — mismo patrón que
// Estimaciones y Bitácora (módulo propio, no una pestaña dentro del
// contrato). Aquí solo se resume el efecto vigente y se enlaza al detalle.
export function TabConvenios({ contrato }: { contrato: Contract }) {
  const [convenios, setConvenios] = useState<ConvenioModificatorio[] | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      apiFetch<ConvenioModificatorio[]>(`/documentos/convenios/?contrato=${contrato.id}`)
        .then(setConvenios)
        .catch(() => setConvenios([]));
    }, 0);
    return () => clearTimeout(timeout);
  }, [contrato.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-muted-foreground">Monto vigente</p>
            <p className="font-medium">
              {formatMoney(contrato.monto_vigente)}
              {Number(contrato.monto_vigente) !== Number(contrato.monto) ? (
                <span className="text-muted-foreground">
                  {" "}
                  (original {formatMoney(contrato.monto)})
                </span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Plazo vigente</p>
            <p className="font-medium">
              {contrato.plazo_vigente_dias} días
              {contrato.plazo_vigente_dias !== contrato.plazo_dias ? (
                <span className="text-muted-foreground"> (original {contrato.plazo_dias})</span>
              ) : null}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/convenios?contrato=${contrato.id}`} />}
        >
          Ver en Convenios
          <ArrowUpRight className="h-3 w-3" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {convenios === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : convenios.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Este contrato no tiene convenios modificatorios.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenios.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{CONVENIO_TIPO_LABELS[c.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant={CONVENIO_STATUS_VARIANTS[c.status]}>
                        {CONVENIO_STATUS_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/convenios/${c.id}`} />}
                      >
                        Detalle
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
