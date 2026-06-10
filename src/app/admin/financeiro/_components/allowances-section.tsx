'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus, X, Loader2, Check, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { createAllowance, approveAllowance, rejectAllowance, deleteAllowance } from '../actions';

interface StaffOption { id: string; display_name: string; }

interface AllowanceRow {
  id: string;
  staff_id: string;
  staff_name: string;
  amount: number;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
}

interface AllowancesSectionProps {
  allowances: AllowanceRow[];
  staff: StaffOption[];
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function AllowancesSection({ allowances, staff }: AllowancesSectionProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Filtro local por mês/ano (não precisa de roundtrip)
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth()); // 0-11
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMode, setFilterMode] = useState<'month' | 'interval'>('month');

  // Formulário de novo vale
  const [form, setForm] = useState({
    staff_id: staff[0]?.id ?? '',
    amount: '',
    reason: '',
    reference_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  });
  const [savingNew, setSavingNew] = useState(false);

  // Filtra por mês/ano
  const filtered = allowances.filter((a) => {
    const d = new Date(a.requested_at);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const pendingRows = filtered.filter((a) => a.status === 'pending');
  const approvedRows = filtered.filter((a) => a.status === 'approved');
  const rejectedRows = filtered.filter((a) => a.status === 'rejected');

  const visibleRows =
    tab === 'pending' ? pendingRows :
    tab === 'approved' ? approvedRows : rejectedRows;

  const totalApproved = approvedRows.reduce((s, a) => s + a.amount, 0);

  async function handleCreate() {
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (!form.staff_id) { toast.error('Selecione um profissional'); return; }
    if (!amount || amount <= 0) { toast.error('Informe um valor válido'); return; }
    setSavingNew(true);
    const result = await createAllowance({
      staff_id: form.staff_id,
      amount,
      reason: form.reason,
      reference_month: form.reference_month,
    });
    setSavingNew(false);
    if (result.ok) {
      toast.success('Vale lançado!');
      setShowModal(false);
      setForm({ staff_id: staff[0]?.id ?? '', amount: '', reason: '', reference_month: form.reference_month });
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao lançar vale');
    }
  }

  async function handleApprove(id: string) {
    setBusy(id);
    const r = await approveAllowance(id);
    setBusy(null);
    if (r.ok) { toast.success('Vale aprovado'); startTransition(() => router.refresh()); }
    else toast.error(r.error ?? 'Erro');
  }

  async function handleReject(id: string) {
    setBusy(id);
    const r = await rejectAllowance(id);
    setBusy(null);
    if (r.ok) { toast.success('Vale recusado'); startTransition(() => router.refresh()); }
    else toast.error(r.error ?? 'Erro');
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este vale?')) return;
    setBusy(id);
    const r = await deleteAllowance(id);
    setBusy(null);
    if (r.ok) { toast.success('Vale removido'); startTransition(() => router.refresh()); }
    else toast.error(r.error ?? 'Erro');
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <section className="card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-purple-400">📋</span>
          <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Vales / Adiantamentos
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Vale</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md overflow-hidden border border-border">
          {(['month', 'interval'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMode(m)}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                filterMode === m ? 'bg-bg-elevated text-fg font-semibold' : 'text-fg-muted hover:text-fg'
              )}
            >
              {m === 'month' ? 'Mês/Ano' : 'Intervalo'}
            </button>
          ))}
        </div>
        <select
          className="input text-sm py-1.5 w-36"
          value={filterMonth}
          onChange={(e) => setFilterMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select
          className="input text-sm py-1.5 w-24"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {totalApproved > 0 && (
          <span className="text-xs text-fg-muted ml-auto">
            Total aprovado: <strong className="text-fg">{formatCurrency(totalApproved)}</strong>
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 rounded-md overflow-hidden border border-border/60">
        {([
          { v: 'pending', label: 'Pendentes', count: pendingRows.length },
          { v: 'approved', label: 'Aprovados', count: approvedRows.length },
          { v: 'rejected', label: 'Recusados', count: rejectedRows.length },
        ] as const).map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={cn(
              'py-2.5 text-xs font-medium transition-colors',
              tab === t.v
                ? 'bg-bg-elevated text-fg border-b-2 border-gold'
                : 'text-fg-muted hover:text-fg hover:bg-bg-elevated/50'
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Tabela */}
      {visibleRows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-fg-subtle">
            {tab === 'pending' ? 'Nenhum vale pendente' :
             tab === 'approved' ? 'Nenhum vale aprovado neste período' :
             'Nenhum vale recusado neste período'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-fg-dim border-b border-border/60">
                <th className="py-2 text-left">Profissional</th>
                <th className="py-2 text-right">Valor</th>
                <th className="py-2 text-left">Descrição</th>
                <th className="py-2 text-right">Data</th>
                <th className="py-2 text-right">Mês Ref.</th>
                <th className="py-2 text-center">Origem</th>
                <th className="py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((a) => (
                <tr key={a.id} className="border-b border-border/30 hover:bg-bg-elevated transition-colors">
                  <td className="py-3 text-fg font-medium">{a.staff_name}</td>
                  <td className="py-3 text-right text-danger font-semibold">
                    R$ {a.amount.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 text-fg-muted text-xs max-w-[180px] truncate">
                    {a.reason || '.'}
                  </td>
                  <td className="py-3 text-right text-fg-muted text-xs">
                    {fmtDate(a.requested_at)}
                  </td>
                  <td className="py-3 text-right text-fg-muted text-xs">
                    {new Date(a.requested_at).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-gold/10 text-gold border border-gold/30">
                      Admin
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-center gap-1">
                      {tab === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(a.id)}
                            disabled={busy === a.id}
                            className="p-1.5 rounded text-success hover:bg-success/10 transition-colors"
                            title="Aprovar"
                          >
                            {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(a.id)}
                            disabled={busy === a.id}
                            className="p-1.5 rounded text-danger hover:bg-danger/10 transition-colors"
                            title="Recusar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        disabled={busy === a.id}
                        className="p-1.5 rounded text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Vale */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card-premium p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Lançar Vale
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-fg-subtle hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label">Profissional</label>
              <select className="input" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input type="number" step="0.01" min="0" placeholder="0,00" className="input"
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Descrição</label>
              <input type="text" placeholder="Ex: gasolina, adiantamento..." className="input"
                value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div>
              <label className="label">Mês de referência</label>
              <input type="month" className="input" value={form.reference_month}
                onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={savingNew}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-colors"
              >
                {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Lançar Vale</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
