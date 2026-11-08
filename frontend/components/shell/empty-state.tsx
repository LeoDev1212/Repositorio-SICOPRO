import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-56 items-center gap-5 px-5 py-8 sm:grid-cols-[auto_1fr_auto] sm:gap-7 sm:px-8">
      <div className="grid size-14 place-items-center border border-primary/20 bg-primary/5 text-primary">
        <Icon className="size-6" strokeWidth={1.7} />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase text-primary">{eyebrow}</p>
        <h2 className="mt-1 font-heading text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="hidden border-l border-border pl-6 font-mono text-[10px] uppercase leading-5 text-muted-foreground sm:block">
        <span className="block text-2xl font-semibold text-foreground">00</span>
        Registros
      </div>
    </div>
  );
}