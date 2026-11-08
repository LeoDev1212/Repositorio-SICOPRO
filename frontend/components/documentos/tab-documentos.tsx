"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api";
import type { ContractDocument, Contract, DocumentBloque } from "@/lib/types";

const BLOQUES: { value: DocumentBloque; label: string }[] = [
  { value: "catalogo", label: "Catálogo de conceptos" },
  { value: "programa", label: "Programa de obra" },
  { value: "garantias", label: "Garantías" },
  { value: "amortizacion", label: "Amortización del anticipo" },
  { value: "juridico", label: "Información jurídica" },
  { value: "contrato", label: "Contrato digitalizado" },
];

function BloqueCard({
  contrato,
  bloque,
  label,
  canEdit,
  onChange,
}: {
  contrato: Contract;
  bloque: DocumentBloque;
  label: string;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [documentos, setDocumentos] = useState<ContractDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await apiFetch<ContractDocument[]>(
      `/documentos/archivos/?contrato=${contrato.id}&bloque=${bloque}`,
    );
    setDocumentos(data);
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id, bloque]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("contrato", String(contrato.id));
    formData.append("bloque", bloque);
    formData.append("nombre", file.name);
    formData.append("archivo", file);
    try {
      await apiFetch("/documentos/archivos/", { method: "POST", body: formData });
      await load();
      onChange();
      toast.success("Documento cargado.");
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.body && typeof err.body === "object"
          ? String(Object.values(err.body as Record<string, unknown>)[0])
          : "No se pudo cargar el documento.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSustituir(documentoId: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("archivo", file);
    try {
      await apiFetch(`/documentos/archivos/${documentoId}/sustituir/`, {
        method: "POST",
        body: formData,
      });
      await load();
      onChange();
      toast.success("Documento sustituido.");
    } catch {
      toast.error("No se pudo sustituir el documento.");
    }
  }

  const vigentes = (documentos ?? []).filter((d) => d.estado === "vigente");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{label}</CardTitle>
        <Badge variant={vigentes.length > 0 ? "default" : "outline"}>
          {vigentes.length > 0 ? "Completo" : "Sin documentos"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {documentos === null ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : vigentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin documentos cargados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {vigentes.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2">
                <a
                  href={doc.archivo}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary underline-offset-2 hover:underline"
                >
                  {doc.nombre}
                </a>
                {canEdit ? (
                  <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Sustituir
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleSustituir(doc.id, e)}
                    />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Subir documento
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TabDocumentos({
  contrato,
  canEdit,
  onChange,
}: {
  contrato: Contract;
  canEdit: boolean;
  onChange: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BLOQUES.map((b) => (
        <BloqueCard
          key={b.value}
          contrato={contrato}
          bloque={b.value}
          label={b.label}
          canEdit={canEdit}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
