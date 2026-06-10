'use client';

interface PeriodSelectorProps {
  value: string;
  year: number;
  month: number;
}

export function PeriodSelector({ value, year, month }: PeriodSelectorProps) {
  return (
    <select
      className="input text-sm py-1.5 w-40"
      defaultValue={value}
      onChange={(e) => {
        window.location.href = `/admin/produtos?period=${e.target.value}`;
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(year, month - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        return (
          <option key={val} value={val}>
            {label}
          </option>
        );
      })}
    </select>
  );
}