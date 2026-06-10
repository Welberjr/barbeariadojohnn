import { createClient } from '@/lib/supabase/server';
import {
  CircleDollarSign,
  TrendingUp,
  Wallet,
  Receipt,
  Users,
  Calendar,
  CreditCard,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { CommissionPayButton } from './_components/commission-pay-button';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = { title: 'Financeiro' };

interface FinanceiroPageProps {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}

export default async function FinanceiroPage({ searchParams }: FinanceiroPageProps) {
  const { from: fromParam, to: toParam } = await searchParams;
  const admin = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fromDate = fromParam ? new Date(fromParam + 'T00:00:00') : firstOfMonth;
  const toDate = toParam ? new Date(toParam + 'T23:59:59') : lastOfMonth;
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];
  const periodStart = `${fromStr}T00:00:00.000-03:00`;
  const periodEnd = `${toStr}T23:59:59.999-03:00`;

  const [
    { data: comandasRaw },
    { data: staffRaw },
    { data: payoutHistoryRaw },
  ] = await Promise.all([
    admin
      .from('comandas')
      .select('id, total, subtotal, net_total, staff_id, closed_at, customer_id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .gte('closed_at', periodStart)
      .lte('closed_at', periodEnd)
      .order('closed_at', { ascending: false }),
    admin
      .from('staff')
      .select('id, display_name')
      .eq('active', true)
      .order('display_name'),
    admin
      .from('commission_payouts')
      .select('id, staff_id, amount_paid, period_start, period_end, payment_date, payment_method, notes, staff:staff(display_name)')
      .eq('barbershop_id', BARBERSHOP_ID)
      .order('payment_date', { ascending: false })
      .limit(30),
  ]);

  const comandas = comandasRaw ?? [];
  const comandaIds = comandas.map((c) => c.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payments: any[] = [];

  if (comandaIds.length > 0) {
    const [{ data: itemsAgg }, { data: paymentsAgg }] = await Promise.all([
      admin
        .from('comanda_items')
        .select('comanda_id, item_type, total_price, commission_value, staff_id')
        .in('comanda_id', comandaIds),
      admin
        .from('comanda_payments')
        .select('comanda_id, method, amount, net_amount, fee_value')
        .in('comanda_id', comandaIds),
    ]);
    items = itemsAgg ?? [];
    payments = paymentsAgg ?? [];
  }

  const faturamentoBruto = comandas.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const totalAtendimentos = comandas.length;
  const ticketMedio = totalAtendimentos > 0 ? faturamentoBruto / totalAtendimentos : 0;
  const clientesUnicos = new Set(comandas.map((c) => c.customer_id).filter(Boolean)).size;
  const totalServicos = items.filter((i) => i.item_type === 'service').reduce((s, i) => s + Number(i.total_price ?? 0), 0);
  const totalProdutos = items.filter((i) => i.item_type === 'product').reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  const staffMap = new Map((staffRaw ?? []).map((s) => [s.id as string, s.display_name as string]));

  // Comissões por profissional (no período)
  const commissionByStaff = new Map<string, {
    name: string; commission: number; vendas: number;
    servicos: number; produtos: number; atend: number;
  }>();
  for (const item of items) {
    const sid = item.staff_id as string | null;
    if (!sid) continue;
    const name = staffMap.get(sid) ?? '—';
    const cur = commissionByStaff.get(sid) ?? { name, commission: 0, vendas: 0, servicos: 0, produtos: 0, atend: 0 };
    cur.commission += Number(item.commission_value ?? 0);
    cur.vendas += Number(item.total_price ?? 0);
    if (item.item_type === 'service') cur.servicos += Number(item.total_price ?? 0);
    else cur.produtos += Number(item.total_price ?? 0);
    commissionByStaff.set(sid, cur);
  }

  // Atendimentos por profissional
  for (const c of comandas) {
    const sid = c.staff_id as string | null;
    if (!sid) continue;
    const cur = commissionByStaff.get(sid);
    if (cur) cur.atend++;
  }

  const comissoesArray = Array.from(commissionByStaff.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.commission - a.commission);

  // Historico de pagamentos de comissao
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payoutHistory = (payoutHistoryRaw ?? []) as any[];

  const totalComissoes = comissoesArray.reduce((s, c) => s + c.commission, 0);

  const paymentByMethod = new Map<string, { amount: number; net: number; fees: number; count: number }>();
  for (const p of payments) {
    const method = (p.method as string) ?? 'outros';
    const cur = paymentByMethod.get(method) ?? { amount: 0, net: 0, fees: 0, count: 0 };
    cur.amount += Number(p.amount ?? 0);
    cur.net += Number(p.net_amount ?? p.amount ?? 0);
    cur.fees += Number(p.fee_value ?? 0);
    cur.count += 1;
    paymentByMethod.set(method, cur);
  }
  const paymentsArray = Array.from(paymentByMethod.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.amount - a.amount);

  const methodLabel = (m: string) => {
    const map: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', dinheiro: 'Dinheiro', credit: 'Crédito', credito: 'Crédito', debit: 'Débito', debito: 'Débito' };
    return map[m] ?? m;
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Financeiro</p>
          <h1 className="text-3xl text-fg font-bold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Financeiro
          </h1>
          <p className="text-sm text-fg-muted mt-2">Controle completo das suas finanças</p>
        </div>
        <form className="flex items-end gap-2" method="get">
          <div>
            <label className="label text-[10px]">De</label>
            <input type="date" name="from" defaultValue={fromStr} className="input py-1.5 text-sm" />
          </div>
          <div>
            <label className="label text-[10px]">Até</label>
            <input type="date" name="to" defaultValue={toStr} className="input py-1.5 text-sm" />
          </div>
          <button type="submit" className="btn-secondary py-2 text-sm">Aplicar</button>
        </form>
      </div>

      <div className="divider-gold" />

      {/* ATALHOS */}
      <div className="flex flex-wrap gap-2">
        {(() => {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
          const sevenAgo = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0];
          const thirtyAgo = new Date(today.getTime() - 29 * 86400000).toISOString().split('T')[0];
          return [
            { label: 'Hoje', from: todayStr, to: todayStr },
            { label: '7 dias', from: sevenAgo, to: todayStr },
            { label: '30 dias', from: thirtyAgo, to: todayStr },
            { label: 'Este mês', from: firstDay, to: todayStr },
          ].map((p) => (
            <Link key={p.label} href={`/admin/financeiro?from=${p.from}&to=${p.to}`}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-gold/40 hover:text-gold transition-colors text-fg-muted">
              {p.label}
            </Link>
          ));
        })()}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Receita real', value: formatCurrency(faturamentoBruto), sub: `Prevista: ${formatCurrency(faturamentoBruto * 1.1)}`, icon: CircleDollarSign, cls: 'text-gold' },
          { label: 'Despesas', value: formatCurrency(0), sub: 'Total no período', icon: Receipt, cls: 'text-danger' },
          { label: 'Comissões reais', value: formatCurrency(totalComissoes), sub: `Prevista: ${formatCurrency(totalComissoes * 1.1)}`, icon: Users, cls: 'text-fg' },
          { label: 'Ticket médio', value: formatCurrency(ticketMedio), sub: `${clientesUnicos} clientes únicos`, icon: TrendingUp, cls: 'text-fg' },
          { label: 'Lucro líquido', value: formatCurrency(faturamentoBruto - totalComissoes), sub: 'Receitas − Comissões', icon: Wallet, cls: 'text-success' },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gold" />
                <p className="text-[10px] tracking-widest uppercase text-fg-muted">{k.label}</p>
              </div>
              <p className={`text-xl font-bold ${k.cls}`} style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {k.value}
              </p>
              <p className="text-[10px] text-fg-subtle mt-1">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* RANKING COMISSÕES POR PROFISSIONAL */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gold" />
          <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Ranking de Comissões por Profissional
          </h2>
        </div>

        {/* Seletor de período para o ranking */}
        <div className="flex gap-2 flex-wrap">
          {['Mês/Ano', 'Intervalo'].map((label) => (
            <button key={label} type="button"
              className="px-3 py-1 rounded-md text-xs border border-border text-fg-muted hover:border-gold/40 hover:text-gold transition-colors">
              {label}
            </button>
          ))}
        </div>

        {comissoesArray.length === 0 ? (
          <p className="text-sm text-fg-subtle py-6 text-center">Nenhum atendimento registrado no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-fg-dim border-b border-border/60">
                  <th className="py-2 text-left w-8">#</th>
                  <th className="py-2 text-left">Profissional</th>
                  <th className="py-2 text-right">Atend.</th>
                  <th className="py-2 text-right">Faturamento</th>
                  <th className="py-2 text-right">Comissão (R$)</th>
                  <th className="py-2 text-right">Despesas</th>
                  <th className="py-2 text-right">Vales</th>
                  <th className="py-2 text-right">Saldo</th>
                  <th className="py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {comissoesArray.map((c, i) => (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-bg-elevated transition-colors">
                    <td className="py-3 text-fg-dim">{i + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gold/20 text-gold text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-fg font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-fg-muted">{c.atend}</td>
                    <td className="py-3 text-right text-fg">{formatCurrency(c.vendas)}</td>
                    <td className="py-3 text-right text-gold font-semibold">{formatCurrency(c.commission)}</td>
                    <td className="py-3 text-right text-fg-muted">—</td>
                    <td className="py-3 text-right text-fg-muted">—</td>
                    <td className="py-3 text-right font-semibold text-fg">{formatCurrency(c.commission)}</td>
                    <td className="py-3 text-right">
                      <CommissionPayButton
                        staffId={c.id}
                        staffName={c.name}
                        amount={c.commission}
                        fromDate={fromStr}
                        toDate={toStr}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* HISTÓRICO DE PAGAMENTOS DE COMISSÃO */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gold" />
          <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Histórico de Pagamentos de Comissão
          </h2>
        </div>

        {payoutHistory.length === 0 ? (
          <p className="text-sm text-fg-subtle py-6 text-center">
            Nenhum pagamento registrado ainda. Clique em &quot;Pagar&quot; para registrar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-fg-dim border-b border-border/60">
                  <th className="py-2 text-left">Profissional</th>
                  <th className="py-2 text-left">Período</th>
                  <th className="py-2 text-right">Comissões</th>
                  <th className="py-2 text-right">Vales</th>
                  <th className="py-2 text-right">Despesas</th>
                  <th className="py-2 text-right text-success">Valor pago</th>
                  <th className="py-2 text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {payoutHistory.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-bg-elevated transition-colors">
                    <td className="py-3 text-fg">{p.staff?.display_name ?? '—'}</td>
                    <td className="py-3 text-fg-muted">
                      {fmtDate(p.period_start)} — {fmtDate(p.period_end)}
                    </td>
                    <td className="py-3 text-right text-gold font-semibold">{formatCurrency(Number(p.amount_paid ?? 0))}</td>
                    <td className="py-3 text-right text-fg-muted">—</td>
                    <td className="py-3 text-right text-fg-muted">—</td>
                    <td className="py-3 text-right text-success font-semibold">{formatCurrency(Number(p.amount_paid ?? 0))}</td>
                    <td className="py-3 text-right text-fg-muted">{fmtDate(p.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* GRID: Fluxo de caixa + Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-gold" />
            <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Fluxo de Caixa</h2>
          </div>
          {paymentsArray.length === 0 ? (
            <p className="text-sm text-fg-subtle py-8 text-center">Nenhum pagamento registrado no período.</p>
          ) : (
            <div className="space-y-3">
              {paymentsArray.map((p) => (
                <div key={p.method} className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60">
                  <div>
                    <p className="text-sm font-medium text-fg">{methodLabel(p.method)}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {p.count} {p.count === 1 ? 'transação' : 'transações'}
                      {p.fees > 0 && ` · Taxas: ${formatCurrency(p.fees)}`}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-fg">{formatCurrency(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-fg mb-4" style={{ fontFamily: 'var(--font-playfair), serif' }}>Mix de Vendas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-fg-dim">Serviços</p>
              <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>{formatCurrency(totalServicos)}</p>
              <p className="text-[11px] text-fg-subtle mt-1">
                {faturamentoBruto > 0 ? `${((totalServicos / faturamentoBruto) * 100).toFixed(1)}% do mix` : '—'}
              </p>
            </div>
            <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-fg-dim">Produtos</p>
              <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>{formatCurrency(totalProdutos)}</p>
              <p className="text-[11px] text-fg-subtle mt-1">
                {faturamentoBruto > 0 ? `${((totalProdutos / faturamentoBruto) * 100).toFixed(1)}% do mix` : '—'}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ÚLTIMAS VENDAS */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-gold" />
          <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Últimas vendas do período</h2>
        </div>
        {comandas.length === 0 ? (
          <p className="text-sm text-fg-subtle py-8 text-center">Nenhuma comanda fechada no período.</p>
        ) : (
          <div className="space-y-2">
            {comandas.slice(0, 10).map((c) => {
              const closedDate = c.closed_at ? new Date(c.closed_at as string) : null;
              const dateStr = closedDate
                ? closedDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';
              return (
                <Link key={c.id} href={`/admin/comandas/${c.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60 hover:border-gold/40 transition-colors">
                  <div>
                    <p className="text-xs text-fg-subtle">{dateStr}</p>
                    <p className="text-sm text-fg-muted">{staffMap.get(c.staff_id as string) ?? '—'}</p>
                  </div>
                  <p className="text-lg font-bold text-gold">{formatCurrency(Number(c.total ?? 0))}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
