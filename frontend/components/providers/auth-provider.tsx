"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { apiFetch } from "@/lib/api";
import type { Me } from "@/lib/types";

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ me: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<Me>("/auth/me/")
      .then((data) => {
        if (active) setMe(data);
      })
      .catch(() => {
        // apiFetch already redirects to /login on 401
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return <AuthContext.Provider value={{ me, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
