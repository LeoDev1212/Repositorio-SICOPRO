"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ContractDraft {
  no_contrato: string;
  monto: string;
  objeto: string;
  descripcion: string;
  plazo_dias: string;
  fecha_inicio: string;
  ubicacion: string;
  es_retroactivo: boolean;
}

export const EMPTY_CONTRACT_DRAFT: ContractDraft = {
  no_contrato: "",
  monto: "",
  objeto: "",
  descripcion: "",
  plazo_dias: "",
  fecha_inicio: "",
  ubicacion: "",
  es_retroactivo: false,
};

function computeFechaTermino(fechaInicio: string, plazoDias: string): string | null {
  const dias = Number(plazoDias);
  if (!fechaInicio || !dias || dias <= 0) return null;
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  const termino = new Date(inicio);
  termino.setDate(termino.getDate() + dias);
  return termino.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function isStep1Valid(draft: ContractDraft): boolean {
  if (
    !draft.no_contrato ||
    !draft.monto ||
    !draft.objeto ||
    !draft.plazo_dias ||
    !draft.fecha_inicio ||
    !draft.ubicacion
  ) {
    return false;
  }
  if (!draft.es_retroactivo) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inicio = new Date(`${draft.fecha_inicio}T00:00:00`);
    if (inicio < today) return false;
  }
  return true;
}

export function PasoDatosContrato({
  value,
  onChange,
}: {
  value: ContractDraft;
  onChange: (next: ContractDraft) => void;
}) {
  function set<K extends keyof ContractDraft>(key: K, val: ContractDraft[K]) {
    onChange({ ...value, [key]: val });
  }

  const fechaTermino = computeFechaTermino(value.fecha_inicio, value.plazo_dias);
  const today = new Date().toISOString().slice(0, 10);
  const fechaInicioInvalida =
    !value.es_retroactivo && !!value.fecha_inicio && value.fecha_inicio < today;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="no_contrato">No. de contrato</Label>
        <Input
          id="no_contrato"
          value={value.no_contrato}
          onChange={(event) => set("no_contrato", event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="monto">Monto (MXN)</Label>
        <Input
          id="monto"
          type="number"
          min="0"
          step="0.01"
          value={value.monto}
          onChange={(event) => set("monto", event.target.value)}
        />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="objeto">Objeto del contrato</Label>
        <Input
          id="objeto"
          value={value.objeto}
          onChange={(event) => set("objeto", event.target.value)}
        />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input
          id="descripcion"
          value={value.descripcion}
          onChange={(event) => set("descripcion", event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plazo_dias">Plazo (días)</Label>
        <Input
          id="plazo_dias"
          type="number"
          min="1"
          value={value.plazo_dias}
          onChange={(event) => set("plazo_dias", event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ubicacion">Ubicación</Label>
        <Input
          id="ubicacion"
          value={value.ubicacion}
          onChange={(event) => set("ubicacion", event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fecha_inicio">Fecha de inicio</Label>
        <Input
          id="fecha_inicio"
          type="date"
          value={value.fecha_inicio}
          onChange={(event) => set("fecha_inicio", event.target.value)}
        />
        {fechaInicioInvalida ? (
          <p className="text-xs text-destructive">
            No puede ser anterior a hoy salvo que el contrato sea retroactivo.
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>Fecha de término (calculada)</Label>
        <div className="flex h-8 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
          {fechaTermino ?? "—"}
        </div>
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <Checkbox
          id="es_retroactivo"
          checked={value.es_retroactivo}
          onCheckedChange={(checked) => set("es_retroactivo", checked === true)}
        />
        <Label htmlFor="es_retroactivo" className="text-sm font-normal">
          Contrato retroactivo (la obra ya inició antes de formalizarse)
        </Label>
      </div>
    </div>
  );
}
