'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Loader2, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { addIncome, addExpense } from '../actions';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';

interface StaffOption { id: string; display_name: string; }

interface TransactionModalProps {
  type: 'income' | 'expense';
  staff: StaffOption[];
  onClose: () => void;
}

export function TransactionModal({ type, staff, onClose }: TransactionModalProps) {
  const router = useRouter();
  const isIncome = type === 'income';
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    category: '',
    staff_id: '',
    description: '',
    amount: '',
    occurred_at: today,
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ category?: string; description?: string; amount?: string }>({});

  async function handleSubmit() {
    const newErrors: { category?: string; description?: string; amount?: string } = {};
    if (!form.category) newErrors.category = 'Selecione uma categoria';
    if (!form.description.trim()) newErrors.description = 'Descreva o lançamento';
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (!form.amount || !amount || amount <= 0) newErrors.amount = 'Informe um valor maior que zero';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Confira os campos destacados');
      return;
    }

    setBusy(true);
    const payload = {
      category: form.category,
      staff_id: form.staff_id || null,
      description: form.description,
      amount,
      occurred_at: new Date(form.occurred_at + 'T12:00:00-03:00').toISOString(),
    };
    const result = isIncome ? await addIncome(payload) : await addExpense(payload);
    setBusy(false);

    if (result.ok) {
      toast.success(isIncome ? 'Receita adicionada!' : 'Despesa adicionada!');
      onClose();
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao salvar');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card-premium p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center',
              isIncome ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            )}>
              {isIncome
                ? <TrendingUp className="w-4 h-4" />
                : <TrendingDown className="w-4 h-4" />}
            </div>
            <h3 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              {isIncome ? 'Adicionar Receita' : 'Adicionar Despesa'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-fg-subtle hover:text-fg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categoria */}
        <div>
          <label className="label text-[10px] uppercase tracking-widest">Categoria</label>
          <select
            className={cn('input', errors.category && 'border-danger focus:border-danger')}
            value={form.category}
            onChange={(e) => {
              setForm({ ...form, category: e.target.value });
              if (errors.category) setErrors({ ...errors, category: undefined });
            }}
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.category && (
            <p className="text-xs text-danger mt-1">{errors.category}</p>
          )}
        </div>

        {/* Profissional */}
        <div>
          <label className="label text-[10px] uppercase tracking-widest">
            Profissional responsável
          </label>
          <select
            className="input"
            value={form.staff_id}
            onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
          >
            <option value="">
              {isIncome ? 'Barbearia (Receita Geral)' : 'Barbearia (Despesa Geral)'}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.display_name}</option>
            ))}
          </select>
          {!form.staff_id && (
            <p className="text-[10px] text-fg-subtle mt-1">
              {isIncome
                ? 'Receita direto pro caixa — sem comissão de profissional.'
                : 'Despesa geral da barbearia — não vinculada a nenhum profissional.'}
            </p>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label className="label text-[10px] uppercase tracking-widest">Descrição</label>
          <textarea
            rows={3}
            placeholder={isIncome ? 'Descreva a receita...' : 'Descreva a despesa...'}
            className={cn('input resize-none', errors.description && 'border-danger focus:border-danger')}
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
          />
          {errors.description && (
            <p className="text-xs text-danger mt-1">{errors.description}</p>
          )}
        </div>

        {/* Valor */}
        <div>
          <label className="label text-[10px] uppercase tracking-widest">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            className={cn('input', errors.amount && 'border-danger focus:border-danger')}
            value={form.amount}
            onChange={(e) => {
              setForm({ ...form, amount: e.target.value });
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }}
          />
          {errors.amount && (
            <p className="text-xs text-danger mt-1">{errors.amount}</p>
          )}
        </div>

        {/* Data */}
        <div>
          <label className="label text-[10px] uppercase tracking-widest flex items-center gap-1.5">
            <span>📅</span>
            {isIncome ? 'Data da receita' : 'Data da despesa'}
          </label>
          <input
            type="date"
            className="input"
            value={form.occurred_at}
            onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
          />
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all',
              isIncome
                ? 'bg-success text-bg hover:bg-success/90'
                : 'bg-danger text-bg hover:bg-danger/90'
            )}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isIncome ? 'Adicionar Receita' : 'Adicionar Despesa'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
