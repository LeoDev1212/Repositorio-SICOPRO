"use client";

import { Separator } from "@/components/ui/separator";
import { EntityPicker } from "@/components/contratos/entity-picker";
import { PersonaPicker } from "@/components/contratos/persona-picker";
import type { Contratista, EmpresaSupervision, Persona } from "@/lib/types";

export interface AssignmentState {
  contratista: Contratista | null;
  superintendente: Persona | null;
  empresaSupervision: EmpresaSupervision | null;
  supervisor: Persona | null;
  residente: Persona | null;
}

export const EMPTY_ASSIGNMENT: AssignmentState = {
  contratista: null,
  superintendente: null,
  empresaSupervision: null,
  supervisor: null,
  residente: null,
};

export function isStep2Valid(assignment: AssignmentState): boolean {
  return !!(
    assignment.contratista &&
    assignment.superintendente &&
    assignment.empresaSupervision &&
    assignment.supervisor &&
    assignment.residente
  );
}

export function PasoAsignacion({
  value,
  onChange,
}: {
  value: AssignmentState;
  onChange: (next: AssignmentState) => void;
}) {
  function set<K extends keyof AssignmentState>(key: K, val: AssignmentState[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Contratista
        </h3>
        <EntityPicker
          label="Empresa contratista"
          endpoint="/actores/contratistas/"
          value={value.contratista}
          onChange={(entity) =>
            onChange({ ...value, contratista: entity, superintendente: null })
          }
        />
        {value.contratista ? (
          <PersonaPicker
            label="Superintendente"
            role="superintendente"
            scope={{ param: "empresa_contratista", id: value.contratista.id }}
            value={value.superintendente}
            onChange={(persona) => set("superintendente", persona)}
          />
        ) : null}
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Supervisión
        </h3>
        <EntityPicker
          label="Empresa de supervisión"
          endpoint="/actores/empresas-supervision/"
          value={value.empresaSupervision}
          onChange={(entity) =>
            onChange({ ...value, empresaSupervision: entity, supervisor: null })
          }
        />
        {value.empresaSupervision ? (
          <PersonaPicker
            label="Supervisor a cargo"
            role="supervision"
            scope={{ param: "empresa_supervision", id: value.empresaSupervision.id }}
            value={value.supervisor}
            onChange={(persona) => set("supervisor", persona)}
          />
        ) : null}
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Residente de obra
        </h3>
        <PersonaPicker
          label="Residente"
          role="residente"
          value={value.residente}
          onChange={(persona) => set("residente", persona)}
        />
      </section>
    </div>
  );
}
