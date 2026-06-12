'use client';

interface DayData {
  date: string; // dd/mm
  income: number;
  expense: number;
}

interface RevenueChartProps {
  data: DayData[];
  title: string;
}

function formatK(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function RevenueChart({ data, title }: RevenueChartProps) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const BAR_W = 16;
  const GAP = 4;
  const GROUP_W = BAR_W * 2 + GAP + 8;
  const H = 180;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 22;
  const PAD_LEFT = 40;
  const PAD_RIGHT = 16;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const W = PAD_LEFT + data.length * GROUP_W + PAD_RIGHT;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p
          className="text-sm font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {title}
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e] inline-block" />
            Receitas
          </span>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444] inline-block" />
            Despesas
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: Math.min(W, 600), width: '100%', height: 'auto' }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = PAD_TOP + innerH - ratio * innerH;
            return (
              <g key={ratio}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={W - PAD_RIGHT}
                  y2={y}
                  stroke="#3A3A3A"
                  strokeWidth="0.5"
                  strokeDasharray="3 3"
                />
                <text x={PAD_LEFT - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#A8A8A8">
                  {formatK(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const x = PAD_LEFT + i * GROUP_W;
            const incomeH = (d.income / maxVal) * innerH;
            const expenseH = (d.expense / maxVal) * innerH;

            return (
              <g key={d.date}>
                {/* Income bar */}
                {d.income > 0 && (
                  <rect
                    x={x}
                    y={PAD_TOP + innerH - incomeH}
                    width={BAR_W}
                    height={incomeH}
                    fill="#22c55e"
                    rx="2"
                  />
                )}
                {/* Expense bar */}
                {d.expense > 0 && (
                  <rect
                    x={x + BAR_W + GAP}
                    y={PAD_TOP + innerH - expenseH}
                    width={BAR_W}
                    height={expenseH}
                    fill="#ef4444"
                    rx="2"
                  />
                )}
                {/* Label X */}
                <text
                  x={x + BAR_W}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#A8A8A8"
                >
                  {d.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}