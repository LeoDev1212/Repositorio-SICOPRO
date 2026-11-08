"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { NuevoContratoWizard } from "@/components/contratos/nuevo-contrato-wizard";

export default function NuevoContratoPage() {
  const router = useRouter();
  const { me, loading } = useAuth();

  useEffect(() => {
    if (!loading && me && me.role !== "dependencia") {
      router.replace("/contratos");
    }
  }, [loading, me, router]);

  if (loading || !me || me.role !== "dependencia") {
    return null;
  }

  return <NuevoContratoWizard />;
}
