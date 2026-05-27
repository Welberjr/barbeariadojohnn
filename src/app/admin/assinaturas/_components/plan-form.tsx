'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { createPlan, updatePlan, deletePlan } from '../actions';
import type { PlanFormData } from '../actions';

const planSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional().nullable(),
  price: z.number().min(0, 'Preço >= 0'),
  billing_cycle: z.string().min(1),
  includes_count: z.number().min(0),
  discount_percent_on_extras: z.number().min(0).max(100),
  active: z.boolean(),
  display_order: z.number().min(0),
});

type PlanFormSchema = z.infer<typeof planSchema>;

interface PlanFormProps {
  planId?: string;
  defaultValues?: Partial<PlanFormData>;
}

export function PlanForm({ planId, defaultValues }: PlanFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlanFormSchema>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      price: defaultValues?.price ?? 0,
      billing_cycle: defaultValues?.billing_cycle ?? 'monthly',
      includes_count: defaultValues?.includes_count ?? 0,
      discount_percent_on_extras:
        defaultValues?.discount_percent_on_extras ?? 0,
      active: defaultValues?.active ?? true,
      display_order: defaultValues?.display_order ?? 0,
    },
  });

  async function onSubmit(data: PlanFormSchema) {
    setIsLoading(true);
    try {
      const payload: PlanFormData = {
        name: data.name,
        description: data.description,
        price: data.price,
        billing_cycle: data.billing_cycle,
        includes_count: data.includes_count,
        discount_percent_on_extras: data.discount_percent_on_extras,
        active: data.active,
        display_order: data.display_order,
        includes_services: [],
      };

      const result = planId
        ? await updatePlan(planId, payload)
        : await createPlan(payload);

      if (result.ok) {
        toast.success(
          planId ? 'Plano atualizado!' : 'Plano criado com sucesso!'
        );
        router.push('/admin/assinaturas');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!planId) return;
    if (
      !confirm(
        'Desativar este plano? Assinantes existentes continuam ativos, mas o plano não poderá ser usado em novas assinaturas.'
      )
    )
      return;
    setIsDeleting(true);
    const result = await deletePlan(planId);
    if (result.ok) {
      toast.success('Plano desativado.');
      router.push('/admin/assinaturas');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao desativar.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <Link
          href="/admin/assinaturas"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para assinaturas</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {planId ? 'Editar' : 'Criar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {planId ? 'Editar Plano' : 'Novo Plano'}
        </h1>
      </div>

      <div className="divider-gold" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Dados do Plano
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome do plano *</label>
              <input
                type="text"
                placeholder='Ex: "Cabelo no Ponto"'
                className="input"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-danger mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label">Descrição</label>
              <textarea
                rows={2}
                placeholder="Ex: 4 cortes por mês com 20% de desconto em produtos."
                className="input resize-none"
                {...register('description')}
              />
            </div>

            <div>
              <label className="label">Preço (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="99.90"
                className="input"
                {...register('price', { valueAsNumber: true })}
              />
              {errors.price && (
                <p className="text-xs text-danger mt-1">
                  {errors.price.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Ciclo de cobrança</label>
              <select className="input" {...register('billing_cycle')}>
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>

            <div>
              <label className="label">Atendimentos inclusos por ciclo</label>
              <input
                type="number"
                min="0"
                placeholder="0 (ilimitado)"
                className="input"
                {...register('includes_count', { valueAsNumber: true })}
              />
              <p className="text-[10px] text-fg-subtle mt-1">
                Deixe 0 se o plano dá direito a quantidade ilimitada.
              </p>
            </div>

            <div>
              <label className="label">Desconto em extras (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="0"
                className="input"
                {...register('discount_percent_on_extras', {
                  valueAsNumber: true,
                })}
              />
              <p className="text-[10px] text-fg-subtle mt-1">
                Desconto que assinantes recebem em produtos/serviços extras.
              </p>
            </div>

            <div>
              <label className="label">Ordem de exibição</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="input"
                {...register('display_order', { valueAsNumber: true })}
              />
            </div>
          </div>
        </section>

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
              {...register('active')}
            />
            <div>
              <p className="text-sm text-fg font-medium">Plano ativo</p>
              <p className="text-[11px] text-fg-subtle">
                Planos inativos não podem ser usados em novas assinaturas, mas
                assinantes existentes continuam ativos.
              </p>
            </div>
          </label>
        </section>

        <div className="flex items-center justify-between gap-3">
          <div>
            {planId && (
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
                <span>Desativar plano</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/assinaturas" className="btn-secondary">
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
                  <span>{planId ? 'Salvar alterações' : 'Criar plano'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
