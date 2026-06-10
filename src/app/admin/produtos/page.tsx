import { createClient } from '@/lib/supabase/server';
import { Plus, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { ProductsTable } from './_components/products-table';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = { title: 'Produtos' };

interface ProdutosPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function ProdutosPage({ searchParams }: ProdutosPageProps) {
  const { period } = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStr = period ?? `${year}-${String(month + 1).padStart(2, '0')}`;
  const [y, m] = monthStr.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1).toISOString();
  const lastDay = new Date(y, m, 0, 23, 59, 59).toISOString();

  const [{ data: productsRaw }, { data: categoriesRaw }, { data: salesRaw }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, brand, sale_price, cost_price, stock_current, stock_minimum, is_sellable, active, category_id')
        .eq('barbershop_id', BARBERSHOP_ID)
        .order('name'),
      supabase
        .from('product_categories')
        .select('id, name')
        .eq('barbershop_id', BARBERSHOP_ID)
        .order('name'),
      supabase
        .from('transactions')
        .select('amount')
        .eq('barbershop_id', BARBERSHOP_ID)
        .eq('type', 'product')
        .gte('occurred_at', firstDay)
        .lte('occurred_at', lastDay),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (productsRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats = (categoriesRaw ?? []) as any[];
  const catMap = new Map(cats.map((c) => [c.id as string, c.name as string]));

  const totalAtivos = products.filter((p) => p.active).length;
  const valorEstoque = products.reduce(
    (s, p) => s + (p.active ? Number(p.cost_price ?? 0) * Number(p.stock_current ?? 0) : 0),
    0
  );
  const estoqueBaixo = products.filter(
    (p) => p.active && Number(p.stock_current) <= Number(p.stock_minimum)
  ).length;
  const vendasMes = (salesRaw ?? []).reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const lucroMes = vendasMes; // custo pode ser adicionado futuramente

  const allCategoryNames = Array.from(
    new Set(
      products.map((p) =>
        p.category_id ? catMap.get(p.category_id) ?? 'Sem categoria' : 'Sem categoria'
      )
    )
  ).sort();

  const tableProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    category_name: p.category_id
      ? catMap.get(p.category_id) ?? 'Sem categoria'
      : 'Sem categoria',
    sale_price: Number(p.sale_price ?? 0),
    cost_price: Number(p.cost_price ?? 0),
    stock_current: Number(p.stock_current ?? 0),
    stock_minimum: Number(p.stock_minimum ?? 0),
    active: p.active,
    is_sellable: p.is_sellable,
  }));

  const monthLabel = new Date(y, m - 1).toLocaleString('pt-BR', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Operação
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Gestão de Produtos
          </h1>
          <p className="text-sm text-fg-muted mt-2">Controle de estoque e vendas</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/produtos/novo" className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </Link>
          <Link href="/admin/produtos" className="btn-gold-shimmer flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span>Registrar Venda</span>
          </Link>
        </div>
      </div>

      <div className="divider-gold" />

      {/* PERÍODO */}
      <div className="flex items-center gap-2">
        <p className="text-xs text-fg-muted uppercase tracking-wider">Período:</p>
        <select
          className="input text-sm py-1.5 w-40"
          defaultValue={monthStr}
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
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-5">
          <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">
            Produtos ativos
          </p>
          <p
            className="text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalAtivos}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">
            {products.length} cadastrados no total
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">
            Valor em estoque
          </p>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(valorEstoque)}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">Soma preço × estoque (ativos)</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">
            Estoque baixo
          </p>
          <p
            className={`text-3xl font-bold ${estoqueBaixo > 0 ? 'text-danger' : 'text-fg'}`}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {estoqueBaixo}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">
            {estoqueBaixo > 0 ? 'Produtos abaixo do mínimo' : 'Tudo em estoque'}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">
            Vendas {monthLabel}
          </p>
          <p
            className="text-2xl font-bold text-info"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(vendasMes)}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">Faturamento em produtos</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">
            Lucro {monthLabel}
          </p>
          <p
            className="text-2xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(lucroMes)}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">Vendas − custo dos produtos</p>
        </div>
      </div>

      {/* TABELA */}
      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-fg-muted text-sm mb-4">Nenhum produto cadastrado.</p>
          <Link
            href="/admin/produtos/novo"
            className="btn-gold-shimmer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar primeiro produto</span>
          </Link>
        </div>
      ) : (
        <ProductsTable products={tableProducts} categories={allCategoryNames} />
      )}
    </div>
  );
}
