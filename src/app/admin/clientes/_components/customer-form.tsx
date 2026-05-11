'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';

import {
  createCustomer,
  updateCustomer,
  deactivateCustomer,
} from '../actions';
import type { CustomerFormData } from '../actions';

const customerSchema = z.object({
  full_name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(8, 'Telefone obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
  allergies: z.string().optional(),
  preferred_barber_id: z.string().optional(),
  accepts_marketing: z.boolean(),
  active: z.boolean(),
});

type CustomerFormSchema = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  customerId?: string;
  defaultValues?: Partial<CustomerFormData>;
  barbers?: { id: string; display_name: string }[];
}

export function CustomerForm({
  customerId,
  defaultValues,
  barbers = [],
}: CustomerFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormSchema>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: defaultValues?.full_name ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      cpf: defaultValues?.cpf ?? '',
      birth_date: defaultValues?.birth_date ?? '',
      notes: defaultValues?.notes ?? '',
      allergies: defaultValues?.allergies ?? '',
      preferred_barber_id: defaultValues?.preferred_barber_id ?? '',
      accepts_marketing: defaultValues?.accepts_marketing ?? true,
      active: defaultValues?.active ?? true,
    },
  });

  async function onSubmit(data: CustomerFormSchema) {
    setIsLoading(true);
    try {
      const payload: CustomerFormData = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || undefined,
        cpf: data.cpf || undefined,
        birth_date: data.birth_date || undefined,
        notes: data.notes || undefined,
        allergies: data.allergies || undefined,
        preferred_barber_id: data.preferred_barber_id || undefined,
        accepts_marketing: data.accepts_marketing,
        active: data.active,
      };

      const result = customerId
        ? await updateCustomer(customerId, payload)
        : await createCustomer(payload);

      if (result.ok) {
        toast.success(
          customerId
            ? 'Cliente atualizado com sucesso!'
            : 'Cliente cadastrado com sucesso!'
        );
        router.push('/admin/clientes');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!customerId) return;
    if (!confirm('Tem certeza que deseja desativar este cliente?')) return;

    setIsDeleting(true);
    const result = await deactivateCustomer(customerId);
    if (result.ok) {
      toast.success('Cliente desativado.');
      router.push('/admin/clientes');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao desativar.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para clientes</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {customerId ? 'Editar' : 'Cadastrar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {customerId ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
      </div>

      <div className="divider-gold" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DADOS PESSOAIS */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Dados Pessoais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome completo *</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                className="input"
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="text-xs text-danger mt-1">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Telefone (WhatsApp) *</label>
              <input
                type="tel"
                placeholder="(61) 99999-9999"
                className="input"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-xs text-danger mt-1">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                placeholder="cliente@email.com"
                className="input"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-danger mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">CPF</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                className="input"
                {...register('cpf')}
              />
            </div>

            <div>
              <label className="label">Data de nascimento</label>
              <input
                type="date"
                className="input"
                {...register('birth_date')}
              />
            </div>
          </div>
        </section>

        {/* ATENDIMENTO */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Preferências de Atendimento
          </h2>

          {barbers.length > 0 && (
            <div>
              <label className="label">Profissional preferido</label>
              <select
                className="input"
                {...register('preferred_barber_id')}
              >
                <option value="">Sem preferência</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Alergias / Restrições</label>
            <textarea
              rows={2}
              placeholder="Ex: Alergia a produtos com perfume forte..."
              className="input resize-none"
              {...register('allergies')}
            />
          </div>

          <div>
            <label className="label">Observações internas</label>
            <textarea
              rows={3}
              placeholder="Notas sobre o cliente, preferências de corte, histórico..."
              className="input resize-none"
              {...register('notes')}
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              Apenas a equipe vê essas observações.
            </p>
          </div>
        </section>

        {/* OPÇÕES */}
        <section className="card p-6 space-y-3">
          <h2
            className="text-lg font-semibold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Comunicação e Status
          </h2>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              {...register('accepts_marketing')}
            />
            <div>
              <p className="text-sm text-fg font-medium">
                Aceita receber mensagens promocionais
              </p>
              <p className="text-[11px] text-fg-subtle">
                Promoções, lembretes e novidades pelo WhatsApp.
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
              <p className="text-sm text-fg font-medium">Cliente ativo</p>
              <p className="text-[11px] text-fg-subtle">
                Clientes inativos não aparecem em buscas padrão.
              </p>
            </div>
          </label>
        </section>

        {/* AÇÕES */}
        <div className="flex items-center justify-between gap-3">
          <div>
            {customerId && (
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
                <span>Desativar cliente</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/clientes" className="btn-secondary">
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
                    {customerId ? 'Salvar alterações' : 'Cadastrar cliente'}
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
