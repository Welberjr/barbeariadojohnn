'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { createService, updateService, deleteService } from '../actions';
import type { ServiceFormData } from '../actions';

const serviceSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  category: z.string().optional(),
  base_price: z.number().min(0, 'Preço deve ser maior ou igual a 0'),
  base_duration_minutes: z.number().min(5, 'Duração mínima de 5 min'),
  base_commission_percent: z.number().min(0).max(100, 'Máximo 100%'),
  show_on_public_menu: z.boolean(),
  display_order: z.number().min(0),
  active: z.boolean(),
});

type ServiceFormSchema = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  serviceId?: string;
  defaultValues?: Partial<ServiceFormData>;
}

const commonCategories = [
  'Cabelo',
  'Barba',
  'Combos',
  'Estética',
  'Especiais',
  'Tratamentos',
  'Coloração',
  'Outros',
];

export function ServiceForm({ serviceId, defaultValues }: ServiceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceFormSchema>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      category: defaultValues?.category ?? '',
      base_price: defaultValues?.base_price ?? 0,
      base_duration_minutes: defaultValues?.base_duration_minutes ?? 30,
      base_commission_percent:
        defaultValues?.base_commission_percent ?? 40,
      show_on_public_menu: defaultValues?.show_on_public_menu ?? true,
      display_order: defaultValues?.display_order ?? 0,
      active: defaultValues?.active ?? true,
    },
  });

  async function onSubmit(data: ServiceFormSchema) {
    setIsLoading(true);
    try {
      const result = serviceId
        ? await updateService(serviceId, data)
        : await createService(data);

      if (result.ok) {
        toast.success(
          serviceId
            ? 'Serviço atualizado com sucesso!'
            : 'Serviço adicionado com sucesso!'
        );
        router.push('/admin/servicos');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!serviceId) return;
    if (
      !confirm(
        'Tem certeza que deseja desativar este serviço? Ele não aparecerá mais no cardápio.'
      )
    ) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteService(serviceId);
    if (result.ok) {
      toast.success('Serviço desativado.');
      router.push('/admin/servicos');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao desativar.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* HEADER */}
      <div>
        <Link
          href="/admin/servicos"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para serviços</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {serviceId ? 'Editar' : 'Adicionar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {serviceId ? 'Editar Serviço' : 'Novo Serviço'}
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
            Informações do Serviço
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome do serviço *</label>
              <input
                type="text"
                placeholder="Ex: Corte degradê navalhado"
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
              <label className="label">Categoria</label>
              <input
                type="text"
                list="categories"
                placeholder="Ex: Cabelo, Barba, Combos..."
                className="input"
                {...register('category')}
              />
              <datalist id="categories">
                {commonCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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

            <div className="md:col-span-2">
              <label className="label">Descrição</label>
              <textarea
                rows={3}
                placeholder="Descreva o serviço para os clientes..."
                className="input resize-none"
                {...register('description')}
              />
            </div>
          </div>
        </section>

        {/* PREÇO E DURAÇÃO */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Preço e Duração
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Preço base (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="50.00"
                className="input"
                {...register('base_price', { valueAsNumber: true })}
              />
              {errors.base_price && (
                <p className="text-xs text-danger mt-1">
                  {errors.base_price.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Duração (min) *</label>
              <input
                type="number"
                min="5"
                step="5"
                placeholder="30"
                className="input"
                {...register('base_duration_minutes', { valueAsNumber: true })}
              />
              {errors.base_duration_minutes && (
                <p className="text-xs text-danger mt-1">
                  {errors.base_duration_minutes.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Comissão (%) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="40"
                className="input"
                {...register('base_commission_percent', {
                  valueAsNumber: true,
                })}
              />
              {errors.base_commission_percent && (
                <p className="text-xs text-danger mt-1">
                  {errors.base_commission_percent.message}
                </p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-fg-subtle">
            Cada profissional pode ter um preço diferente. Configure isso na
            tela do profissional após cadastrar o serviço.
          </p>
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
              {...register('show_on_public_menu')}
            />
            <div>
              <p className="text-sm text-fg font-medium">
                Mostrar no cardápio público
              </p>
              <p className="text-[11px] text-fg-subtle">
                O serviço aparecerá no site/app para os clientes agendarem.
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
              <p className="text-sm text-fg font-medium">Serviço ativo</p>
              <p className="text-[11px] text-fg-subtle">
                Serviços inativos não aparecem para agendamento nem para venda.
              </p>
            </div>
          </label>
        </section>

        {/* AÇÕES */}
        <div className="flex items-center justify-between gap-3">
          <div>
            {serviceId && (
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
                <span>Desativar serviço</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/servicos" className="btn-secondary">
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
                    {serviceId ? 'Salvar alterações' : 'Adicionar serviço'}
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
