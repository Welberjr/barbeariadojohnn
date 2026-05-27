'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Repeat,
} from 'lucide-react';
import Link from 'next/link';

import {
  createBill,
  updateBill,
  deleteBill,
  markBillAsPaid,
  reopenBill,
  generateNextRecurrence,
} from '../actions';
import type { BillFormData } from '../actions';

const billSchema = z.object({
  description: z.string().min(2, 'Descrição obrigatória'),
  amount: z.number().min(0, 'Valor >= 0'),
  due_date: z.string().min(8, 'Data obrigatória'),
  category_id: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_recurring: z.boolean(),
  recurrence_type: z.string().optional().nullable(),
  recurrence_day: z.number().optional().nullable(),
});

type BillFormSchema = z.infer<typeof billSchema>;

interface Category {
  id: string;
  name: string;
}

interface BillFormProps {
  billId?: string;
  defaultValues?: Partial<BillFormData>;
  categories: Category[];
  isPaid?: boolean;
  isRecurring?: boolean;
}

export function BillForm({
  billId,
  defaultValues,
  categories,
  isPaid,
  isRecurring,
}: BillFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('pix');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillFormSchema>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      description: defaultValues?.description ?? '',
      amount: defaultValues?.amount ?? 0,
      due_date:
        defaultValues?.due_date ?? new Date().toISOString().split('T')[0],
      category_id: defaultValues?.category_id ?? '',
      supplier: defaultValues?.supplier ?? '',
      notes: defaultValues?.notes ?? '',
      is_recurring: defaultValues?.is_recurring ?? false,
      recurrence_type: defaultValues?.recurrence_type ?? 'monthly',
      recurrence_day: defaultValues?.recurrence_day ?? null,
    },
  });

  const recurring = watch('is_recurring');

  async function onSubmit(data: BillFormSchema) {
    setIsLoading(true);
    try {
      const result = billId
        ? await updateBill(billId, data as BillFormData)
        : await createBill(data as BillFormData);

      if (result.ok) {
        toast.success(
          billId ? 'Conta atualizada!' : 'Conta cadastrada com sucesso!'
        );
        router.push('/admin/contas-pagar');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (!billId) return;
    setIsActioning(true);
    const result = await markBillAsPaid(billId, paymentMethod);
    if (result.ok) {
      toast.success('Conta marcada como paga!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao marcar.');
    }
    setIsActioning(false);
  }

  async function handleReopen() {
    if (!billId) return;
    if (!confirm('Reabrir esta conta? Ela voltará para o status pendente.')) return;
    setIsActioning(true);
    const result = await reopenBill(billId);
    if (result.ok) {
      toast.success('Conta reaberta.');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao reabrir.');
    }
    setIsActioning(false);
  }

  async function handleNextRecurrence() {
    if (!billId) return;
    setIsActioning(true);
    const result = await generateNextRecurrence(billId);
    if (result.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((result as any).skipped) {
        toast.info('Próxima ocorrência já existe.');
      } else {
        toast.success('Próxima ocorrência gerada!');
        router.push('/admin/contas-pagar');
      }
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsActioning(false);
  }

  async function handleDelete() {
    if (!billId) return;
    if (!confirm('Excluir esta conta? Esta ação não pode ser desfeita.'))
      return;
    setIsActioning(true);
    const result = await deleteBill(billId);
    if (result.ok) {
      toast.success('Conta excluída.');
      router.push('/admin/contas-pagar');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao excluir.');
      setIsActioning(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <Link
          href="/admin/contas-pagar"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para contas a pagar</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {billId ? 'Editar' : 'Cadastrar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {billId ? 'Editar Conta' : 'Nova Conta a Pagar'}
        </h1>
      </div>

      <div className="divider-gold" />

      {/* AÇÕES RÁPIDAS (somente edição) */}
      {billId && (
        <section className="card p-5">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim mb-3">
            Ações rápidas
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            {!isPaid ? (
              <>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input py-1.5 text-sm w-auto"
                >
                  <option value="pix">PIX</option>
                  <option value="cash">Dinheiro</option>
                  <option value="debit">Débito</option>
                  <option value="credit">Crédito</option>
                  <option value="transfer">Transferência</option>
                  <option value="boleto">Boleto</option>
                </select>
                <button
                  type="button"
                  onClick={handleMarkPaid}
                  disabled={isActioning}
                  className="flex items-center gap-2 text-sm bg-success/10 text-success hover:bg-success/20 px-4 py-2 rounded-md transition-colors"
                >
                  {isActioning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Marcar como paga</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleReopen}
                disabled={isActioning}
                className="flex items-center gap-2 text-sm bg-warning/10 text-warning hover:bg-warning/20 px-4 py-2 rounded-md transition-colors"
              >
                {isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>Reabrir conta</span>
              </button>
            )}

            {isRecurring && (
              <button
                type="button"
                onClick={handleNextRecurrence}
                disabled={isActioning}
                className="flex items-center gap-2 text-sm bg-info/10 text-info hover:bg-info/20 px-4 py-2 rounded-md transition-colors"
              >
                {isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
                <span>Gerar próxima ocorrência</span>
              </button>
            )}
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DADOS BÁSICOS */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Dados da Conta
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Descrição *</label>
              <input
                type="text"
                placeholder="Ex: Aluguel do salão - junho"
                className="input"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-danger mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input"
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-xs text-danger mt-1">
                  {errors.amount.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Data de vencimento *</label>
              <input type="date" className="input" {...register('due_date')} />
              {errors.due_date && (
                <p className="text-xs text-danger mt-1">
                  {errors.due_date.message}
                </p>
              )}
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
              <label className="label">Fornecedor / Beneficiário</label>
              <input
                type="text"
                placeholder="Ex: Imobiliária ABC"
                className="input"
                {...register('supplier')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Observações</label>
              <textarea
                rows={2}
                placeholder="Notas opcionais..."
                className="input resize-none"
                {...register('notes')}
              />
            </div>
          </div>
        </section>

        {/* RECORRÊNCIA */}
        <section className="card p-6 space-y-3">
          <h2
            className="text-lg font-semibold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Recorrência
          </h2>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              {...register('is_recurring')}
            />
            <div>
              <p className="text-sm text-fg font-medium">Conta recorrente</p>
              <p className="text-[11px] text-fg-subtle">
                Útil para aluguel, energia, internet e outras contas mensais.
              </p>
            </div>
          </label>

          {recurring && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
              <div>
                <label className="label">Frequência</label>
                <select className="input" {...register('recurrence_type')}>
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div>
                <label className="label">Dia do mês (opcional)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 5"
                  className="input"
                  {...register('recurrence_day', { valueAsNumber: true })}
                />
              </div>
            </div>
          )}
        </section>

        {/* AÇÕES */}
        <div className="flex items-center justify-between gap-3">
          <div>
            {billId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isActioning}
                className="flex items-center gap-2 text-sm text-danger hover:bg-danger/10 px-3 py-2 rounded-md transition-colors"
              >
                {isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Excluir conta</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/contas-pagar" className="btn-secondary">
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
                  <span>{billId ? 'Salvar alterações' : 'Cadastrar conta'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
