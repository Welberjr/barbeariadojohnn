'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, Trash2, Plus, Minus } from 'lucide-react';
import Link from 'next/link';

import {
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from '../actions';
import type { ProductFormData } from '../actions';

const productSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  cost_price: z.number().min(0, 'Custo >= 0'),
  sale_price: z.number().min(0, 'Preço >= 0'),
  default_commission_percent: z.number().min(0).max(100),
  stock_current: z.number().min(0),
  stock_minimum: z.number().min(0),
  is_sellable: z.boolean(),
  active: z.boolean(),
});

type ProductFormSchema = z.infer<typeof productSchema>;

interface Category {
  id: string;
  name: string;
}

interface ProductFormProps {
  productId?: string;
  defaultValues?: Partial<ProductFormData>;
  categories?: Category[];
}

export function ProductForm({
  productId,
  defaultValues,
  categories = [],
}: ProductFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProductFormSchema>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      brand: defaultValues?.brand ?? '',
      description: defaultValues?.description ?? '',
      sku: defaultValues?.sku ?? '',
      barcode: defaultValues?.barcode ?? '',
      category_id: defaultValues?.category_id ?? '',
      photo_url: defaultValues?.photo_url ?? '',
      cost_price: defaultValues?.cost_price ?? 0,
      sale_price: defaultValues?.sale_price ?? 0,
      default_commission_percent:
        defaultValues?.default_commission_percent ?? 10,
      stock_current: defaultValues?.stock_current ?? 0,
      stock_minimum: defaultValues?.stock_minimum ?? 5,
      is_sellable: defaultValues?.is_sellable ?? true,
      active: defaultValues?.active ?? true,
    },
  });

  const costPrice = watch('cost_price') ?? 0;
  const salePrice = watch('sale_price') ?? 0;
  const margem = costPrice > 0 ? ((salePrice - costPrice) / costPrice) * 100 : 0;
  const lucroPorUnidade = salePrice - costPrice;

  async function onSubmit(data: ProductFormSchema) {
    setIsLoading(true);
    try {
      const result = productId
        ? await updateProduct(productId, data as ProductFormData)
        : await createProduct(data as ProductFormData);

      if (result.ok) {
        toast.success(
          productId
            ? 'Produto atualizado com sucesso!'
            : 'Produto cadastrado com sucesso!'
        );
        router.push('/admin/produtos');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!productId) return;
    if (
      !confirm(
        'Desativar este produto? Ele não aparecerá mais nas vendas, mas o histórico será preservado.'
      )
    )
      return;
    setIsDeleting(true);
    const result = await deleteProduct(productId);
    if (result.ok) {
      toast.success('Produto desativado.');
      router.push('/admin/produtos');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao desativar.');
      setIsDeleting(false);
    }
  }

  async function handleAdjustStock(delta: number) {
    if (!productId) return;
    setIsAdjusting(true);
    const result = await adjustStock(productId, delta);
    if (result.ok) {
      toast.success(
        delta > 0
          ? `+${delta} adicionado ao estoque (novo: ${result.new_stock})`
          : `${delta} removido do estoque (novo: ${result.new_stock})`
      );
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao ajustar estoque.');
    }
    setIsAdjusting(false);
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* HEADER */}
      <div>
        <Link
          href="/admin/produtos"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para produtos</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {productId ? 'Editar' : 'Adicionar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {productId ? 'Editar Produto' : 'Novo Produto'}
        </h1>
      </div>

      <div className="divider-gold" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DADOS BÁSICOS */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Informações do Produto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome do produto *</label>
              <input
                type="text"
                placeholder="Ex: Pomada modeladora efeito matte"
                className="input"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-danger mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Marca</label>
              <input
                type="text"
                placeholder="Ex: Don Alcides"
                className="input"
                {...register('brand')}
              />
            </div>

            <div>
              <label className="label">Categoria</label>
              <select className="input" {...register('category_id')}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">SKU / Código interno</label>
              <input
                type="text"
                placeholder="Ex: POM-MAT-001"
                className="input"
                {...register('sku')}
              />
            </div>

            <div>
              <label className="label">Código de barras</label>
              <input
                type="text"
                placeholder="Ex: 7891234567890"
                className="input"
                {...register('barcode')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Descrição</label>
              <textarea
                rows={2}
                placeholder="Descrição opcional para o catálogo..."
                className="input resize-none"
                {...register('description')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">URL da foto</label>
              <input
                type="url"
                placeholder="https://..."
                className="input"
                {...register('photo_url')}
              />
            </div>
          </div>
        </section>

        {/* PREÇO */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Preço e Margem
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input"
                {...register('cost_price', { valueAsNumber: true })}
              />
            </div>

            <div>
              <label className="label">Preço de venda (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input"
                {...register('sale_price', { valueAsNumber: true })}
              />
              {errors.sale_price && (
                <p className="text-xs text-danger mt-1">
                  {errors.sale_price.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Comissão do vendedor (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="10"
                className="input"
                {...register('default_commission_percent', {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>

          {costPrice > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                  Lucro por unidade
                </p>
                <p
                  className={`text-lg font-bold ${
                    lucroPorUnidade >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  R$ {lucroPorUnidade.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                  Margem
                </p>
                <p
                  className={`text-lg font-bold ${
                    margem >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {margem.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ESTOQUE */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Estoque
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Estoque atual</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="input"
                {...register('stock_current', { valueAsNumber: true })}
              />
            </div>

            <div>
              <label className="label">Estoque mínimo (alerta)</label>
              <input
                type="number"
                min="0"
                placeholder="5"
                className="input"
                {...register('stock_minimum', { valueAsNumber: true })}
              />
            </div>
          </div>

          {productId && (
            <div className="pt-3 border-t border-border/60">
              <p className="text-[11px] text-fg-subtle mb-3">
                Ajuste rápido de estoque (entrada/saída):
              </p>
              <div className="flex flex-wrap gap-2">
                {[+10, +5, +1, -1, -5, -10].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    disabled={isAdjusting}
                    onClick={() => handleAdjustStock(delta)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${
                      delta > 0
                        ? 'border-success/30 text-success hover:bg-success/10'
                        : 'border-danger/30 text-danger hover:bg-danger/10'
                    }`}
                  >
                    {delta > 0 ? (
                      <Plus className="w-3 h-3" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    {Math.abs(delta)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* OPÇÕES */}
        <section className="card p-6 space-y-3">
          <h2
            className="text-lg font-semibold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Opções
          </h2>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              {...register('is_sellable')}
            />
            <div>
              <p className="text-sm text-fg font-medium">
                Disponível para venda
              </p>
              <p className="text-[11px] text-fg-subtle">
                Aparece nas comandas para venda balcão.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              {...register('active')}
            />
            <div>
              <p className="text-sm text-fg font-medium">Produto ativo</p>
              <p className="text-[11px] text-fg-subtle">
                Produtos inativos ficam ocultos do catálogo.
              </p>
            </div>
          </label>
        </section>

        {/* AÇÕES */}
        <div className="flex items-center justify-between gap-3">
          <div>
            {productId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 text-sm text-danger hover:bg-danger/10 px-3 py-2 rounded-md transition-colors"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Desativar produto</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/produtos" className="btn-secondary">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold-shimmer flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    {productId ? 'Salvar alterações' : 'Adicionar produto'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
