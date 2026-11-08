"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { apiFetch, ApiError } from "@/lib/api";
import { BITACORA_ESTADO_LABELS, BITACORA_ESTADO_VARIANTS } from "@/lib/bitacora-status";
import { formatDate } from "@/lib/format";
import type { Bitacora, Contract } from "@/lib/types";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.body && typeof err.body === "object"
    ? String(Object.values(err.body as Record<string, unknown>)[0])
    : fallback;
}

function AbrirBitacoraDialog({
  contratosSinBitacora,
  onCreated,
}: {
  contratosSinBitacora: Contract[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [contrato, setContrato] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAbrir() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/bitacora/", {
        method: "POST",
        body: JSON.stringify({ contrato: Number(contrato) }),
      });
      setOpen(false);
      setContrato("");
      onCreated();
      toast.success("Bitácora abierta.");
    } catch (err) {
      setError(errorMessage(err, "No se pudo abrir la bitácora."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
        <Plus />
        Abrir bitácora
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir bitácora</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Contrato</Label>
            {contratosSinBitacora.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes contratos activos sin bitácora.
              </p>
            ) : (
              <Select value={contrato} onValueChange={(value) => setContrato(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratosSinBitacora.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.no_contrato} — {c.objeto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            La fecha de apertura queda fijada a hoy y se genera automáticamente la nota de
            apertura.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleAbrir} disabled={saving || !contrato}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BitacoraPage() {
  const { me } = useAuth();
  const [bitacoras, setBitacoras] = useState<Bitacora[] | null>(null);
  const [contratosSinBitacora, setContratosSinBitacora] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<Bitacora[]>("/bitacora/");
      setBitacoras(data);
      if (me?.role === "residente") {
        const contratos = await apiFetch<Contract[]>("/contratos/");
        const conBitacora = new Set(data.map((b) => b.contrato));
        setContratosSinBitacora(
          contratos.filter((c) => c.status === "activo" && !conBitacora.has(c.id)),
        );
      }
    } catch {
      setError("No se pudieron cargar las bitácoras.");
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bitácora</h1>
          <p className="text-muted-foreground">
            Apertura, notas con folio, firmas y consultas de la bitácora.
          </p>
        </div>
        {me?.role === "residente" ? (
          <AbrirBitacoraDialog contratosSinBitacora={contratosSinBitacora} onCreated={load} />
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : bitacoras === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : bitacoras.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              eyebrow="Registro de obra"
              title={me?.role === "residente" ? "Todavía no hay bitácoras abiertas" : "Sin bitácoras asignadas"}
              description={
                me?.role === "residente"
                  ? "Al abrir una bitácora para un contrato activo, sus notas y eventos de obra quedarán organizados en este registro."
                  : "Las bitácoras de los contratos asignados aparecerán aquí cuando el Residente las abra."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Fecha de apertura</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bitacoras.map((bitacora) => (
                  <TableRow key={bitacora.id}>
                    <TableCell className="font-medium">{bitacora.contrato_no}</TableCell>
                    <TableCell>{formatDate(bitacora.fecha_apertura)}</TableCell>
                    <TableCell>
                      <Badge variant={BITACORA_ESTADO_VARIANTS[bitacora.estado]}>
                        {BITACORA_ESTADO_LABELS[bitacora.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/bitacora/${bitacora.id}`} />}
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
