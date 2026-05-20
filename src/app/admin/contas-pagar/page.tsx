import { createClient } from '@/lib/supabase/server';
import {
  Plus,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CircleDollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { ContasPagarFilters } from './_components/contas-pagar-filters';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Contas a Pagar',
};

interface Bill {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  category_id: string | null;
  supplier: string | null;
  status: string;
  is_recurring: boolean;
  recurrence_type: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface ContasPagarPageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
  }>;
}

export default async function ContasPagarPage({
  searchParams,
}: ContasPagarPageProps) {
  const { status: statusParam, category: categoryParam } = await searchParams;
  const supabase = await createClient();

  // Buscar bills
  let query = supabase
    .from('bills')
    .select(
      'id, description, amount, due_date, paid_at, paid_amount, payment_method, category_id, supplier, status, is_recurring, recurrence_type'
    )
    .eq('barbershop_id', BARBERSHOP_ID);

  if (statusParam && statusParam !== 'all') {
    query = query.eq('status', statusParam);
  }

  if (categoryParam && categoryParam !== 'all') {
    query = query.eq('category_id', categoryParam);
  }

  const { data: billsRaw } = await query
    .order('status', { ascending: true }) // pending primeiro
    .order('due_date', { ascending: true });

  const bills = (billsRaw ?? []) as Bill[];

  // Categorias
  const { data: categoriesRaw } = await supabase
    .from('expense_categories')
    .select('id, name, color')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('display_order')
    .order('name');

  const categories = (categoriesRaw ?? []) as Category[];
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // KPIs (sobre TODAS as bills, sem filtro)
  const { data: allBills } = await supabase
    .from('bills')
    .select('amount, due_date, paid_at, status')
    .eq('barbershop_id', BARBERSHOP_ID);

  const todayStr = new Date().toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split('T')[0];

  let totalPending = 0;
  let totalOverdue = 0;
  let totalDueSoon = 0;
  let totalPaidThisMonth = 0;

  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split('T')[0];

  for (const b of allBills ?? []) {
    const amt = Number(b.amount ?? 0);
    if (b.status === 'pending') {
      totalPending += amt;
      if (b.due_date < todayStr) {
        totalOverdue += amt;
      } else if (b.due_date <= sevenDaysFromNow) {
        totalDueSoon += amt;
      }
    } else if (b.status === 'paid' && b.paid_at) {
      const paidDate = (b.paid_at as string).split('T')[0];
      if (paidDate >= firstOfMonth) {
        totalPaidThisMonth += amt;
      }
    }
  }

  const currentStatus = statusParam ?? 'all';
  const currentCategory = categoryParam ?? 'all';

  const statusLabel = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Pendente', cls: 'text-warning' },
      paid: { label: 'Paga', cls: 'text-success' },
      overdue: { label: 'Vencida', cls: 'text-danger' },
      cancelled: { label: 'Cancelada', cls: 'text-fg-subtle' },
    };
    return map[s] ?? { label: s, cls: 'text-fg' };
  };

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Financeiro
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Contas a Pagar
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Despesas, fornecedores, aluguel e contas recorrentes.
          </p>
        </div>

        <Link
          href="/admin/contas-pagar/nova"
          className="btn-gold-shimmer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nova conta</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-warning/10 text-warning">
              <Receipt className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Total pendente
            </p>
          </div>
          <p
            className="text-2xl font-bold text-warning"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(totalPending)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-md ${
                totalOverdue > 0
                  ? 'bg-danger/10 text-danger'
                  : 'bg-info/10 text-info'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Vencidas
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${
              totalOverdue > 0 ? 'text-danger' : 'text-fg'
            }`}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(totalOverdue)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Vencem 7d
            </p>
          </div>
          <p
            className="text-2xl font-bold text-info"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(totalDueSoon)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Pagas no mês
            </p>
          </div>
          <p
            className="text-2xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(totalPaidThisMonth)}
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <ContasPagarFilters
        currentStatus={currentStatus}
        currentCategory={currentCategory}
        categories={categories}
      />

      {/* LISTA */}
      {bills.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
            <Receipt className="w-6 h-6" />
          </div>
          <h2
            className="text-xl font-bold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Nenhuma conta encontrada
          </h2>
          <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
            {currentStatus === 'all'
              ? 'Cadastre suas contas a pagar para começar a controlar o financeiro.'
              : 'Nenhuma conta com este filtro.'}
          </p>
          <Link
            href="/admin/contas-pagar/nova"
            className="btn-gold-shimmer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar primeira conta</span>
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim font-semibold">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim font-semibold">
                    Descrição
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim font-semibold">
                    Categoria
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim font-semibold">
                    Vencimento
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim font-semibold">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const cat = b.category_id
                    ? categoryMap.get(b.category_id)
                    : null;
                  const isOverdue =
                    b.status === 'pending' && b.due_date < todayStr;
                  const s = isOverdue
                    ? statusLabel('overdue')
                    : statusLabel(b.status);

                  return (
                    <tr
                      key={b.id}
                      className="border-b border-border/40 hover:bg-bg-elevated/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.cls}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOverdue
                                ? 'bg-danger'
                                : b.status === 'paid'
                                ? 'bg-success'
                                : b.status === 'pending'
                                ? 'bg-warning'
                                : 'bg-fg-dim'
                            }`}
                          />
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/contas-pagar/${b.id}`}
                          className="text-fg font-medium hover:text-gold transition-colors"
                        >
                          {b.description}
                        </Link>
                        {b.supplier && (
                          <p className="text-[11px] text-fg-subtle">
                            {b.supplier}
                          </p>
                        )}
                        {b.is_recurring && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-info mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            Recorrente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: cat.color ?? '#9CA3AF',
                              }}
                            />
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-xs text-fg-dim">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-fg-muted text-xs">
                        {formatDate(b.due_date)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p
                          className="text-base font-bold text-fg"
                          style={{
                            fontFamily: 'var(--font-playfair), serif',
                          }}
                        >
                          {formatCurrency(Number(b.amount))}
                        </p>
                        {b.status === 'paid' &&
                          b.paid_amount != null &&
                          Number(b.paid_amount) !== Number(b.amount) && (
                            <p className="text-[10px] text-success">
                              pago: {formatCurrency(Number(b.paid_amount))}
                            </p>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DICA */}
      <div className="card p-5 border-info/30 bg-info/5">
        <div className="flex gap-3 items-start">
          <CircleDollarSign className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-fg">
              💡 Dica para contas recorrentes
            </p>
            <p className="text-[12px] text-fg-muted mt-1 leading-relaxed">
              Ao marcar uma conta como recorrente (aluguel, energia, internet), você
              poderá gerar a próxima ocorrência com um clique a partir da página de
              detalhes da conta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
