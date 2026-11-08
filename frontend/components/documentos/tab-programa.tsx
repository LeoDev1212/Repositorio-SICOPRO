"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api";
import type { ConceptoCatalogo, Contract, ProgramaConceptoMes } from "@/lib/types";

type Matriz = Record<number, Record<number, string>>;

export function TabPrograma({ contrato, canEdit }: { contrato: Contract; canEdit: boolean }) {
  const [conceptos, setConceptos] = useState<ConceptoCatalogo[] | null>(null);
  const [matriz, setMatriz] = useState<Matriz>({});
  const [saving, setSaving] = useState(false);

  const mesesTotales = Math.max(1, Math.ceil(contrato.plazo_dias / 30));
  const meses = Array.from({ length: mesesTotales }, (_, i) => i + 1);

  useEffect(() => {
    async function load() {
      const [conceptosData, programaData] = await Promise.all([
        apiFetch<ConceptoCatalogo[]>(`/documentos/conceptos/?contrato=${contrato.id}`),
        apiFetch<ProgramaConceptoMes[]>(`/documentos/programa/?contrato=${contrato.id}`),
      ]);
      setConceptos(conceptosData);
      const next: Matriz = {};
      for (const fila of programaData) {
        next[fila.concepto] ??= {};
        next[fila.concepto][fila.mes] = fila.cantidad_programada;
      }
      setMatriz(next);
    }
    load();
  }, [contrato.id]);

  function setCelda(conceptoId: number, mes: number, valor: string) {
    setMatriz((prev) => ({
      ...prev,
      [conceptoId]: { ...prev[conceptoId], [mes]: valor },
    }));
  }

  async function handleGuardar() {
    setSaving(true);
    const filas = Object.entries(matriz).flatMap(([conceptoId, porMes]) =>
      Object.entries(porMes)
        .filter(([, cantidad]) => cantidad !== "" && cantidad !== undefined)
        .map(([mes, cantidad]) => ({
          concepto: Number(conceptoId),
          mes: Number(mes),
          cantidad_programada: cantidad,
        })),
    );
    try {
      await apiFetch("/documentos/programa/upsert_matriz/", {
        method: "POST",
        body: JSON.stringify({ filas }),
      });
      toast.success("Programa de obra guardado.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? "No se pudo guardar el programa." : "Error inesperado.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (conceptos === null) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (conceptos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Carga primero el catálogo de conceptos para poder programar cantidades por mes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <Button size="sm" onClick={handleGuardar} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar programa
        </Button>
      ) : null}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Concepto</TableHead>
                {meses.map((mes) => (
                  <TableHead key={mes} className="text-center">
                    Mes {mes}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((concepto) => (
                <TableRow key={concepto.id}>
                  <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">
                    {concepto.clave}
                  </TableCell>
                  {meses.map((mes) => (
                    <TableCell key={mes} className="p-1">
                      <Input
                        type="number"
                        className="h-8 w-24 text-center"
                        disabled={!canEdit}
                        value={matriz[concepto.id]?.[mes] ?? ""}
                        onChange={(e) => setCelda(concepto.id, mes, e.target.value)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
