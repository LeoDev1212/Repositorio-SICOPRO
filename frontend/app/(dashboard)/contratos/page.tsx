"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shell/empty-state";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/contract-status";
import { formatMoney } from "@/lib/format";
import type { Contract } from "@/lib/types";

function ResponsablesCell({ contrato }: { contrato: Contract }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="cursor-default space-y-0.5 text-xs">
            <p className="truncate">
              <span className="text-muted-foreground">Res:</span>{" "}
              {contrato.residente_detalle.nombre}
            </p>
            <p className="truncate">
              <span className="text-muted-foreground">Sup:</span>{" "}
              {contrato.supervisor_detalle?.nombre ?? "—"}
            </p>
            <p className="truncate">
              <span className="text-muted-foreground">Sprt:</span>{" "}
              {contrato.superintendente_detalle?.nombre ?? "—"}
            </p>
          </div>
        }
      />
      <TooltipContent side="left" className="max-w-none">
        <div className="space-y-1 text-left">
          <p>
            <span className="text-background/60">Contratista:</span>{" "}
            {contrato.contratista_detalle.nombre}
          </p>
          <p>
            <span className="text-background/60">Empresa de supervisión:</span>{" "}
            {contrato.empresa_supervision_detalle?.nombre ?? "—"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ContratosPage() {
  const { me } = useAuth();
  const [contratos, setContratos] = useState<Contract[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<Contract[]>("/contratos/")
      .then((data) => {
        if (active) setContratos(data);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los contratos.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground">
            Contratos de obra pública registrados en la plataforma.
          </p>
        </div>
        {me?.role === "dependencia" ? (
          <Button className="w-full sm:w-auto" nativeButton={false} render={<Link href="/contratos/nuevo" />}>
            <Plus />
            Nuevo contrato
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : contratos === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : contratos.length === 0 ? (
            <EmptyState
              icon={FileText}
              eyebrow="Cartera contractual"
              title={me?.role === "dependencia" ? "La cartera está lista para iniciar" : "Sin contratos disponibles"}
              description={
                me?.role === "dependencia"
                  ? "Los contratos registrados aparecerán aquí con su monto, vigencia, responsables y estado documental."
                  : "Cuando te asignen a un contrato, podrás consultar aquí sus datos y seguimiento."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. de contrato</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Término</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead>Responsables</TableHead>
                  <TableHead className="text-right">Documentación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.no_contrato}</TableCell>
                    <TableCell className="max-w-xs truncate">{contrato.objeto}</TableCell>
                    <TableCell>{formatMoney(contrato.monto)}</TableCell>
                    <TableCell>{contrato.fecha_inicio}</TableCell>
                    <TableCell>{contrato.fecha_termino}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[contrato.status]}>
                        {STATUS_LABELS[contrato.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ResponsablesCell contrato={contrato} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/contratos/${contrato.id}`} />}
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
