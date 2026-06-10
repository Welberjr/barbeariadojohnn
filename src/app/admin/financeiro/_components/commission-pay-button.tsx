'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { payCommission } from '../actions';

interface CommissionPayButtonProps {
  staffId: string;
  staffName: string;
  amount: number;
  fromDate: string;
  toDate: string;
}

export function CommissionPayButton({
  staffId,
  staffName,
  amount,
  fromDate,
  toDate,
}: CommissionPayButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('pix');

  async function handlePay() {
    setBusy(true);
    const result = await payCommission({
      staffId,
      amount,
      periodStart: fromDate,
      periodEnd: toDate,
      method,
    });
    setBusy(false);
    if (result.ok) {
      toast.success(`Comissão de ${staffName} paga: ${formatCurrency(amount)}`);
      setShowModal(false);
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao registrar pagamento');
    }
  }

  if (amount <= 0) return <span className="text-xs text-fg-dim">—</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-colors flex items-center gap-1"
      >
        <Check className="w-3 h-3" />
        Pagar
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card-premium p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Pagar Comissão
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-fg-subtle hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-fg">{staffName}</p>
              <p className="text-[11px] text-fg-muted">
                Período: {fromDate} a {toDate}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-fg-muted">Valor:</p>
              <p className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {formatCurrency(amount)}
              </p>
            </div>

            <div>
              <label className="label">Forma de pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {['pix', 'cash', 'transfer'].map((m) => {
                  const labels: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', transfer: 'Transferência' };
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`px-3 py-2 rounded-md text-xs border transition-all ${
                        method === m
                          ? 'border-gold/40 bg-gold/10 text-gold'
                          : 'border-border text-fg-muted hover:border-gold/20'
                      }`}
                    >
                      {labels[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={busy}
              className="btn-gold-shimmer w-full flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Confirmar pagamento</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
