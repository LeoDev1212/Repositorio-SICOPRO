"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import type {
  AssignablePersonaRole,
  Persona,
  PersonaCreatePayload,
  PersonaCreateResponse,
} from "@/lib/types";

interface PersonaDraft {
  nombre: string;
  rfc: string;
  telefono: string;
  correo: string;
  crearUsuario: boolean;
}

const EMPTY_DRAFT: PersonaDraft = {
  nombre: "",
  rfc: "",
  telefono: "",
  correo: "",
  crearUsuario: true,
};

interface Scope {
  param: "empresa_contratista" | "empresa_supervision";
  id: number;
}

export function PersonaPicker({
  label,
  role,
  scope,
  value,
  onChange,
}: {
  label: string;
  role: AssignablePersonaRole;
  scope?: Scope;
  value: Persona | null;
  onChange: (persona: Persona | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Persona[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<PersonaDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (value || !query.trim()) {
      return;
    }
    const params = new URLSearchParams({ role, search: query });
    if (scope) params.set(scope.param, String(scope.id));
    const timeout = setTimeout(() => {
      setSearching(true);
      apiFetch<Persona[]>(`/actores/personas/?${params.toString()}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, value, role, scope]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const payload: PersonaCreatePayload = {
        nombre: draft.nombre,
        rfc: draft.rfc,
        telefono: draft.telefono,
        correo: draft.correo,
        crear_usuario: draft.crearUsuario,
        role,
      };
      if (scope) payload[scope.param] = scope.id;
      const created = await apiFetch<PersonaCreateResponse>("/actores/personas/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onChange(created);
      if (created.temp_password) {
        setTempPassword(created.temp_password);
      }
      setCreating(false);
      setDraft(EMPTY_DRAFT);
      setQuery("");
    } catch {
      setError("No se pudo registrar. Revisa los datos e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword).catch(() => {});
    setCopied(true);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <div>
            <p className="text-sm font-medium">{value.nombre}</p>
            <p className="text-xs text-muted-foreground">{value.rfc} · {value.correo}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)}>
            <X />
          </Button>
        </div>
      ) : !creating ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nombre, RFC o correo..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {searching ? (
            <p className="text-xs text-muted-foreground">Buscando...</p>
          ) : results.length > 0 ? (
            <div className="divide-y rounded-md border">
              {results.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => onChange(result)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{result.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {result.rfc} · {result.correo}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() && !searching ? (
            <p className="text-xs text-muted-foreground">Sin resultados.</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
            Registrar nuevo
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={draft.nombre}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RFC</Label>
                <Input
                  value={draft.rfc}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, rfc: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={draft.telefono}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, telefono: event.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Correo</Label>
                <Input
                  type="email"
                  value={draft.correo}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, correo: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`crear-usuario-${role}`}
                checked={draft.crearUsuario}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, crearUsuario: checked === true }))
                }
              />
              <Label htmlFor={`crear-usuario-${role}`} className="text-sm font-normal">
                Crear acceso a la plataforma
              </Label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={
                  saving ||
                  !draft.nombre ||
                  !draft.rfc ||
                  (draft.crearUsuario && !draft.correo)
                }
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!tempPassword}
        onOpenChange={(open) => {
          if (!open) {
            setTempPassword(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña temporal generada</DialogTitle>
            <DialogDescription>
              Esta contraseña no se volverá a mostrar. Cópiala y compártela con{" "}
              {value?.nombre ?? "el usuario"} por un canal seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
            <span className="flex-1 truncate">{tempPassword}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={copyPassword}>
              {copied ? <Check className="text-green-600" /> : <Copy />}
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setTempPassword(null);
                setCopied(false);
              }}
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
