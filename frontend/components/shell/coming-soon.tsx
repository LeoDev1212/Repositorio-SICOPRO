import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase text-primary">Módulo / SICOPRO</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      <section className="grid min-h-64 items-center gap-6 border-y border-border px-5 py-10 sm:grid-cols-[auto_1fr_auto] sm:px-8">
        <div className="grid size-14 place-items-center border border-primary/20 bg-primary/5 text-primary">
          <Construction className="size-6" strokeWidth={1.7} />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-primary">Estado del módulo</p>
          <h2 className="mt-1 font-heading text-lg font-semibold">En desarrollo</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Esta sección todavía no está disponible en la versión académica actual.
          </p>
        </div>
        <div className="border-l border-border pl-6 font-mono text-[10px] uppercase leading-5 text-muted-foreground">
          <span className="block text-sm font-semibold text-foreground">SICOPRO</span>
          Plataforma académica
        </div>
      </section>
    </div>
  );
}
