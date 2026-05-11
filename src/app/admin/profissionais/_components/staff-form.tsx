'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, X, Plus } from 'lucide-react';
import Link from 'next/link';

import { createStaff, updateStaff } from '../actions';
import type { StaffFormData } from '../actions';

const staffSchema = z.object({
  full_name: z.string().min(2, 'Nome completo obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  display_name: z.string().min(2, 'Apelido obrigatório'),
  role: z.enum(['owner', 'manager', 'barber', 'receptionist', 'assistant']),
  bio: z.string().optional(),
  default_commission_percent: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%'),
  active: z.boolean(),
});

type StaffFormSchema = z.infer<typeof staffSchema>;

interface StaffFormProps {
  staffId?: string;
  defaultValues?: Partial<StaffFormData>;
}

const roleOptions = [
  { value: 'barber', label: 'Barbeiro' },
  { value: 'receptionist', label: 'Recepcionista' },
  { value: 'manager', label: 'Gerente' },
  { value: 'assistant', label: 'Auxiliar' },
  { value: 'owner', label: 'Proprietário' },
];

export function StaffForm({ staffId, defaultValues }: StaffFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>(
    defaultValues?.specialties ?? []
  );
  const [specialtyInput, setSpecialtyInput] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StaffFormSchema>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: defaultValues?.full_name ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      display_name: defaultValues?.display_name ?? '',
      role: defaultValues?.role ?? 'barber',
      bio: defaultValues?.bio ?? '',
      default_commission_percent:
        defaultValues?.default_commission_percent ?? 40,
      active: defaultValues?.active ?? true,
    },
  });

  function addSpecialty() {
    const trimmed = specialtyInput.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties([...specialties, trimmed]);
      setSpecialtyInput('');
    }
  }

  function removeSpecialty(s: string) {
    setSpecialties(specialties.filter((x) => x !== s));
  }

  async function onSubmit(data: StaffFormSchema) {
    setIsLoading(true);
    try {
      const payload: StaffFormData = {
        ...data,
        specialties,
      };

      const result = staffId
        ? await updateStaff(staffId, payload)
        : await createStaff(payload);

      if (result.ok) {
        toast.success(
          staffId
            ? 'Profissional atualizado com sucesso!'
            : 'Profissional adicionado com sucesso!'
        );
        router.push('/admin/profissionais');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro inesperado ao salvar.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link
          href="/admin/profissionais"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para profissionais</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {staffId ? 'Editar' : 'Adicionar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {staffId ? 'Editar Profissional' : 'Novo Profissional'}
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
            <div>
              <label className="label">Nome completo *</label>
              <input
                type="text"
                placeholder="Ex: Jonathan Jones Silva"
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
              <label className="label">Apelido / Nome de exibição *</label>
              <input
                type="text"
                placeholder="Ex: Johnn"
                className="input"
                {...register('display_name')}
              />
              {errors.display_name && (
                <p className="text-xs text-danger mt-1">
                  {errors.display_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">E-mail *</label>
              <input
                type="email"
                placeholder="profissional@email.com"
                className="input"
                disabled={!!staffId}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-danger mt-1">
                  {errors.email.message}
                </p>
              )}
              {staffId && (
                <p className="text-[10px] text-fg-subtle mt-1">
                  E-mail não pode ser alterado após criação
                </p>
              )}
            </div>

            <div>
              <label className="label">Telefone</label>
              <input
                type="tel"
                placeholder="(61) 99999-9999"
                className="input"
                {...register('phone')}
              />
            </div>
          </div>
        </section>

        {/* DADOS PROFISSIONAIS */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Dados Profissionais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Função *</label>
              <select className="input" {...register('role')}>
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Comissão padrão (%) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="40"
                className="input"
                {...register('default_commission_percent', {
                  valueAsNumber: true,
                })}
              />
              {errors.default_commission_percent && (
                <p className="text-xs text-danger mt-1">
                  {errors.default_commission_percent.message}
                </p>
              )}
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <label className="label">Especialidades</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Degradê, Barba romana..."
                className="input flex-1"
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSpecialty();
                  }
                }}
              />
              <button
                type="button"
                onClick={addSpecialty}
                className="btn-secondary flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            {specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {specialties.map((s) => (
                  <span
                    key={s}
                    className="badge-gold flex items-center gap-1.5"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSpecialty(s)}
                      className="hover:text-danger transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Bio / Apresentação</label>
            <textarea
              rows={3}
              placeholder="Conte um pouco sobre o profissional..."
              className="input resize-none"
              {...register('bio')}
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-md bg-bg-elevated border border-border">
            <input
              type="checkbox"
              id="active"
              className="w-4 h-4 accent-gold cursor-pointer"
              {...register('active')}
            />
            <label htmlFor="active" className="text-sm text-fg cursor-pointer">
              Profissional ativo (aparece na agenda e aceita agendamentos)
            </label>
          </div>
        </section>

        {/* AÇÕES */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/admin/profissionais" className="btn-secondary">
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
                <span>{staffId ? 'Salvar alterações' : 'Adicionar profissional'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
