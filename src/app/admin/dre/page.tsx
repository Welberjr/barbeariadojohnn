import { createClient } from '@/lib/supabase/server';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Receipt,
  Users,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'DRE — Demonstrativo de Resultados',
};

interface DREPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function DREPage({ searchParams }: DREPageProps) {
  const { from: fromParam, to: toParam } = await searchParams;
  const supabase = await createClient();

  // Período default: mês corrente
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const fromDate = fromParam ? new Date(fromParam + 'T00:00:00') : firstOfMonth;
  const toDate = toParam ? new Date(toParam + 'T23:59:59') : lastOfMonth;

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];
  const periodStart = `${fromStr}T00:00:00.000-03:00`;
  const periodEnd = `${toStr}T23:59:59.999-03:00`;

  // 1. RECEITAS — comandas fechadas no período
  const { data: comandasRaw } = await supabase
    .from('comandas')
    .select('id, total, net_total, card_fee_total')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'closed')
    .gte('closed_at', periodStart)
    .lte('closed_at', periodEnd);

  const comandas = comandasRaw ?? [];
  const comandaIds = comandas.map((c) => c.id);

  const receitaBruta = comandas.reduce(
    (s, c) => s + Number(c.total ?? 0),
    0
  );
  const totalTaxasCartao = comandas.reduce(
    (s, c) => s + Number(c.card_fee_total ?? 0),
    0
  );
  const receitaLiquida = comandas.reduce(
    (s, c) => s + Number(c.net_total ?? c.total ?? 0),
    0
  );

  // 2. ITENS — comissões e custos de produtos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = [];
  if (comandaIds.length > 0) {
    const { data: itemsRaw } = await supabase
      .from('comanda_items')
      .select(
        'comanda_id, item_type, total_price, commission_value, product_id, quantity'
      )
      .in('comanda_id', comandaIds);
    items = itemsRaw ?? [];
  }

  const totalServicos = items
    .filter((i) => i.item_type === 'service')
    .reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  const totalProdutosVendidos = items
    .filter((i) => i.item_type === 'product')
    .reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  const totalComissoes = items.reduce(
    (s, i) => s + Number(i.commission_value ?? 0),
    0
  );

  // 3. Custo dos produtos vendidos (COGS)
  const productIds = items
    .filter((i) => i.item_type === 'product' && i.product_id)
    .map((i) => i.product_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let custoProdutosVendidos = 0;
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, cost_price')
      .in('id', productIds);

    const costMap = new Map(
      (products ?? []).map((p) => [p.id, Number(p.cost_price ?? 0)])
    );

    for (const it of items) {
      if (it.item_type === 'product' && it.product_id) {
        const cost = costMap.get(it.product_id) ?? 0;
        custoProdutosVendidos += cost * Number(it.quantity ?? 0);
      }
    }
  }

  // 4. DESPESAS — bills pagas no período
  const { data: billsRaw } = await supabase
    .from('bills')
    .select('amount, paid_amount, paid_at, category_id, description')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'paid')
    .gte('paid_at', periodStart)
    .lte('paid_at', periodEnd);

  const bills = billsRaw ?? [];
  const totalDespesas = bills.reduce(
    (s, b) => s + Number(b.paid_amount ?? b.amount ?? 0),
    0
  );

  // Agrupa despesas por categoria
  const { data: categoriesRaw } = await supabase
    .from('expense_categories')
    .select('id, name, color')
    .eq('barbershop_id', BARBERSHOP_ID);
  const categoryMap = new Map(
    (categoriesRaw ?? []).map((c) => [
      c.id as string,
      { name: c.name as string, color: c.color as string | null },
    ])
  );

  const despesasPorCategoria = new Map<string, { name: string; color: string | null; total: number; count: number }>();
  for (const b of bills) {
    const cid = (b.category_id as string) ?? 'sem-categoria';
    const cat = b.category_id
      ? categoryMap.get(b.category_id as string)
      : null;
    const current =
      despesasPorCategoria.get(cid) ?? {
        name: cat?.name ?? 'Sem categoria',
        color: cat?.color ?? null,
        total: 0,
        count: 0,
      };
    current.total += Number(b.paid_amount ?? b.amount ?? 0);
    current.count += 1;
    despesasPorCategoria.set(cid, current);
  }

  const despesasArr = Array.from(despesasPorCategoria.values()).sort(
    (a, b) => b.total - a.total
  );

  // 5. CÁLCULOS FINAIS DRE
  const margemBruta = receitaLiquida - custoProdutosVendidos - totalComissoes;
  const lucroLiquido = margemBruta - totalDespesas;
  const margemLiquidaPct =
    receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
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
            DRE — Demonstrativo de Resultados
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Receitas, custos, despesas e lucro do período.
          </p>
        </div>

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

      {/* ATALHOS */}
      <div className="flex flex-wrap gap-2">
        {(() => {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
            .toISOString()
            .split('T')[0];
          const sevenAgo = new Date(today.getTime() - 6 * 86400000)
            .toISOString()
            .split('T')[0];
          const thirtyAgo = new Date(today.getTime() - 29 * 86400000)
            .toISOString()
            .split('T')[0];
          const firstOfLastMonth = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            1
          )
            .toISOString()
            .split('T')[0];
          const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
            .toISOString()
            .split('T')[0];

          const presets = [
            { label: '7 dias', from: sevenAgo, to: todayStr },
            { label: '30 dias', from: thirtyAgo, to: todayStr },
            { label: 'Este mês', from: firstDay, to: todayStr },
            { label: 'Mês passado', from: firstOfLastMonth, to: lastOfLastMonth },
          ];
          return presets.map((p) => (
            <Link
              key={p.label}
              href={`/admin/dre?from=${p.from}&to=${p.to}`}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-gold/40 hover:text-gold transition-colors text-fg-muted"
            >
              {p.label}
            </Link>
          ));
        })()}
      </div>

      {/* KPIs RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Receita Bruta
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(receitaBruta)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-danger/10 text-danger">
              <TrendingDown className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Custos + Despesas
            </p>
          </div>
          <p
            className="text-2xl font-bold text-danger"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(
              custoProdutosVendidos +
                totalComissoes +
                totalTaxasCartao +
                totalDespesas
            )}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-md ${
                lucroLiquido >= 0
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              <CircleDollarSign className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Lucro Líquido
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${
              lucroLiquido >= 0 ? 'text-success' : 'text-danger'
            }`}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(lucroLiquido)}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            Margem líquida: {margemLiquidaPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* DRE ESTRUTURADO */}
      <section className="card p-6">
        <h2
          className="text-lg font-semibold text-fg mb-4 flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <FileText className="w-4 h-4 text-gold" />
          DRE Detalhado
        </h2>

        <div className="space-y-1">
          {/* Receita Bruta */}
          <DRELine
            label="(=) Receita Bruta"
            value={receitaBruta}
            bold
            color="gold"
          />
          <DRELineSub label="Serviços" value={totalServicos} />
          <DRELineSub label="Produtos" value={totalProdutosVendidos} />

          <DRESeparator />

          {/* Deduções */}
          <DRELine
            label="(−) Taxas de cartão"
            value={-totalTaxasCartao}
            color="danger"
          />

          <DRELine
            label="(=) Receita Líquida"
            value={receitaLiquida}
            bold
            color="gold"
          />

          <DRESeparator />

          {/* Custos */}
          <DRELine
            label="(−) Custo dos produtos vendidos"
            value={-custoProdutosVendidos}
            color="danger"
          />
          <DRELine
            label="(−) Comissões pagas"
            value={-totalComissoes}
            color="danger"
          />

          <DRELine
            label="(=) Margem Bruta"
            value={margemBruta}
            bold
            color={margemBruta >= 0 ? 'success' : 'danger'}
          />

          <DRESeparator />

          {/* Despesas operacionais */}
          <DRELine
            label="(−) Despesas operacionais"
            value={-totalDespesas}
            color="danger"
          />
          {despesasArr.map((d) => (
            <DRELineSub
              key={d.name}
              label={d.name}
              value={-d.total}
              extra={`(${d.count} ${d.count === 1 ? 'conta' : 'contas'})`}
            />
          ))}

          <DRESeparator />

          {/* Lucro líquido */}
          <DRELine
            label="(=) LUCRO LÍQUIDO"
            value={lucroLiquido}
            bold
            color={lucroLiquido >= 0 ? 'success' : 'danger'}
            highlight
          />
        </div>
      </section>

      {/* DESPESAS POR CATEGORIA */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Despesas por Categoria
          </h2>
        </div>

        {despesasArr.length === 0 ? (
          <p className="text-sm text-fg-subtle py-4 text-center">
            Nenhuma despesa paga no período.
          </p>
        ) : (
          <div className="space-y-2">
            {despesasArr.map((d) => {
              const pct =
                totalDespesas > 0 ? (d.total / totalDespesas) * 100 : 0;
              return (
                <div
                  key={d.name}
                  className="p-3 rounded-md bg-bg-elevated border border-border/60"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: d.color ?? '#9CA3AF' }}
                      />
                      <p className="text-sm text-fg font-medium truncate">
                        {d.name}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-danger flex-shrink-0">
                      {formatCurrency(d.total)}
                    </p>
                  </div>
                  <div className="w-full h-1 bg-bg-deep rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-danger/50"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-fg-subtle mt-1">
                    {pct.toFixed(1)}% do total de despesas · {d.count}{' '}
                    {d.count === 1 ? 'lançamento' : 'lançamentos'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MIX DE RECEITAS */}
      <section className="card p-6">
        <h2
          className="text-lg font-semibold text-fg mb-4"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Composição da Receita
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-info" />
              <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                Serviços
              </p>
            </div>
            <p
              className="text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {formatCurrency(totalServicos)}
            </p>
            <p className="text-[11px] text-fg-subtle mt-1">
              {receitaBruta > 0
                ? `${((totalServicos / receitaBruta) * 100).toFixed(1)}%`
                : '—'}{' '}
              da receita
            </p>
          </div>
          <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-info" />
              <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                Produtos
              </p>
            </div>
            <p
              className="text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {formatCurrency(totalProdutosVendidos)}
            </p>
            <p className="text-[11px] text-fg-subtle mt-1">
              {receitaBruta > 0
                ? `${((totalProdutosVendidos / receitaBruta) * 100).toFixed(1)}%`
                : '—'}{' '}
              da receita
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// COMPONENTES AUXILIARES DO DRE
// ============================================================================

interface DRELineProps {
  label: string;
  value: number;
  bold?: boolean;
  color?: 'gold' | 'success' | 'danger' | 'fg';
  highlight?: boolean;
}

function DRELine({ label, value, bold, color = 'fg', highlight }: DRELineProps) {
  const colorClass = {
    gold: 'text-gold',
    success: 'text-success',
    danger: 'text-danger',
    fg: 'text-fg',
  }[color];

  return (
    <div
      className={`flex items-center justify-between gap-3 py-2 px-3 rounded-md ${
        highlight ? 'bg-gold/10 border border-gold/30' : ''
      }`}
    >
      <p
        className={`text-sm ${
          bold ? 'font-bold' : 'font-normal'
        } ${colorClass}`}
      >
        {label}
      </p>
      <p
        className={`${bold ? 'text-lg font-bold' : 'text-sm font-medium'} ${colorClass}`}
        style={bold ? { fontFamily: 'var(--font-playfair), serif' } : undefined}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function DRELineSub({
  label,
  value,
  extra,
}: {
  label: string;
  value: number;
  extra?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 px-3 pl-8 text-fg-muted">
      <p className="text-xs">
        {label}
        {extra && (
          <span className="text-fg-subtle ml-1 text-[10px]">{extra}</span>
        )}
      </p>
      <p className="text-xs">{formatCurrency(value)}</p>
    </div>
  );
}

function DRESeparator() {
  return <div className="h-px bg-border/40 my-2 mx-3" />;
}
