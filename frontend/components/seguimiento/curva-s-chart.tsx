"use client";

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

import { formatMoney } from "@/lib/format";
import type { CurvaSPunto } from "@/lib/types";

const WIDTH = 720;
const HEIGHT = 280;
const PADDING = { top: 16, right: 16, bottom: 28, left: 72 };
const GRID_STEPS = 4;

export function CurvaSChart({
  puntos,
  mesActual,
}: {
  puntos: CurvaSPunto[];
  mesActual: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const datos = useMemo(
    () =>
      puntos.map((p) => ({
        mes: p.mes,
        programado: Number(p.programado_acumulado),
        real: Number(p.real_acumulado),
      })),
    [puntos],
  );

  const mesesTotal = datos.length;
  const maxValor = Math.max(1, ...datos.map((d) => Math.max(d.programado, d.real)));
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  function x(mes: number) {
    return mesesTotal <= 1
      ? PADDING.left
      : PADDING.left + ((mes - 1) / (mesesTotal - 1)) * innerWidth;
  }
  function y(valor: number) {
    return PADDING.top + innerHeight - (valor / maxValor) * innerHeight;
  }

  function pathFor(key: "programado" | "real") {
    return datos.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.mes)} ${y(d[key])}`).join(" ");
  }

  const gridValues = Array.from({ length: GRID_STEPS + 1 }, (_, i) => (maxValor / GRID_STEPS) * i);

  function handleMove(event: ReactPointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = mesesTotal <= 1 ? 0 : (event.clientX - rect.left) / rect.width;
    const mesAprox = Math.round(1 + ratio * (mesesTotal - 1));
    setHoverIndex(Math.min(mesesTotal - 1, Math.max(0, mesAprox - 1)));
  }

  if (datos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos de programa para graficar.</p>;
  }

  const activo = hoverIndex !== null ? datos[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" />
          <span className="text-muted-foreground">Programado</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#eb6834] dark:bg-[#d95926]" />
          <span className="text-muted-foreground">Real</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Curva S: avance programado contra avance real, acumulado por mes"
      >
        {gridValues.map((valor, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(valor)}
              y2={y(valor)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={y(valor)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {formatMoney(valor)}
            </text>
          </g>
        ))}

        {mesActual >= 1 && mesActual <= mesesTotal ? (
          <line
            x1={x(mesActual)}
            x2={x(mesActual)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            className="stroke-muted-foreground"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        ) : null}

        <path
          d={pathFor("programado")}
          fill="none"
          className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathFor("real")}
          fill="none"
          className="stroke-[#eb6834] dark:stroke-[#d95926]"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {datos.map((d) => (
          <text
            key={d.mes}
            x={x(d.mes)}
            y={HEIGHT - PADDING.bottom + 16}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {d.mes}
          </text>
        ))}

        {activo ? (
          <g>
            <line
              x1={x(activo.mes)}
              x2={x(activo.mes)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              className="stroke-border"
              strokeWidth={1}
            />
            <circle
              cx={x(activo.mes)}
              cy={y(activo.programado)}
              r={4}
              className="fill-[#2a78d6] dark:fill-[#3987e5]"
            />
            <circle
              cx={x(activo.mes)}
              cy={y(activo.real)}
              r={4}
              className="fill-[#eb6834] dark:fill-[#d95926]"
            />
          </g>
        ) : null}

        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      {activo ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">Mes {activo.mes}</span>
          <span className="text-[#1c5cab] dark:text-[#3987e5]">
            Programado: {formatMoney(activo.programado)}
          </span>
          <span className="text-[#c9501f] dark:text-[#d95926]">
            Real: {formatMoney(activo.real)}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pasa el cursor sobre la gráfica para ver el detalle de cada mes.
        </p>
      )}
    </div>
  );
}
