import { createAdminClient } from '@/lib/supabase/admin';
import { creditoUsadoNasComandas } from '@/lib/creditos-db';
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
import { InfoTip } from '@/components/info-tip';
import { DrePdfButton } from './_components/dre-pdf-button';
import { RelatorioImpresso } from './_components/relatorio-impresso';

import { lojaAtual } from '@/lib/loja';
export const metadata = {
  title: 'DRE, o demonstrativo de resultados',
};

interface DREPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function DREPage({ searchParams }: DREPageProps) {
  const { from: fromParam, to: toParam } = await searchParams;
  const supabase = createAdminClient();

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

  // Primeira leva: receitas, despesas, lançamentos manuais e categorias não
  // dependem um do outro, então vão juntos ao banco.
  const [{ data: comandasRaw }, { data: billsRaw }, txAttempt, { data: categoriesRaw }] =
    await Promise.all([
      // 1. RECEITAS: comandas fechadas no período
      supabase
        .from('comandas')
        .select('id, total, net_total, card_fee_total')
        .eq('barbershop_id', (await lojaAtual()))
        .eq('status', 'closed')
        .gte('closed_at', periodStart)
        .lte('closed_at', periodEnd),
      // 4. DESPESAS: bills pagas no período
      supabase
        .from('bills')
        .select('amount, paid_amount, paid_at, category_id, description')
        .eq('barbershop_id', (await lojaAtual()))
        .eq('status', 'paid')
        .gte('paid_at', periodStart)
        .lte('paid_at', periodEnd),
      // 4b. Transacoes manuais: tenta ler cost_amount; se a coluna nao
      // existir, o fallback com select basico roda logo abaixo.
      supabase
        .from('transactions')
        .select('type, amount, cost_amount')
        .eq('barbershop_id', (await lojaAtual()))
        .in('type', ['product', 'expense', 'other'])
        .gte('occurred_at', periodStart)
        .lte('occurred_at', periodEnd),
      // Categorias de despesa
      supabase
        .from('expense_categories')
        .select('id, name, color')
        .eq('barbershop_id', (await lojaAtual())),
    ]);

  const comandas = comandasRaw ?? [];
  const comandaIds = comandas.map((c) => c.id);

  // A conta bruta das comandas; o crédito da casa é descontado mais abaixo
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

  // 2. ITENS: comissões e custos de produtos
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

  // Crédito da casa não é faturamento: o serviço foi entregue, mas o pagamento
  // aconteceu antes, fora do caixa (permuta, cortesia, vale). Sai da receita do
  // período para o DRE mostrar só dinheiro que a barbearia recebeu de verdade.
  // A comissão do barbeiro continua na conta: ele trabalhou igual.
  const creditoUsado = await creditoUsadoNasComandas(comandaIds);

  const totalServicos =
    items
      .filter((i) => i.item_type === 'service')
      .reduce((s, i) => s + Number(i.total_price ?? 0), 0) - creditoUsado;

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

  const bills = billsRaw ?? [];
  const totalDespesasBills = bills.reduce(
    (s, b) => s + Number(b.paid_amount ?? b.amount ?? 0),
    0
  );

  // 4b. Transacoes manuais do periodo (lancamentos avulsos do modulo Financeiro)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txRows: any[] = [];
  if (txAttempt.error) {
    const fallback = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('barbershop_id', (await lojaAtual()))
      .in('type', ['product', 'expense', 'other'])
      .gte('occurred_at', periodStart)
      .lte('occurred_at', periodEnd);
    txRows = fallback.data ?? [];
  } else {
    txRows = txAttempt.data ?? [];
  }
  const txProdutos   = txRows.filter((t) => t.type === 'product').reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const txReceitas   = txRows.filter((t) => t.type === 'other').reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const txDespesas   = txRows.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const txCustoProdutos = txRows.filter((t) => t.type === 'product').reduce((s, t) => s + Number(t.cost_amount ?? 0), 0);

  // CPV total = custo via comandas + custo das vendas avulsas
  custoProdutosVendidos += txCustoProdutos;

  const totalDespesas = totalDespesasBills + txDespesas;

  // Agrupa despesas por categoria
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
  // Inclui vendas avulsas de produto e receitas extras nas totalizacoes
  const totalProdutosReal = totalProdutosVendidos + txProdutos;
  const receitaBrutaTotal = receitaBruta - creditoUsado + txProdutos + txReceitas;
  const receitaLiquidaTotal = receitaLiquida - creditoUsado + txProdutos + txReceitas;
  const margemBruta = receitaLiquidaTotal - custoProdutosVendidos - totalComissoes;
  const lucroLiquido = margemBruta - totalDespesas;
  const margemLiquidaPct =
    receitaBrutaTotal > 0 ? (lucroLiquido / receitaBrutaTotal) * 100 : 0;

  // Composicao da receita por origem (base bruta, antes de descontos),
  // garante que as fatias sempre somem 100%.
  const baseComposicao = totalServicos + totalProdutosReal + txReceitas;
  const pctServicos =
    baseComposicao > 0 ? (totalServicos / baseComposicao) * 100 : 0;
  const pctProdutos =
    baseComposicao > 0 ? (totalProdutosReal / baseComposicao) * 100 : 0;
  const pctReceitasExtras =
    baseComposicao > 0 ? (txReceitas / baseComposicao) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* DOCUMENTO IMPRESSO: layout proprio, so aparece no papel */}
      <RelatorioImpresso
        periodoDe={fromStr}
        periodoAte={toStr}
        receitaBruta={receitaBrutaTotal}
        totalServicos={totalServicos}
        totalProdutos={totalProdutosReal}
        receitasExtras={txReceitas}
        taxasCartao={totalTaxasCartao}
        receitaLiquida={receitaLiquidaTotal}
        custoProdutos={custoProdutosVendidos}
        comissoes={totalComissoes}
        margemBruta={margemBruta}
        despesas={totalDespesas}
        lucroLiquido={lucroLiquido}
        margemLiquidaPct={margemLiquidaPct}
        pctServicos={pctServicos}
        pctProdutos={pctProdutos}
        pctReceitasExtras={pctReceitasExtras}
        despesasPorCategoria={despesasArr.map((d) => ({
          name: d.name,
          total: d.total,
          count: d.count,
        }))}
      />

      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4 print:hidden">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Financeiro
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            DRE, o demonstrativo de resultados
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Receitas, custos, despesas e lucro do período.
          </p>
        </div>

        <form className="grid grid-cols-2 sm:flex sm:items-end gap-2 no-print w-full sm:w-auto" method="get">
          <div className="min-w-0">
            <label className="label text-[10px]">De</label>
            <input type="date" name="from" defaultValue={fromStr} className="input py-1.5 text-sm w-full" />
          </div>
          <div className="min-w-0">
            <label className="label text-[10px]">Até</label>
            <input type="date" name="to" defaultValue={toStr} className="input py-1.5 text-sm w-full" />
          </div>
          <button type="submit" className="btn-secondary py-2 text-sm">Aplicar</button>
          <DrePdfButton />
        </form>
      </div>

      <div className="divider-gold" />

      {/* ATALHOS */}
      <div className="no-print flex flex-wrap gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">
              Receita Bruta
              <InfoTip text="Tudo o que entrou no período: serviços, produtos (em comanda e venda avulsa) e receitas extras, antes de qualquer desconto." />
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(receitaBrutaTotal)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-danger/10 text-danger">
              <TrendingDown className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">
              Custos + Despesas
              <InfoTip text="Soma de taxas de cartão, custo dos produtos vendidos, comissões pagas e despesas operacionais (aluguel, contas, fornecedores)." />
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
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">
              Lucro Líquido
              <InfoTip text="O que sobra de verdade no bolso: receita bruta menos todos os custos e despesas do período. Negativo significa prejuízo." />
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
            value={receitaBrutaTotal}
            bold
            color="gold"
          />
          <DRELineSub label="Serviços" value={totalServicos} />
          <DRELineSub label="Produtos (via comanda)" value={totalProdutosVendidos} />
          {txProdutos > 0 && <DRELineSub label="Produtos (venda avulsa)" value={txProdutos} />}
          {txReceitas > 0 && <DRELineSub label="Receitas extras" value={txReceitas} />}
          {creditoUsado > 0 && (
            <p className="flex items-center justify-between py-1 pl-4 text-[11px] text-fg-subtle">
              <span>
                Atendimento pago com crédito da casa (fora da receita)
                <InfoTip text="Serviço entregue e já pago antes, em permuta, cortesia ou vale. O dinheiro não entrou no caixa deste período, por isso não conta como receita. A comissão do barbeiro continua sendo paga normalmente." />
              </span>
              <span>{formatCurrency(creditoUsado)}</span>
            </p>
          )}

          <DRESeparator />

          {/* Deduções */}
          <DRELine
            label="(−) Taxas de cartão"
            value={-totalTaxasCartao}
            color="danger"
          />

          <DRELine
            label="(=) Receita Líquida"
            value={receitaLiquidaTotal}
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
        <div
          className={`grid grid-cols-1 gap-4 print-colunas ${
            txReceitas > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'
          }`}
        >
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
              {baseComposicao > 0 ? `${pctServicos.toFixed(1)}%` : 'sem dados'}{' '}
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
              {formatCurrency(totalProdutosReal)}
            </p>
            <p className="text-[11px] text-fg-subtle mt-1">
              {baseComposicao > 0 ? `${pctProdutos.toFixed(1)}%` : 'sem dados'}{' '}
              da receita
            </p>
          </div>
          {txReceitas > 0 && (
            <div className="p-4 rounded-md bg-bg-elevated border border-border/60">
              <div className="flex items-center gap-2 mb-2">
                <CircleDollarSign className="w-4 h-4 text-info" />
                <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                  Receitas extras
                </p>
              </div>
              <p
                className="text-2xl font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                {formatCurrency(txReceitas)}
              </p>
              <p className="text-[11px] text-fg-subtle mt-1">
                {baseComposicao > 0 ? `${pctReceitasExtras.toFixed(1)}%` : 'sem dados'}{' '}
                da receita
              </p>
            </div>
          )}
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
