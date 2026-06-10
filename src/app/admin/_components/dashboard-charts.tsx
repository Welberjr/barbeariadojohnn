'use client';

import { useMemo } from 'react';

interface MrrPoint {
  month: string;
  value: number;
}

interface DashboardChartsProps {
  mrrData: MrrPoint[];
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(mo) - 1]}/${y.slice(2)}`;
}

function formatK(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

export function DashboardCharts({ mrrData }: DashboardChartsProps) {
  const maxVal = useMemo(() => Math.max(...mrrData.map((d) => d.value), 1), [mrrData]);

  const W = 700;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const points = mrrData.map((d, i) => {
    const x = PAD.left + (i / Math.max(mrrData.length - 1, 1)) * innerW;
    const y = PAD.top + innerH - (d.value / maxVal) * innerH;
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    mrrData.length > 1
      ? `M ${points[0].x},${PAD.top + innerH} ` +
        points.map((p) => `L ${p.x},${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x},${PAD.top + innerH} Z`
      : '';

  return (
    <div className="card p-5 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-fg-dim">
        Receita de Assinaturas (MRR)
      </p>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: 320 }}
        >
          {/* area */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#mrrGrad)"
              opacity="0.2"
            />
          )}
          {/* linha */}
          {mrrData.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#D4A04F"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* pontos */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#D4A04F" />
          ))}
          {/* labels X */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={H - 5}
              textAnchor="middle"
              fontSize="9"
              fill="#666"
            >
              {formatMonth(p.month)}
            </text>
          ))}
          {/* labels Y (3 linhas) */}
          {[0, 0.5, 1].map((ratio) => {
            const yPos = PAD.top + innerH - ratio * innerH;
            return (
              <g key={ratio}>
                <line
                  x1={PAD.left}
                  y1={yPos}
                  x2={W - PAD.right}
                  y2={yPos}
                  stroke="#333"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={PAD.left - 5}
                  y={yPos + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#666"
                >
                  {formatK(maxVal * ratio)}
                </text>
              </g>
            );
          })}
          {/* gradiente */}
          <defs>
            <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4A04F" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#D4A04F" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
