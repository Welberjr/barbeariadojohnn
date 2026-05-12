'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Scissors,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Loader2,
  Check,
  X,
  CheckCircle2,
  Clock,
  Phone,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import {
  addServiceToComanda,
  addProductToComanda,
  removeComandaItem,
  closeComanda,
  cancelComanda,
} from '../actions';

interface Comanda {
  id: string;
  customer_id: string;
  staff_id: string;
  status: string;
  subtotal: number;
  service_total: number;
  product_total: number;
  discount: number;
  tip: number;
  total: number;
  opened_at: string;
  closed_at: string | null;
  payment_method: string | null;
  customers: { id: string; full_name: string; phone: string | null } | null;
  staff: { id: string; display_name: string } | null;
}

interface ServiceItem {
  id: string;
  service_id: string;
  staff_id: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  services: { name: string; base_duration_minutes: number } | null;
  staff: { display_name: string } | null;
}

interface ProductItem {
  id: string;
  product_id: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  products: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  base_price: number;
  base_duration_minutes: number;
  category: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string | null;
}

interface Staff {
  id: string;
  display_name: string;
}

interface ComandaDetailProps {
  comanda: Comanda;
  comandaServices: ServiceItem[];
  comandaProducts: ProductItem[];
  services: Service[];
  products: Product[];
  staff: Staff[];
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'credit_card', label: 'Crédito', icon: CreditCard },
  { value: 'debit_card', label: 'Débito', icon: CreditCard },
];

export function ComandaDetail({
  comanda,
  comandaServices,
  comandaProducts,
  services,
  products,
  staff,
}: ComandaDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddService, setShowAddService] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const [serviceForm, setServiceForm] = useState({
    service_id: '',
    staff_id: comanda.staff_id,
    price: 0,
  });
  const [productForm, setProductForm] = useState({
    product_id: '',
    price: 0,
    quantity: 1,
  });
  const [closeForm, setCloseForm] = useState({
    payment_method: 'pix',
    discount: 0,
    tip: 0,
  });

  const isOpen = comanda.status === 'open';
  const isClosed = comanda.status === 'closed';
  const isCancelled = comanda.status === 'cancelled';

  // Estatísticas
  const elapsed = useMemo(() => {
    const start = new Date(comanda.opened_at);
    const end = comanda.closed_at ? new Date(comanda.closed_at) : new Date();
    return Math.floor((end.getTime() - start.getTime()) / 60000);
  }, [comanda.opened_at, comanda.closed_at]);

  // Total calculado em tempo real considerando desconto/gorjeta
  const calculatedTotal = useMemo(() => {
    const sub = comandaServices.reduce(
      (s, item) => s + Number(item.subtotal),
      0
    );
    const prod = comandaProducts.reduce(
      (s, item) => s + Number(item.subtotal),
      0
    );
    return sub + prod;
  }, [comandaServices, comandaProducts]);

  const finalTotal = calculatedTotal - closeForm.discount + closeForm.tip;

  // Agrupar serviços por categoria
  const servicesByCategory = useMemo(() => {
    const map = new Map<string, Service[]>();
    services.forEach((s) => {
      const cat = s.category ?? 'Outros';
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    });
    return Array.from(map.entries());
  }, [services]);

  function handleServiceSelect(serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    setServiceForm({
      ...serviceForm,
      service_id: serviceId,
      price: s ? Number(s.base_price) : 0,
    });
  }

  function handleProductSelect(productId: string) {
    const p = products.find((x) => x.id === productId);
    setProductForm({
      ...productForm,
      product_id: productId,
      price: p ? Number(p.price) : 0,
    });
  }

  async function handleAddService() {
    if (!serviceForm.service_id || !serviceForm.staff_id) {
      toast.error('Selecione serviço e profissional');
      return;
    }

    const result = await addServiceToComanda(
      comanda.id,
      serviceForm.service_id,
      serviceForm.staff_id,
      serviceForm.price
    );

    if (result.ok) {
      toast.success('Serviço adicionado!');
      setShowAddService(false);
      setServiceForm({
        service_id: '',
        staff_id: comanda.staff_id,
        price: 0,
      });
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  async function handleAddProduct() {
    if (!productForm.product_id) {
      toast.error('Selecione um produto');
      return;
    }

    const result = await addProductToComanda(
      comanda.id,
      productForm.product_id,
      productForm.price,
      productForm.quantity
    );

    if (result.ok) {
      toast.success('Produto adicionado!');
      setShowAddProduct(false);
      setProductForm({ product_id: '', price: 0, quantity: 1 });
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  async function handleRemoveItem(
    itemId: string,
    type: 'service' | 'product'
  ) {
    if (!confirm('Remover este item?')) return;

    const result = await removeComandaItem(comanda.id, itemId, type);
    if (result.ok) {
      toast.success('Item removido!');
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  async function handleClose() {
    if (calculatedTotal <= 0) {
      toast.error('Adicione ao menos um item antes de fechar');
      return;
    }
    if (!closeForm.payment_method) {
      toast.error('Selecione a forma de pagamento');
      return;
    }

    const result = await closeComanda(
      comanda.id,
      closeForm.payment_method,
      closeForm.discount,
      closeForm.tip
    );

    if (result.ok) {
      toast.success('Comanda fechada! Venda registrada.');
      startTransition(() => {
        router.push('/admin/comandas');
        router.refresh();
      });
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        'Cancelar esta comanda? Os itens serão perdidos e nenhuma venda será registrada.'
      )
    )
      return;

    const result = await cancelComanda(comanda.id);
    if (result.ok) {
      toast.success('Comanda cancelada');
      startTransition(() => {
        router.push('/admin/comandas');
        router.refresh();
      });
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  // Tempo de comanda
  const openedTime = new Date(comanda.opened_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* COLUNA ESQUERDA — Info da comanda e itens */}
      <div className="lg:col-span-2 space-y-4">
        {/* Header da comanda */}
        <div className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-bg flex-shrink-0"
                style={{
                  background:
                    'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                }}
              >
                {comanda.customers?.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() ?? '??'}
              </div>
              <div>
                <p className="text-[10px] text-gold tracking-widest uppercase font-semibold">
                  Comanda
                </p>
                <h1
                  className="text-xl font-bold text-fg"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {comanda.customers?.full_name ?? 'Cliente'}
                </h1>
                <div className="flex items-center gap-3 text-xs text-fg-muted mt-1">
                  {comanda.customers?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {comanda.customers.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {comanda.staff?.display_name ?? '-'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Aberta às {openedTime} ({elapsed} min)
                  </span>
                </div>
              </div>
            </div>

            <div
              className={cn(
                'px-3 py-1.5 rounded-md text-[11px] uppercase tracking-widest font-semibold',
                isOpen && 'bg-gold/15 text-gold',
                isClosed && 'bg-success/15 text-success',
                isCancelled && 'bg-danger/15 text-danger'
              )}
            >
              {isOpen && '● Em curso'}
              {isClosed && '✓ Concluída'}
              {isCancelled && '✕ Cancelada'}
            </div>
          </div>
        </div>

        {/* SERVIÇOS */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold text-fg flex items-center gap-2"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              <Scissors className="w-4 h-4 text-gold" />
              Serviços ({comandaServices.length})
            </h2>
            {isOpen && (
              <button
                type="button"
                onClick={() => setShowAddService(true)}
                className="btn-gold-outline text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar</span>
              </button>
            )}
          </div>

          {/* Form add serviço */}
          {showAddService && (
            <div className="card-premium p-3 mb-3 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">
                  Novo serviço
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddService(false)}
                  className="text-fg-subtle hover:text-fg"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="label text-[9px]">Serviço</label>
                  <select
                    className="input text-xs"
                    value={serviceForm.service_id}
                    onChange={(e) => handleServiceSelect(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {servicesByCategory.map(([cat, items]) => (
                      <optgroup key={cat} label={cat}>
                        {items.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {formatCurrency(Number(s.base_price))}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-[9px]">Profissional</label>
                  <select
                    className="input text-xs"
                    value={serviceForm.staff_id}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        staff_id: e.target.value,
                      })
                    }
                  >
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-[9px]">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input text-xs"
                    value={serviceForm.price}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        price: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddService}
                disabled={isPending}
                className="btn-primary text-xs w-full flex items-center justify-center gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span>Adicionar serviço</span>
              </button>
            </div>
          )}

          {comandaServices.length === 0 ? (
            <p className="text-center text-fg-subtle text-xs py-4">
              Nenhum serviço adicionado ainda
            </p>
          ) : (
            <div className="space-y-1">
              {comandaServices.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-bg-elevated transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                    <Scissors className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">
                      {item.services?.name ?? 'Serviço'}
                    </p>
                    <p className="text-[10px] text-fg-muted">
                      {item.staff?.display_name ?? '-'} ·{' '}
                      {formatCurrency(Number(item.unit_price))}
                      {item.quantity > 1 && ` × ${item.quantity}`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gold flex-shrink-0">
                    {formatCurrency(Number(item.subtotal))}
                  </p>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id, 'service')}
                      className="p-1 rounded text-fg-subtle hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PRODUTOS */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold text-fg flex items-center gap-2"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              <Package className="w-4 h-4 text-gold" />
              Produtos ({comandaProducts.length})
            </h2>
            {isOpen && products.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddProduct(true)}
                className="btn-gold-outline text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar</span>
              </button>
            )}
          </div>

          {showAddProduct && (
            <div className="card-premium p-3 mb-3 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">
                  Novo produto
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="text-fg-subtle hover:text-fg"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <label className="label text-[9px]">Produto</label>
                  <select
                    className="input text-xs"
                    value={productForm.product_id}
                    onChange={(e) => handleProductSelect(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatCurrency(Number(p.price))}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-[9px]">Qtd</label>
                  <input
                    type="number"
                    min="1"
                    className="input text-xs"
                    value={productForm.quantity}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddProduct}
                disabled={isPending}
                className="btn-primary text-xs w-full flex items-center justify-center gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span>Adicionar produto</span>
              </button>
            </div>
          )}

          {products.length === 0 ? (
            <p className="text-center text-fg-subtle text-xs py-4">
              Nenhum produto cadastrado.{' '}
              <a
                href="/admin/produtos"
                className="text-gold hover:underline"
              >
                Cadastrar produto
              </a>
            </p>
          ) : comandaProducts.length === 0 ? (
            <p className="text-center text-fg-subtle text-xs py-4">
              Nenhum produto adicionado
            </p>
          ) : (
            <div className="space-y-1">
              {comandaProducts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-bg-elevated transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">
                      {item.products?.name ?? 'Produto'}
                    </p>
                    <p className="text-[10px] text-fg-muted">
                      {formatCurrency(Number(item.unit_price))} ×{' '}
                      {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gold flex-shrink-0">
                    {formatCurrency(Number(item.subtotal))}
                  </p>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id, 'product')}
                      className="p-1 rounded text-fg-subtle hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* COLUNA DIREITA — Resumo e fechamento */}
      <div className="space-y-4">
        <div className="card p-5 sticky top-4 space-y-4">
          <div>
            <p className="text-[10px] text-gold tracking-widest uppercase font-semibold mb-2">
              Resumo
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted">Serviços</span>
                <span className="text-fg">
                  {formatCurrency(
                    comandaServices.reduce(
                      (s, i) => s + Number(i.subtotal),
                      0
                    )
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-muted">Produtos</span>
                <span className="text-fg">
                  {formatCurrency(
                    comandaProducts.reduce(
                      (s, i) => s + Number(i.subtotal),
                      0
                    )
                  )}
                </span>
              </div>

              {isOpen && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-fg-muted text-xs">Desconto</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={calculatedTotal}
                      className="input text-xs text-right w-24 py-1"
                      value={closeForm.discount}
                      onChange={(e) =>
                        setCloseForm({
                          ...closeForm,
                          discount: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-fg-muted text-xs">Gorjeta</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-xs text-right w-24 py-1"
                      value={closeForm.tip}
                      onChange={(e) =>
                        setCloseForm({
                          ...closeForm,
                          tip: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-fg-dim">
              Total
            </span>
            <span
              className="text-3xl font-bold text-gold"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {formatCurrency(isOpen ? finalTotal : Number(comanda.total))}
            </span>
          </div>

          {isOpen && (
            <>
              <div className="h-px bg-border" />

              <div className="space-y-2">
                <p className="text-[10px] text-fg-dim uppercase tracking-wider font-semibold">
                  Forma de pagamento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((p) => {
                    const Icon = p.icon;
                    const isSelected = closeForm.payment_method === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() =>
                          setCloseForm({
                            ...closeForm,
                            payment_method: p.value,
                          })
                        }
                        className={cn(
                          'p-2.5 rounded-md border text-xs flex items-center gap-2 transition-all',
                          isSelected
                            ? 'border-gold/40 bg-gold/10 text-gold'
                            : 'border-border text-fg-muted hover:border-gold/20'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isPending || calculatedTotal <= 0}
                className="w-full btn-gold-shimmer flex items-center justify-center gap-2 py-3"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                <span>Fechar comanda</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="w-full text-xs text-fg-subtle hover:text-danger transition-colors py-2"
              >
                Cancelar comanda
              </button>
            </>
          )}

          {isClosed && (
            <div className="text-center py-2 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
              <p className="text-xs text-success font-semibold uppercase tracking-wider">
                Comanda Concluída
              </p>
              {comanda.payment_method && (
                <p className="text-[10px] text-fg-muted">
                  {PAYMENT_METHODS.find(
                    (p) => p.value === comanda.payment_method
                  )?.label ?? comanda.payment_method}
                </p>
              )}
            </div>
          )}

          {isCancelled && (
            <div className="text-center py-2 space-y-1">
              <X className="w-8 h-8 text-danger mx-auto" />
              <p className="text-xs text-danger font-semibold uppercase tracking-wider">
                Cancelada
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
