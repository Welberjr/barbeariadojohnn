import { createClient } from '@/lib/supabase/server';
import {
  CircleDollarSign,
  TrendingUp,
  Wallet,
  Receipt,
  Users,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Financeiro',
};

interface FinanceiroPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function FinanceiroPage({
  searchParams,
}: FinanceiroPageProps) {
  const { from: fromParam, to: toParam } = await searchParams;
  const supabase = await createClient();

  // Período: default = mês corrente
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const fromDate = fromParam ? new Date(fromParam + 'T00:00:00') : firstOfMonth;
  const toDate = toParam ? new Date(toParam + 'T23:59:59') : lastOfMonth;

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const periodStart = `${fromStr}T00:00:00.000-03:00`;
  const periodEnd = `${toStr}T23:59:59.999-03:00`;

  // 1. Comandas fechadas no período
  const { data: comandasRaw } = await supabase
    .from('comandas')
    .select('id, total, subtotal, net_total, staff_id, closed_at, customer_id')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'closed')
    .gte('closed_at', periodStart)
    .lte('closed_at', periodEnd)
    .order('closed_at', { ascending: false });

  const comandas = comandasRaw ?? [];
  const comandaIds = comandas.map((c) => c.id);

  // 2. Itens das comandas (para comissões e separação serviço/produto)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payments: any[] = [];

  if (comandaIds.length > 0) {
    const [{ data: itemsAgg }, { data: paymentsAgg }] = await Promise.all([
      supabase
        .from('comanda_items')
        .select(
          'comanda_id, item_type, total_price, commission_value, staff_id'
        )
        .in('comanda_id', comandaIds),
      supabase
        .from('comanda_payments')
        .select('comanda_id, method, amount, net_amount, fee_value')
        .in('comanda_id', comandaIds),
    ]);
    items = itemsAgg ?? [];
    payments = paymentsAgg ?? [];
  }

  // 3. Métricas globais
  const faturamentoBruto = comandas.reduce(
    (sum, c) => sum + Number(c.total ?? 0),
    0
  );
  const faturamentoLiquido = comandas.reduce(
    (sum, c) => sum + Number(c.net_total ?? c.total ?? 0),
    0
  );
  const totalAtendimentos = comandas.length;
  const ticketMedio =
    totalAtendimentos > 0 ? faturamentoBruto / totalAtendimentos : 0;

  // Clientes únicos no período
  const clientesUnicos = new Set(
    comandas.map((c) => c.customer_id).filter(Boolean)
  ).size;

  // Total de serviços vs produtos
  const totalServicos = items
    .filter((i) => i.item_type === 'service')
    .reduce((s, i) => s + Number(i.total_price ?? 0), 0);
  const totalProdutos = items
    .filter((i) => i.item_type === 'product')
    .reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  // 4. Comissões por profissional
  const { data: staffRaw } = await supabase
    .from('staff')
    .select('id, display_name')
    .eq('active', true)
    .order('display_name');

  const staffMap = new Map(
    (staffRaw ?? []).map((s) => [s.id as string, s.display_name as string])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commissionByStaff = new Map<string, { name: string; commission: number; vendas: number; servicos: number; produtos: number }>();

  for (const item of items) {
    const sid = (item.staff_id as string | null) ?? null;
    if (!sid) continue;
    const name = staffMap.get(sid) ?? '—';
    const current =
      commissionByStaff.get(sid) ??
      { name, commission: 0, vendas: 0, servicos: 0, produtos: 0 };
    current.commission += Number(item.commission_value ?? 0);
    current.vendas += Number(item.total_price ?? 0);
    if (item.item_type === 'service')
      current.servicos += Number(item.total_price ?? 0);
    else if (item.item_type === 'product')
      current.produtos += Number(item.total_price ?? 0);
    commissionByStaff.set(sid, current);
  }

  const comissoesArray = Array.from(commissionByStaff.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.commission - a.commission);

  const totalComissoes = comissoesArray.reduce(
    (s, c) => s + c.commission,
    0
  );

  // 5. Métodos de pagamento (fluxo de caixa)
  const paymentByMethod = new Map<string, { amount: number; net: number; fees: number; count: number }>();

  for (const p of payments) {
    const method = (p.method as string) ?? 'outros';
    const current =
      paymentByMethod.get(method) ?? { amount: 0, net: 0, fees: 0, count: 0 };
    current.amount += Number(p.amount ?? 0);
    current.net += Number(p.net_amount ?? p.amount ?? 0);
    current.fees += Number(p.fee_value ?? 0);
    current.count += 1;
    paymentByMethod.set(method, current);
  }

  const paymentsArray = Array.from(paymentByMethod.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // Helpers
  const methodLabel = (m: string) => {
    const map: Record<string, string> = {
      pix: 'PIX',
      cash: 'Dinheiro',
      dinheiro: 'Dinheiro',
      credit: 'Crédito',
      credito: 'Crédito',
      debit: 'Débito',
      debito: 'Débito',
      transfer: 'Transferência',
    };
    return map[m] ?? m;
  };

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
            Painel Financeiro
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Vendas, comissões e fluxo de caixa do período.
          </p>
        </div>

        {/* FILTRO DE PERÍODO */}
        <form className="flex items-end gap-2" method="get">
          <div>
            <label className="label text-[10px]">De</label>
            <input
              type="date"
              name="from"
              defaultValue={fromStr}
              className="input py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="label text-[10px]">Até</label>
            <input
              type="date"
              name="to"
              defaultValue={toStr}
              className="input py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="btn-secondary py-2 text-sm">
            Aplicar
          </button>
        </form>
      </div>

      <div className="divider-gold" />

      {/* ATALHOS DE PERÍODO */}
      <div className="flex flex-wrap gap-2">
        {(() => {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
            .toISOString()
            .split('T')[0];
          const sevenDaysAgo = new Date(
            today.getTime() - 6 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0];
          const thirtyDaysAgo = new Date(
            today.getTime() - 29 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0];

          const presets = [
            { label: 'Hoje', from: todayStr, to: todayStr },
            { label: '7 dias', from: sevenDaysAgo, to: todayStr },
            { label: '30 dias', from: thirtyDaysAgo, to: todayStr },
            { label: 'Este mês', from: firstDay, to: todayStr },
          ];
          return presets.map((p) => (
            <Link
              key={p.label}
              href={`/admin/financeiro?from=${p.from}&to=${p.to}`}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-gold/40 hover:text-gold transition-colors text-fg-muted"
            >
              {p.label}
            </Link>
          ));
        })()}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <CircleDollarSign className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Faturamento
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(faturamentoBruto)}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            Líquido: {formatCurrency(faturamentoLiquido)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Receipt className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Atendimentos
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalAtendimentos}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            {clientesUnicos} {clientesUnicos === 1 ? 'cliente' : 'clientes'}{' '}
            únicos
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Ticket médio
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(ticketMedio)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-warning/10 text-warning">
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Comissões
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(totalComissoes)}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            {faturamentoBruto > 0
              ? `${((totalComissoes / faturamentoBruto) * 100).toFixed(1)}% do faturamento`
              : '—'}
          </p>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COMISSÕES POR PROFISSIONAL */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gold" />
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Comissões por Profissional
            </h2>
          </div>

          {comissoesArray.length === 0 ? (
            <p className="text-sm text-fg-subtle py-8 text-center">
              Nenhum atendimento registrado no período.
            </p>
          ) : (
            <div className="space-y-3">
              {comissoesArray.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      Vendas: {formatCurrency(c.vendas)} · Serviços:{' '}
                      {formatCurrency(c.servicos)} · Produtos:{' '}
                      {formatCurrency(c.produtos)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                      Comissão
                    </p>
                    <p className="text-lg font-bold text-gold leading-none">
                      {formatCurrency(c.commission)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FLUXO DE CAIXA POR MÉTODO */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-gold" />
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Fluxo de Caixa
            </h2>
          </div>

          {paymentsArray.length === 0 ? (
            <p className="text-sm text-fg-subtle py-8 text-center">
              Nenhum pagamento registrado no período.
            </p>
          ) : (
            <div className="space-y-3">
              {paymentsArray.map((p) => (
                <div
                  key={p.method}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {methodLabel(p.method)}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      {p.count} {p.count === 1 ? 'transação' : 'transações'}
                      {p.fees > 0 && ` · Taxas: ${formatCurrency(p.fees)}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-fg leading-none">
                      {formatCurrency(p.amount)}
                    </p>
                    {p.fees > 0 && (
                      <p className="text-[11px] text-success">
                        Líquido: {formatCurrency(p.net)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MIX SERVIÇOS x PRODUTOS */}
      <section className="card p-6">
        <h2
          className="text-lg font-semibold text-fg mb-4"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Mix de Vendas
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-fg-dim">
              Serviços
            </p>
            <p
              className="text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {formatCurrency(totalServicos)}
            </p>
            <p className="text-[11px] text-fg-subtle mt-1">
              {faturamentoBruto > 0
                ? `${((totalServicos / faturamentoBruto) * 100).toFixed(1)}% do mix`
                : '—'}
            </p>
          </div>
          <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-fg-dim">
              Produtos
            </p>
            <p
              className="text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {formatCurrency(totalProdutos)}
            </p>
            <p className="text-[11px] text-fg-subtle mt-1">
              {faturamentoBruto > 0
                ? `${((totalProdutos / faturamentoBruto) * 100).toFixed(1)}% do mix`
                : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* ÚLTIMAS COMANDAS FECHADAS */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Últimas vendas do período
          </h2>
        </div>

        {comandas.length === 0 ? (
          <p className="text-sm text-fg-subtle py-8 text-center">
            Nenhuma comanda fechada no período.
          </p>
        ) : (
          <div className="space-y-2">
            {comandas.slice(0, 10).map((c) => {
              const closedDate = c.closed_at
                ? new Date(c.closed_at as string)
                : null;
              const dateStr = closedDate
                ? closedDate.toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—';
              return (
                <Link
                  key={c.id}
                  href={`/admin/comandas/${c.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60 hover:border-gold/40 transition-colors"
                >
                  <div>
                    <p className="text-xs text-fg-subtle">{dateStr}</p>
                    <p className="text-sm text-fg-muted">
                      {staffMap.get(c.staff_id as string) ?? '—'}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gold">
                    {formatCurrency(Number(c.total ?? 0))}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
