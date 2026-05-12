'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { createAppointment } from '../actions';

interface Staff {
  id: string;
  display_name: string;
  role: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Service {
  id: string;
  name: string;
  base_price: number;
  base_duration_minutes: number;
  category: string | null;
}

interface NewAppointmentDrawerProps {
  context: {
    staffId: string;
    startTime: string; // HH:MM
  };
  selectedDate: string; // YYYY-MM-DD
  staff: Staff[];
  customers: Customer[];
  services: Service[];
  onClose: () => void;
}

export function NewAppointmentDrawer({
  context,
  selectedDate,
  staff,
  customers,
  services,
  onClose,
}: NewAppointmentDrawerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerSearch, setCustomerSearch] = useState('');

  const [form, setForm] = useState({
    customer_id: '',
    staff_id: context.staffId,
    service_id: '',
    date: selectedDate,
    start_time: context.startTime,
    duration: 40,
    notes: '',
  });

  // Filtrar clientes pela busca
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(customerSearch))
      )
      .slice(0, 50);
  }, [customers, customerSearch]);

  // Quando muda o serviço, atualiza a duração
  function handleServiceChange(serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    setForm({
      ...form,
      service_id: serviceId,
      duration: service?.base_duration_minutes ?? form.duration,
    });
  }

  // Calcular end_time
  const endTime = useMemo(() => {
    const [h, m] = form.start_time.split(':').map(Number);
    const totalMin = h * 60 + m + form.duration;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [form.start_time, form.duration]);

  async function handleSubmit() {
    if (!form.customer_id) {
      toast.error('Selecione um cliente');
      return;
    }
    if (!form.staff_id) {
      toast.error('Selecione um profissional');
      return;
    }

    // Construir ISO timestamps (timezone Brasília -3h)
    const startISO = `${form.date}T${form.start_time}:00.000-03:00`;
    const endISO = `${form.date}T${endTime}:00.000-03:00`;

    const result = await createAppointment({
      customer_id: form.customer_id,
      staff_id: form.staff_id,
      service_id: form.service_id || null,
      start_at: startISO,
      end_at: endISO,
      notes: form.notes || null,
    });

    if (result.ok) {
      toast.success('Agendamento criado!');
      startTransition(() => {
        router.refresh();
        onClose();
      });
    } else {
      toast.error(result.error ?? 'Erro ao criar agendamento');
    }
  }

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

  // Cliente selecionado
  const selectedCustomer = customers.find((c) => c.id === form.customer_id);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg border-l border-border z-50 shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-bg border-b border-border p-5 flex items-center justify-between z-10">
          <div>
            <p className="text-[10px] text-gold tracking-widest uppercase font-semibold">
              Novo
            </p>
            <h2
              className="text-lg font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Agendamento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-bg-elevated text-fg-muted hover:text-fg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cliente */}
          <div>
            <label className="label text-xs">Cliente *</label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 p-3 rounded-md border border-gold/40 bg-gold/5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-fg">
                    {selectedCustomer.full_name}
                  </p>
                  {selectedCustomer.phone && (
                    <p className="text-xs text-fg-muted">
                      {selectedCustomer.phone}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, customer_id: '' })}
                  className="text-fg-subtle hover:text-fg text-xs"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nome ou telefone..."
                    className="input text-sm pl-9"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {customerSearch && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-md">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-fg-subtle">
                        Nenhum cliente encontrado
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, customer_id: c.id });
                            setCustomerSearch('');
                          }}
                          className="w-full text-left p-2.5 hover:bg-bg-elevated border-b border-border/40 last:border-b-0 transition-colors"
                        >
                          <p className="text-sm text-fg">{c.full_name}</p>
                          {c.phone && (
                            <p className="text-[11px] text-fg-muted">
                              {c.phone}
                            </p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Profissional */}
          <div>
            <label className="label text-xs">Profissional *</label>
            <select
              className="input text-sm"
              value={form.staff_id}
              onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Serviço */}
          <div>
            <label className="label text-xs">Serviço</label>
            <select
              className="input text-sm"
              value={form.service_id}
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="">Sem serviço específico</option>
              {servicesByCategory.map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatCurrency(Number(s.base_price))} ·{' '}
                      {s.base_duration_minutes} min
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Data *</label>
              <input
                type="date"
                className="input text-sm"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">Hora *</label>
              <input
                type="time"
                className="input text-sm"
                value={form.start_time}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value })
                }
              />
            </div>
          </div>

          {/* Duração */}
          <div>
            <label className="label text-xs">
              Duração: {form.duration} min (termina às {endTime})
            </label>
            <input
              type="range"
              min="15"
              max="240"
              step="15"
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: Number(e.target.value) })
              }
              className="w-full accent-gold"
            />
            <div className="flex justify-between text-[10px] text-fg-dim mt-1">
              <span>15 min</span>
              <span>4 horas</span>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="label text-xs">Observações (opcional)</label>
            <textarea
              className="input text-sm"
              rows={3}
              placeholder="Detalhes sobre o atendimento..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !form.customer_id}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Criar agendamento</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
