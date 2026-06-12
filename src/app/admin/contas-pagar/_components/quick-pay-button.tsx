'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, X, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { markBillAsPaid } from '../actions';

const METHODS = [
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'debit', label: 'Débito', icon: CreditCard },
  { value: 'credit', label: 'Crédito', icon: CreditCard },
];

export function QuickPayButton({
  billId,
  description,
  amount,
  onPaid,
}: {
  billId: string;
  description: string;
  amount: number;
  onPaid?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('pix');
  const [saving, setSaving] = useState(false);

  async function handlePay() {
    setSaving(true);
    const result = await markBillAsPaid(billId, method);
    setSaving(false);
    if (result.ok) {
      toast.success('Conta marcada como paga!');
      setOpen(false);
      onPaid?.();
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao marcar como paga');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Marcar como paga"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-success border border-success/30 bg-success/10 hover:bg-success/20 transition-colors"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Pagar</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="card-premium p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Marcar como paga
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="text-fg-subtle hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-md bg-bg-elevated border border-border/60">
              <p className="text-sm text-fg font-medium">{description}</p>
              <p className="text-lg font-bold text-gold mt-0.5">
                {formatCurrency(amount)}
              </p>
            </div>

            <div>
              <p className="label text-xs mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-md border text-sm transition-colors',
                        method === m.value
                          ? 'border-gold bg-gold/10 text-gold font-semibold'
                          : 'border-border text-fg-muted hover:border-gold/40'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={saving}
              className="btn-gold-shimmer w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Confirmar pagamento</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}