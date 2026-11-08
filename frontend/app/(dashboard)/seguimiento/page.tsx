"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shell/empty-state";
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
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/contract-status";
import type { Contract } from "@/lib/types";

export default function SeguimientoPage() {
  const [contratos, setContratos] = useState<Contract[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      apiFetch<Contract[]>("/contratos/")
        .then((data) => setContratos(data.filter((c) => c.status !== "registrado")))
        .catch(() => setError("No se pudieron cargar los contratos."));
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seguimiento</h1>
        <p className="text-muted-foreground">
          Curva S, avance financiero y notas de avance/incidencia por contrato.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : contratos === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : contratos.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              eyebrow="Avance de obra"
              title="Sin contratos en seguimiento"
              description="Los contratos activos aparecerán aquí con su avance programado y real, resumen financiero y curva S."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.no_contrato}</TableCell>
                    <TableCell className="max-w-md truncate">{contrato.objeto}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[contrato.status]}>
                        {STATUS_LABELS[contrato.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/seguimiento/${contrato.id}`} />}
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
