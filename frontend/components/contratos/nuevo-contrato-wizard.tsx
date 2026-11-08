"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMPTY_ASSIGNMENT,
  PasoAsignacion,
  isStep2Valid,
  type AssignmentState,
} from "@/components/contratos/paso-asignacion";
import {
  EMPTY_CONTRACT_DRAFT,
  PasoDatosContrato,
  isStep1Valid,
  type ContractDraft,
} from "@/components/contratos/paso-datos-contrato";
import { apiFetch, ApiError } from "@/lib/api";
import type { Contract } from "@/lib/types";

const STEPS = [
  { id: 1, title: "Datos del contrato" },
  { id: 2, title: "Asignación" },
] as const;

export function NuevoContratoWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<ContractDraft>(EMPTY_CONTRACT_DRAFT);
  const [assignment, setAssignment] = useState<AssignmentState>(EMPTY_ASSIGNMENT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!isStep2Valid(assignment)) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<Contract>("/contratos/", {
        method: "POST",
        body: JSON.stringify({
          no_contrato: draft.no_contrato,
          monto: draft.monto,
          objeto: draft.objeto,
          descripcion: draft.descripcion,
          plazo_dias: Number(draft.plazo_dias),
          fecha_inicio: draft.fecha_inicio,
          ubicacion: draft.ubicacion,
          es_retroactivo: draft.es_retroactivo,
          contratista: assignment.contratista!.id,
          empresa_supervision: assignment.empresaSupervision!.id,
          residente: assignment.residente!.id,
          supervisor: assignment.supervisor!.id,
          superintendente: assignment.superintendente!.id,
        }),
      });
      toast.success("Contrato registrado correctamente.");
      router.push("/contratos");
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        const firstMessage = Object.values(err.body as Record<string, unknown>)[0];
        setError(
          Array.isArray(firstMessage) ? String(firstMessage[0]) : "No se pudo registrar el contrato.",
        );
      } else {
        setError("No se pudo registrar el contrato.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle className="text-xl">Registrar contrato</CardTitle>
        <div className="mt-2 flex items-center gap-3">
          {STEPS.map((s, index) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    step === s.id
                      ? "bg-primary text-primary-foreground"
                      : step > s.id
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
                </div>
                <span
                  className={`text-sm ${step === s.id ? "font-medium" : "text-muted-foreground"}`}
                >
                  {s.title}
                </span>
              </div>
              {index < STEPS.length - 1 ? <div className="h-px w-8 bg-border" /> : null}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 ? (
          <PasoDatosContrato value={draft} onChange={setDraft} />
        ) : (
          <PasoAsignacion value={assignment} onChange={setAssignment} />
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-between border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 1 ? router.push("/contratos") : setStep(1))}
            disabled={submitting}
          >
            {step === 1 ? "Cancelar" : "Atrás"}
          </Button>
          {step === 1 ? (
            <Button type="button" disabled={!isStep1Valid(draft)} onClick={() => setStep(2)}>
              Siguiente
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!isStep2Valid(assignment) || submitting}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Registrar contrato
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
