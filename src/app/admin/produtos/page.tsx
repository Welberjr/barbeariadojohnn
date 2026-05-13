import { createClient } from '@/lib/supabase/server';
import {
  Plus,
  Package,
  AlertCircle,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Produtos',
};

interface Product {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  sale_price: number;
  cost_price: number;
  stock_current: number;
  stock_minimum: number;
  is_sellable: boolean;
  active: boolean;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default async function ProdutosPage() {
  const supabase = await createClient();

  const { data: productsRaw } = await supabase
    .from('products')
    .select(
      'id, name, brand, sku, sale_price, cost_price, stock_current, stock_minimum, is_sellable, active, category_id'
    )
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('name');

  const products = (productsRaw ?? []) as Product[];

  // Categorias (se a tabela existir; falha silenciosamente)
  const { data: categoriesRaw } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('name');

  const categories = (categoriesRaw ?? []) as Category[];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Agrupar por categoria
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const catName = p.category_id
      ? categoryMap.get(p.category_id) ?? 'Sem categoria'
      : 'Sem categoria';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(p);
    return acc;
  }, {});

  // Stats
  const totalAtivos = products.filter((p) => p.active).length;
  const estoqueBaixo = products.filter(
    (p) => p.active && p.stock_current <= p.stock_minimum
  ).length;
  const valorEstoque = products.reduce(
    (sum, p) =>
      sum + (p.active ? Number(p.cost_price) * p.stock_current : 0),
    0
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
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
            Produtos
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Catálogo de produtos para venda e controle de estoque.
          </p>
        </div>

        <Link
          href="/admin/produtos/novo"
          className="btn-gold-shimmer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar produto</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Package className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Total
            </p>
          </div>
          <p
            className="text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {products.length}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Ativos
            </p>
          </div>
          <p
            className="text-3xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalAtivos}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-md ${
                estoqueBaixo > 0
                  ? 'bg-danger/10 text-danger'
                  : 'bg-info/10 text-info'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Estoque baixo
            </p>
          </div>
          <p
            className={`text-3xl font-bold ${
              estoqueBaixo > 0 ? 'text-danger' : 'text-fg'
            }`}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {estoqueBaixo}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Valor em estoque
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(valorEstoque)}
          </p>
        </div>
      </div>

      {/* LISTA POR CATEGORIA */}
      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
            <Package className="w-6 h-6" />
          </div>
          <h2
            className="text-xl font-bold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Nenhum produto cadastrado
          </h2>
          <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
            Cadastre produtos como pomadas, gel, shampoo e outros itens para venda.
          </p>
          <Link
            href="/admin/produtos/novo"
            className="btn-gold-shimmer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar primeiro produto</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([categoryName, items]) => (
            <section key={categoryName}>
              <h2 className="text-sm font-semibold text-gold tracking-wider uppercase mb-3 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold" />
                {categoryName}
                <span className="text-fg-dim font-normal normal-case ml-1">
                  ({items.length})
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p) => {
                  const baixo =
                    p.active && p.stock_current <= p.stock_minimum;
                  const semEstoque = p.active && p.stock_current === 0;
                  return (
                    <Link
                      key={p.id}
                      href={`/admin/produtos/${p.id}`}
                      className={`card card-hover p-4 group ${
                        !p.active ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-fg truncate">
                              {p.name}
                            </h3>
                            {p.brand && (
                              <p className="text-[11px] text-fg-subtle truncate">
                                {p.brand}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60 gap-2">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                            Preço
                          </p>
                          <p
                            className="text-lg font-bold text-gold leading-none"
                            style={{
                              fontFamily: 'var(--font-playfair), serif',
                            }}
                          >
                            {formatCurrency(Number(p.sale_price))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                            Estoque
                          </p>
                          <p
                            className={`text-sm font-semibold ${
                              semEstoque
                                ? 'text-danger'
                                : baixo
                                ? 'text-warning'
                                : 'text-fg'
                            }`}
                          >
                            {p.stock_current}
                            {baixo && (
                              <span className="ml-1 text-[10px] uppercase">
                                {semEstoque ? 'Esgotado' : 'Baixo'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
