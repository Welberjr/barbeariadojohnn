'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShoppingCart, X, Check, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { registerSale } from '../actions';

interface Product {
  id: string;
  name: string;
  sale_price: number;
  stock_current: number;
  is_sellable: boolean;
  active: boolean;
}

export function QuickSellButton({ products }: { products: Product[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const sellable = products.filter((p) => p.active && p.is_sellable && p.stock_current > 0);
  const selected = sellable.find((p) => p.id === selectedId) ?? null;

  async function handleSell() {
    if (!selected || qty < 1) return;
    setSaving(true);
    const res = await registerSale(selected.id, qty);
    setSaving(false);
    if (res.ok) {
      toast.success(`Venda registrada! Estoque: ${res.new_stock}`);
      setOpen(false);
      setSelectedId('');
      setQty(1);
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error ?? 'Erro ao registrar venda');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gold-shimmer flex items-center gap-2"
      >
        <ShoppingCart className="w-4 h-4" />
        <span>Registrar Venda</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card-premium p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Registrar Venda Avulsa
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-fg-subtle hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {sellable.length === 0 ? (
              <p className="text-sm text-fg-subtle">Nenhum produto disponivel para venda.</p>
            ) : (
              <>
                <div>
                  <label className="label">Produto</label>
                  <select
                    className="input"
                    value={selectedId}
                    onChange={(e) => { setSelectedId(e.target.value); setQty(1); }}
                  >
                    <option value="">Selecione um produto</option>
                    {sellable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.sale_price)} (estoque: {p.stock_current})
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <>
                    <div>
                      <label className="label">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        max={selected.stock_current}
                        className="input"
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm text-fg-muted">Total:</p>
                      <p
                        className="text-xl font-bold text-gold"
                        style={{ fontFamily: 'var(--font-playfair), serif' }}
                      >
                        {formatCurrency(qty * selected.sale_price)}
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSell}
                    disabled={saving || !selected}
                    className="btn-gold-shimmer flex-1 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Confirmar</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}