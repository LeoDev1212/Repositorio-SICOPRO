"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface BaseEntity {
  id: number;
  nombre: string;
  rfc: string;
  // Solo lo trae Contratista (RN-CIERRE-010) — EmpresaSupervision no lo tiene,
  // queda undefined y simplemente no se muestra el aviso.
  inhabilitado_vigente?: boolean;
  fecha_fin_inhabilitacion?: string | null;
}

interface EntityDraft {
  nombre: string;
  rfc: string;
  representante: string;
  telefono: string;
  correo: string;
}

const EMPTY_DRAFT: EntityDraft = {
  nombre: "",
  rfc: "",
  representante: "",
  telefono: "",
  correo: "",
};

export function EntityPicker<T extends BaseEntity>({
  label,
  endpoint,
  value,
  onChange,
}: {
  label: string;
  endpoint: string;
  value: T | null;
  onChange: (entity: T | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<EntityDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value || !query.trim()) {
      return;
    }
    const timeout = setTimeout(() => {
      setSearching(true);
      apiFetch<T[]>(`${endpoint}?search=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, value, endpoint]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<T>(endpoint, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      onChange(created);
      setCreating(false);
      setDraft(EMPTY_DRAFT);
      setQuery("");
    } catch {
      setError("No se pudo registrar. Revisa los datos e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (value) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <div>
            <p className="text-sm font-medium">{value.nombre}</p>
            <p className="text-xs text-muted-foreground">{value.rfc}</p>
          </div>
          <div className="flex items-center gap-2">
            {value.inhabilitado_vigente ? (
              <Badge variant="destructive">
                Inhabilitado{value.fecha_fin_inhabilitacion ? ` hasta ${value.fecha_fin_inhabilitacion}` : ""}
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(null)}
            >
              <X />
            </Button>
          </div>
        </div>
        {value.inhabilitado_vigente ? (
          <p className="text-xs text-destructive">
            Este contratista está inhabilitado para contratar (RN-CIERRE-010) — el registro será
            rechazado al guardar.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {!creating ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nombre o RFC..."
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
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="flex flex-col items-start">
                    <span className="font-medium">{result.nombre}</span>
                    <span className="text-xs text-muted-foreground">{result.rfc}</span>
                  </span>
                  {result.inhabilitado_vigente ? (
                    <Badge variant="destructive" className="shrink-0">
                      Inhabilitado
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          ) : query.trim() && !searching ? (
            <p className="text-xs text-muted-foreground">Sin resultados.</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
          >
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
                <Label className="text-xs">Representante</Label>
                <Input
                  value={draft.representante}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, representante: event.target.value }))
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
              <div className="space-y-1">
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
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={saving || !draft.nombre || !draft.rfc}
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
    </div>
  );
}
