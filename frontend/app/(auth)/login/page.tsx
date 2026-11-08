"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Construction, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Primes the gacm_csrf cookie so the login POST itself is CSRF-protected.
    apiFetch("/auth/csrf/").catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/contratos");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("El correo o la contraseña no coinciden.");
      } else {
        setError("No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-svh bg-background md:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <aside className="relative hidden min-h-svh flex-col justify-between overflow-hidden bg-sidebar px-10 py-9 text-sidebar-foreground md:flex xl:px-16">
        <div className="login-blueprint absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-sidebar-primary font-heading text-xl font-bold text-sidebar-primary-foreground">
            <Construction className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-sidebar-primary">SICOPRO / OBRA</p>
            <p className="text-sm font-semibold">Gestión de contratos</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl pb-8">
          <p className="mb-5 font-mono text-xs uppercase text-sidebar-primary">
            Plataforma académica · México
          </p>
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-normal text-sidebar-foreground xl:text-5xl">
            Gestión clara,
            <br />
            obra bajo control.
          </h1>
          <div className="mt-8 flex items-center gap-3 text-sm text-sidebar-foreground/70">
            <span className="h-px w-12 bg-sidebar-primary" />
            Contratos · bitácora · estimaciones
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-sidebar-border pt-4 font-mono text-[10px] uppercase text-sidebar-foreground/50">
          <span>SICOPRO / Entorno académico</span>
          <span>Acceso con cuenta asignada</span>
        </div>
      </aside>

      <main className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-3 md:hidden">
            <div className="grid size-10 place-items-center rounded-md bg-primary font-heading text-lg font-bold text-primary-foreground">
              <Construction className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-primary">SICOPRO / OBRA</p>
              <p className="text-sm font-semibold">Gestión de contratos</p>
            </div>
          </div>

          <Image
            src="/SICOPRO.png"
            alt="Logotipo de SICOPRO"
            width={160}
            height={160}
            priority
            className="mb-6 size-24 object-contain object-left"
          />
          <p className="font-mono text-[10px] uppercase text-primary">Acceso a plataforma</p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-normal text-foreground">
            Iniciar sesión
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ingresa con las credenciales de tu cuenta asignada.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-md border-border bg-card px-3"
                placeholder="nombre@institucion.mx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-md border-border bg-card px-3 pr-12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div role="alert" className="border-l-2 border-destructive bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="h-12 w-full rounded-md" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitting ? "Validando acceso" : "Entrar"}
              {!submitting ? <ArrowRight /> : null}
            </Button>
          </form>

          <p className="mt-10 border-t border-border pt-4 font-mono text-[10px] uppercase text-muted-foreground">
            SICOPRO · Sistema académico de gestión de obra
          </p>
        </div>
      </main>
    </div>
  );
}