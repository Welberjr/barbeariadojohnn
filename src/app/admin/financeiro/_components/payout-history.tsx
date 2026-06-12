'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Payout {
  id: string;
  staff_id: string;
  amount_paid: number;
  total_commissions: number | null;
  total_allowances: number | null;
  total_expenses: number | null;
  period_start: string;
  period_end: string;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  staff: { display_name: string } | null;
}

interface StaffOption {
  id: string;
  display_name: string;
}

const PAGE_SIZE = 5;

function fmtDate(d: string | null) {
  if (!d) return '—';
  const iso = d.length === 10 ? `${d}T00:00:00` : d;
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function PayoutHistorySection({
  payouts,
  staff,
}: {
  payouts: Payout[];
  staff: StaffOption[];
}) {
  const [query, setQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = payouts.filter((p) => {
    const matchStaff = staffFilter === 'all' || p.staff_id === staffFilter;
    const term = query.trim().toLowerCase();
    const matchQ =
      !term ||
      (p.staff?.display_name ?? '').toLowerCase().includes(term) ||
      (p.notes ?? '').toLowerCase().includes(term) ||
      (p.payment_method ?? '').toLowerCase().includes(term);
    return matchStaff && matchQ;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, staffFilter]);

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Histórico de Pagamentos de Comissão
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
            <input
              type="text"
              placeholder="Buscar..."
              className="input pl-9 py-1.5 text-xs w-44"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input py-1.5 text-xs w-auto"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">Todos os profissionais</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-fg-subtle py-6 text-center">
          Nenhum pagamento encontrado.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-fg-dim border-b border-border/60">
                  <th className="py-2 text-left">Profissional</th>
                  <th className="py-2 text-left">Período</th>
                  <th className="py-2 text-right">Comissões</th>
                  <th className="py-2 text-right">Vales</th>
                  <th className="py-2 text-right text-success">Valor pago</th>
                  <th className="py-2 text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/30 hover:bg-bg-elevated transition-colors"
                  >
                    <td className="py-3 text-fg">
                      {p.staff?.display_name ?? '—'}
                    </td>
                    <td className="py-3 text-fg-muted">
                      {fmtDate(p.period_start)} a {fmtDate(p.period_end)}
                    </td>
                    <td className="py-3 text-right text-gold font-semibold">
                      {formatCurrency(Number(p.total_commissions ?? p.amount_paid ?? 0))}
                    </td>
                    <td className="py-3 text-right text-fg-muted">
                      {Number(p.total_allowances ?? 0) > 0
                        ? `- ${formatCurrency(Number(p.total_allowances))}`
                        : '—'}
                    </td>
                    <td className="py-3 text-right text-success font-semibold">
                      {formatCurrency(Number(p.amount_paid ?? 0))}
                    </td>
                    <td className="py-3 text-right text-fg-muted">
                      {fmtDate(p.payment_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
              <p className="text-xs text-fg-muted">
                Página {safePage} de {totalPages} · {filtered.length} pagamentos
              </p>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}