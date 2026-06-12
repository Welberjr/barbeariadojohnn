'use client';

import { useConfirm } from '@/components/confirm-dialog';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Pencil,
  Percent,
  Copy,
  Trash2,
  ShoppingCart,
  Loader2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { registerSale, deactivateProductAction, duplicateProductAction } from '../actions';

interface Product {
  id: string;
  name: string;
  brand: string | null;
  category_name: string;
  sale_price: number;
  cost_price: number;
  stock_current: number;
  stock_minimum: number;
  active: boolean;
  is_sellable: boolean;
}

interface ProductsTableProps {
  products: Product[];
  categories: string[];
}

export function ProductsTable({ products, categories }: ProductsTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal registrar venda
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const confirmDialog = useConfirm();

  async function handleDuplicate(p: Product) {
    setDuplicatingId(p.id);
    const result = await duplicateProductAction(p.id);
    setDuplicatingId(null);
    if (result.ok && result.id) {
      toast.success('Produto duplicado! Ajuste os dados da cópia.');
      router.push(`/admin/produtos/${result.id}`);
    } else {
      toast.error(result.error ?? 'Erro ao duplicar');
    }
  }

  const [saleModal, setSaleModal] = useState<Product | null>(null);
  const [saleQty, setSaleQty] = useState(1);
  const [savingSale, setSavingSale] = useState(false);

  const filtered = products.filter((p) => {
    const matchQ = query
      ? p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.brand ?? '').toLowerCase().includes(query.toLowerCase()) ||
        p.category_name.toLowerCase().includes(query.toLowerCase())
      : true;
    const matchCat =
      categoryFilter === 'all' || p.category_name === categoryFilter;
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'ativo'
        ? p.active
        : !p.active;
    return matchQ && matchCat && matchStatus;
  });

  // Paginacao client-side: 10 por pagina
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, statusFilter]);

  async function handleDelete(id: string, name: string) {
    if (!(await confirmDialog({ title: `Desativar "${name}"?`, danger: true }))) return;
    const res = await deactivateProductAction(id);
    if (res.ok) {
      toast.success('Produto desativado');
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? 'Erro');
    }
  }

  async function handleRegisterSale() {
    if (!saleModal || saleQty < 1) return;
    setSavingSale(true);
    const res = await registerSale(saleModal.id, saleQty);
    setSavingSale(false);
    if (res.ok) {
      toast.success(`Venda registrada! Estoque: ${res.new_stock}`);
      setSaleModal(null);
      setSaleQty(1);
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? 'Erro ao registrar venda');
    }
  }

  return (
    <div className="space-y-4">
      {/* FILTROS */}
      <div className="card p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            type="text"
            placeholder="Buscar por nome, categoria ou marca..."
            className="input pl-10 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input text-sm py-2 w-full sm:w-44"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Todas Categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="input text-sm py-2 w-full sm:w-36"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos Status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* TABELA */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-fg-muted text-sm">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border/60 text-[10px] uppercase tracking-wider text-fg-dim">
            <span>Nome</span>
            <span>Categoria</span>
            <span>Marca</span>
            <span>Preço</span>
            <span>Custo</span>
            <span>Estoque</span>
            <span>Status / Ações</span>
          </div>

          {paged.map((p, idx) => {
            const baixo = p.active && p.stock_current <= p.stock_minimum;
            const esgotado = p.active && p.stock_current === 0;
            return (
              <div
                key={p.id}
                className={cn(
                  'grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center',
                  idx !== paged.length - 1 && 'border-b border-border/40',
                  !p.active && 'opacity-50'
                )}
              >
                <p className="text-sm text-fg font-medium">{p.name}</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-bg-elevated border border-border text-fg-muted w-fit">
                  {p.category_name || '—'}
                </span>
                <p className="text-sm text-fg-muted">{p.brand || '—'}</p>
                <p className="text-sm font-semibold text-fg">
                  {formatCurrency(p.sale_price)}
                </p>
                <p className="text-sm text-fg-muted">
                  {p.cost_price > 0 ? formatCurrency(p.cost_price) : '—'}
                </p>
                <p className={cn(
                  'text-sm font-semibold',
                  esgotado ? 'text-danger' : baixo ? 'text-warning' : 'text-fg'
                )}>
                  {p.stock_current}
                  {esgotado && <span className="ml-1 text-[9px]">ESGOTADO</span>}
                  {baixo && !esgotado && <span className="ml-1 text-[9px]">BAIXO</span>}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                    p.active
                      ? 'bg-success/10 text-success border border-success/30'
                      : 'bg-fg-dim/10 text-fg-subtle border border-border'
                  )}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button
                    type="button"
                    title="Registrar venda"
                    disabled={!p.active || !p.is_sellable || esgotado}
                    onClick={() => { setSaleModal(p); setSaleQty(1); }}
                    className="p-1.5 rounded-md text-fg-subtle hover:text-success hover:bg-success/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Percent className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Duplicar produto"
                    disabled={duplicatingId === p.id}
                    onClick={() => handleDuplicate(p)}
                    className="p-1.5 rounded-md text-fg-subtle hover:text-info hover:bg-info/10 transition-colors disabled:opacity-40"
                  >
                    {duplicatingId === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Link
                    href={`/admin/produtos/${p.id}`}
                    title="Editar"
                    className="p-1.5 rounded-md text-fg-subtle hover:text-gold hover:bg-gold/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    title="Desativar"
                    onClick={() => handleDelete(p.id, p.name)}
                    className="p-1.5 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
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
                Página {safePage} de {totalPages} · {filtered.length} produtos
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
        </div>
      )}

      {/* MODAL REGISTRAR VENDA */}
      {saleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card-premium p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Registrar Venda
              </h3>
              <button type="button" onClick={() => setSaleModal(null)} className="text-fg-subtle hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-fg">{saleModal.name}</p>
            <p className="text-[11px] text-fg-muted">
              Estoque atual: <strong>{saleModal.stock_current}</strong> unidades ·{' '}
              {formatCurrency(saleModal.sale_price)} por unidade
            </p>
            <div>
              <label className="label">Quantidade</label>
              <input
                type="number"
                min="1"
                max={saleModal.stock_current}
                className="input"
                value={saleQty}
                onChange={(e) => setSaleQty(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-fg-muted">Total:</p>
              <p className="text-xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {formatCurrency(saleQty * saleModal.sale_price)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRegisterSale}
              disabled={savingSale}
              className="btn-gold-shimmer w-full flex items-center justify-center gap-2"
            >
              {savingSale ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Confirmar venda</span>
            </button>
          </div>
        </div>
      )}

      <div className="text-[11px] text-fg-dim flex items-center gap-1.5">
        <ShoppingCart className="w-3 h-3" />
        <span>Use o ícone % para registrar vendas avulsas (sem comanda)</span>
      </div>
    </div>
  );
}
