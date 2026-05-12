'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Loader2, Check, X, Edit2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn, formatCurrency } from '@/lib/utils';
import {
  upsertStaffService,
  removeStaffService,
  toggleStaffService,
} from '../staff-actions';

interface StaffOption {
  id: string;
  display_name: string;
  role: string;
}

interface StaffServiceRow {
  staff_id: string;
  display_name: string;
  role: string;
  custom_price: number | null;
  custom_duration_minutes: number | null;
  custom_commission_percent: number | null;
  active: boolean;
}

interface ServiceStaffManagerProps {
  serviceId: string;
  basePrice: number;
  baseDuration: number;
  baseCommission: number;
  currentAssociations: StaffServiceRow[];
  availableStaff: StaffOption[];
}

export function ServiceStaffManager({
  serviceId,
  basePrice,
  baseDuration,
  baseCommission,
  currentAssociations,
  availableStaff,
}: ServiceStaffManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editForm, setEditForm] = useState({
    customPrice: '',
    customDuration: '',
    customCommission: '',
  });
  const [addForm, setAddForm] = useState({
    staffId: '',
    customPrice: '',
    customDuration: '',
    customCommission: '',
  });

  // Staff que ainda não tá associado
  const associatedIds = new Set(currentAssociations.map((a) => a.staff_id));
  const unassociatedStaff = availableStaff.filter(
    (s) => !associatedIds.has(s.id)
  );

  function startEdit(row: StaffServiceRow) {
    setEditingId(row.staff_id);
    setEditForm({
      customPrice: row.custom_price?.toString() ?? '',
      customDuration: row.custom_duration_minutes?.toString() ?? '',
      customCommission: row.custom_commission_percent?.toString() ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ customPrice: '', customDuration: '', customCommission: '' });
  }

  async function saveEdit(staffId: string) {
    const result = await upsertStaffService({
      staff_id: staffId,
      service_id: serviceId,
      custom_price: editForm.customPrice ? Number(editForm.customPrice) : null,
      custom_duration_minutes: editForm.customDuration
        ? Number(editForm.customDuration)
        : null,
      custom_commission_percent: editForm.customCommission
        ? Number(editForm.customCommission)
        : null,
      active: true,
    });

    if (result.ok) {
      toast.success('Atualizado!');
      setEditingId(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao salvar');
    }
  }

  async function addStaff() {
    if (!addForm.staffId) {
      toast.error('Selecione um profissional');
      return;
    }

    const result = await upsertStaffService({
      staff_id: addForm.staffId,
      service_id: serviceId,
      custom_price: addForm.customPrice ? Number(addForm.customPrice) : null,
      custom_duration_minutes: addForm.customDuration
        ? Number(addForm.customDuration)
        : null,
      custom_commission_percent: addForm.customCommission
        ? Number(addForm.customCommission)
        : null,
      active: true,
    });

    if (result.ok) {
      toast.success('Profissional adicionado!');
      setShowAdd(false);
      setAddForm({
        staffId: '',
        customPrice: '',
        customDuration: '',
        customCommission: '',
      });
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao adicionar');
    }
  }

  async function removeStaff(staffId: string, displayName: string) {
    if (!confirm(`Remover ${displayName} deste serviço?`)) return;

    const result = await removeStaffService(staffId, serviceId);
    if (result.ok) {
      toast.success('Removido!');
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao remover');
    }
  }

  async function handleToggle(
    staffId: string,
    currentActive: boolean
  ) {
    const result = await toggleStaffService(staffId, serviceId, !currentActive);
    if (result.ok) {
      toast.success(currentActive ? 'Desativado' : 'Ativado');
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-lg font-semibold text-fg flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <UserCog className="w-5 h-5 text-gold" />
            Profissionais que fazem este serviço
          </h2>
          <p className="text-xs text-fg-muted mt-1">
            Cada profissional pode ter um preço, duração e comissão diferentes.
            Se deixar em branco, usa o padrão do serviço.
          </p>
        </div>
        {unassociatedStaff.length > 0 && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="btn-gold-outline flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        )}
      </div>

      {/* Form de adicionar */}
      {showAdd && (
        <div className="card-premium p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gold tracking-wider uppercase font-semibold">
              Novo profissional
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-fg-subtle hover:text-fg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label className="label text-[10px]">Profissional</label>
              <select
                className="input text-sm"
                value={addForm.staffId}
                onChange={(e) =>
                  setAddForm({ ...addForm, staffId: e.target.value })
                }
              >
                <option value="">Selecione...</option>
                {unassociatedStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-[10px]">
                Preço (deixe vazio = R$ {basePrice})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={basePrice.toString()}
                className="input text-sm"
                value={addForm.customPrice}
                onChange={(e) =>
                  setAddForm({ ...addForm, customPrice: e.target.value })
                }
              />
            </div>

            <div>
              <label className="label text-[10px]">
                Duração (vazio = {baseDuration} min)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                placeholder={baseDuration.toString()}
                className="input text-sm"
                value={addForm.customDuration}
                onChange={(e) =>
                  setAddForm({ ...addForm, customDuration: e.target.value })
                }
              />
            </div>

            <div>
              <label className="label text-[10px]">
                Comissão (vazio = {baseCommission}%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder={baseCommission.toString()}
                className="input text-sm"
                value={addForm.customCommission}
                onChange={(e) =>
                  setAddForm({ ...addForm, customCommission: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="btn-ghost text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={addStaff}
              disabled={isPending}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      )}

      {/* Lista de associações */}
      {currentAssociations.length === 0 ? (
        <div className="text-center py-8 text-fg-subtle text-sm border border-dashed border-border rounded-md">
          Nenhum profissional vinculado ainda.
          <br />
          <span className="text-[11px]">
            Clique em &quot;Adicionar&quot; para vincular alguém da equipe.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {currentAssociations.map((row) => {
            const initials = row.display_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const isEditing = editingId === row.staff_id;

            return (
              <div
                key={row.staff_id}
                className={cn(
                  'rounded-md border transition-colors',
                  isEditing
                    ? 'border-gold/40 bg-gold/5'
                    : 'border-border bg-bg-elevated',
                  !row.active && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                    }}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {row.display_name}
                    </p>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider">
                      {row.role}
                    </p>
                  </div>

                  {!isEditing && (
                    <>
                      <div className="hidden md:flex items-center gap-4 text-[11px]">
                        <div className="text-right">
                          <p className="text-fg-dim uppercase tracking-wider text-[9px]">
                            Preço
                          </p>
                          <p className="text-gold font-bold">
                            {formatCurrency(row.custom_price ?? basePrice)}
                            {row.custom_price !== null && (
                              <span className="text-[9px] text-fg-subtle ml-1">
                                custom
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-fg-dim uppercase tracking-wider text-[9px]">
                            Duração
                          </p>
                          <p className="text-fg">
                            {row.custom_duration_minutes ?? baseDuration} min
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-fg-dim uppercase tracking-wider text-[9px]">
                            Comissão
                          </p>
                          <p className="text-fg">
                            {row.custom_commission_percent ?? baseCommission}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(row.staff_id, row.active)}
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            row.active
                              ? 'text-success hover:bg-success/10'
                              : 'text-fg-subtle hover:bg-bg-surface'
                          )}
                          title={row.active ? 'Desativar' : 'Ativar'}
                        >
                          {row.active ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="p-1.5 rounded-md text-fg-muted hover:text-gold hover:bg-bg-surface transition-colors"
                          title="Editar valores"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeStaff(row.staff_id, row.display_name)
                          }
                          className="p-1.5 rounded-md text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Form de edição inline */}
                {isEditing && (
                  <div className="px-3 pb-3 pt-1 border-t border-gold/20 grid grid-cols-1 md:grid-cols-4 gap-2 animate-fade-in">
                    <div>
                      <label className="label text-[9px]">
                        Preço (R$ {basePrice} padrão)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={basePrice.toString()}
                        className="input text-sm"
                        value={editForm.customPrice}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            customPrice: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label text-[9px]">
                        Duração ({baseDuration} min padrão)
                      </label>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        placeholder={baseDuration.toString()}
                        className="input text-sm"
                        value={editForm.customDuration}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            customDuration: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label text-[9px]">
                        Comissão ({baseCommission}% padrão)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder={baseCommission.toString()}
                        className="input text-sm"
                        value={editForm.customCommission}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            customCommission: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="btn-ghost text-sm flex-1"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(row.staff_id)}
                        disabled={isPending}
                        className="btn-primary text-sm flex items-center gap-1 flex-1 justify-center"
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
