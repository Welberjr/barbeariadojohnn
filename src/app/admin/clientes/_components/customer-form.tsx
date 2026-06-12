'use client';

import { useConfirm } from '@/components/confirm-dialog';
import { useRef, useState } from 'react';
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
  Camera,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import {
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  uploadCustomerPhoto,
  createCustomerAccess,
  resetCustomerPassword,
} from '../actions';
import type { CustomerFormData } from '../actions';

const customerSchema = z.object({
  full_name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(8, 'Telefone obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
  allergies: z.string().optional(),
  preferred_barber_id: z.string().optional(),
  accepts_marketing: z.boolean(),
  active: z.boolean(),
});

type CustomerFormSchema = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  customerId?: string;
  defaultValues?: Partial<CustomerFormData>;
  barbers?: { id: string; display_name: string }[];
  hasAccess?: boolean;
  accessEmail?: string | null;
}

export function CustomerForm({
  customerId,
  defaultValues,
  barbers = [],
  hasAccess = false,
  accessEmail = null,
}: CustomerFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Foto
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    defaultValues?.photo_url ?? null
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Acesso ao painel
  const [accessForm, setAccessForm] = useState({
    email: accessEmail ?? defaultValues?.email ?? '',
    password: '',
  });
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessCreated, setAccessCreated] = useState(hasAccess);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormSchema>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: defaultValues?.full_name ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      cpf: defaultValues?.cpf ?? '',
      birth_date: defaultValues?.birth_date ?? '',
      notes: defaultValues?.notes ?? '',
      allergies: defaultValues?.allergies ?? '',
      preferred_barber_id: defaultValues?.preferred_barber_id ?? '',
      accepts_marketing: defaultValues?.accepts_marketing ?? true,
      active: defaultValues?.active ?? true,
    },
  });

  const confirmDialog = useConfirm();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const result = await uploadCustomerPhoto(fd);
      if (result.ok && result.url) {
        setPhotoUrl(result.url);
        toast.success('Foto enviada!');
      } else {
        toast.error(result.error ?? 'Erro ao enviar foto');
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onSubmit(data: CustomerFormSchema) {
    setIsLoading(true);
    try {
      const payload: CustomerFormData = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || undefined,
        cpf: data.cpf || undefined,
        birth_date: data.birth_date || undefined,
        notes: data.notes || undefined,
        allergies: data.allergies || undefined,
        preferred_barber_id: data.preferred_barber_id || undefined,
        accepts_marketing: data.accepts_marketing,
        active: data.active,
        photo_url: photoUrl,
      };

      const result = customerId
        ? await updateCustomer(customerId, payload)
        : await createCustomer(payload);

      if (result.ok) {
        toast.success(
          customerId
            ? 'Cliente atualizado com sucesso!'
            : 'Cliente cadastrado com sucesso!'
        );
        router.push('/admin/clientes');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!customerId) return;
    if (!(await confirmDialog({ title: 'Tem certeza que deseja desativar este cliente?', danger: true }))) return;

    setIsDeleting(true);
    const result = await deactivateCustomer(customerId);
    if (result.ok) {
      toast.success('Cliente desativado.');
      router.push('/admin/clientes');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao desativar.');
      setIsDeleting(false);
    }
  }

  async function handleCreateAccess() {
    if (!customerId) return;
    setAccessBusy(true);
    const result = await createCustomerAccess(
      customerId,
      accessForm.email,
      accessForm.password
    );
    setAccessBusy(false);
    if (result.ok) {
      toast.success('Acesso criado! Entregue e-mail e senha ao cliente.');
      setAccessCreated(true);
      setAccessForm({ ...accessForm, password: '' });
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao criar acesso');
    }
  }

  async function handleResetPassword() {
    if (!customerId) return;
    setAccessBusy(true);
    const result = await resetCustomerPassword(customerId, accessForm.password);
    setAccessBusy(false);
    if (result.ok) {
      toast.success('Senha redefinida!');
      setAccessForm({ ...accessForm, password: '' });
    } else {
      toast.error(result.error ?? 'Erro ao redefinir senha');
    }
  }

  const initials = (defaultValues?.full_name ?? 'NC')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link
          href="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para clientes</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {customerId ? 'Editar' : 'Cadastrar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {customerId ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
      </div>

      <div className="divider-gold" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* FOTO */}
        <section className="card p-6">
          <h2
            className="text-lg font-semibold text-fg mb-4"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Foto do Cliente
          </h2>
          <div className="flex items-center gap-5 flex-wrap">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Foto do cliente"
                className="w-24 h-24 rounded-full object-cover border-2 border-gold/40"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-xl font-bold text-bg"
                style={{
                  background:
                    'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                }}
              >
                {initials}
              </div>
            )}

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="btn-gold-outline text-xs flex items-center gap-2"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <span>{photoUrl ? 'Trocar foto' : 'Enviar foto'}</span>
              </button>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="block text-[11px] text-fg-subtle hover:text-danger transition-colors"
                >
                  Remover foto
                </button>
              )}
              <p className="text-[11px] text-fg-subtle max-w-xs">
                A foto aparece para a equipe e para o cliente no painel dele.
                JPG, PNG ou WEBP até 5MB.
              </p>
            </div>
          </div>
        </section>

        {/* DADOS PESSOAIS */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Dados Pessoais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome completo *</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
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
              <label className="label">Telefone (WhatsApp) *</label>
              <input
                type="tel"
                placeholder="(61) 99999-9999"
                className="input"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-xs text-danger mt-1">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                placeholder="cliente@email.com"
                className="input"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-danger mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">CPF</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                className="input"
                {...register('cpf')}
              />
            </div>

            <div>
              <label className="label">Data de nascimento</label>
              <input
                type="date"
                className="input"
                {...register('birth_date')}
              />
            </div>
          </div>
        </section>

        {/* ATENDIMENTO */}
        <section className="card p-6 space-y-4">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Preferências de Atendimento
          </h2>

          {barbers.length > 0 && (
            <div>
              <label className="label">Profissional preferido</label>
              <select
                className="input"
                {...register('preferred_barber_id')}
              >
                <option value="">Sem preferência</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Alergias / Restrições</label>
            <textarea
              rows={2}
              placeholder="Ex: Alergia a produtos com perfume forte..."
              className="input resize-none"
              {...register('allergies')}
            />
          </div>

          <div>
            <label className="label">Observações internas</label>
            <textarea
              rows={3}
              placeholder="Notas sobre o cliente, preferências de corte, histórico..."
              className="input resize-none"
              {...register('notes')}
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              Apenas a equipe vê essas observações.
            </p>
          </div>
        </section>

        {/* OPÇÕES */}
        <section className="card p-6 space-y-3">
          <h2
            className="text-lg font-semibold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Comunicação e Status
          </h2>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              {...register('accepts_marketing')}
            />
            <div>
              <p className="text-sm text-fg font-medium">
                Aceita receber mensagens promocionais
              </p>
              <p className="text-[11px] text-fg-subtle">
                Promoções, lembretes e novidades pelo WhatsApp.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              {...register('active')}
            />
            <div>
              <p className="text-sm text-fg font-medium">Cliente ativo</p>
              <p className="text-[11px] text-fg-subtle">
                Clientes inativos não aparecem em buscas padrão.
              </p>
            </div>
          </label>
        </section>

        {/* AÇÕES */}
        <div className="flex items-center justify-between gap-3">
          <div>
            {customerId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 text-sm text-danger hover:bg-danger/10 px-3 py-2 rounded-md transition-colors"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Desativar cliente</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/clientes" className="btn-secondary">
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
                  <span>
                    {customerId ? 'Salvar alterações' : 'Cadastrar cliente'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ACESSO AO PAINEL DO CLIENTE */}
      {customerId ? (
        <section className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold" />
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Acesso ao Painel do Cliente
            </h2>
          </div>

          {accessCreated ? (
            <>
              <p className="text-xs text-fg-muted">
                Este cliente já tem login no painel
                {accessEmail ? (
                  <>
                    {' '}
                    com o e-mail{' '}
                    <span className="text-fg font-medium">{accessEmail}</span>
                  </>
                ) : null}
                . Ele acessa em{' '}
                <span className="text-gold">/cliente/login</span>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="label">Nova senha</label>
                  <input
                    type="text"
                    placeholder="Mínimo 6 caracteres"
                    className="input"
                    value={accessForm.password}
                    onChange={(e) =>
                      setAccessForm({ ...accessForm, password: e.target.value })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={accessBusy || accessForm.password.length < 6}
                  className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {accessBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>Redefinir senha</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-fg-muted">
                Crie um login para o cliente acompanhar pontos, assinatura,
                agendamentos e ranking pelo painel dele (
                <span className="text-gold">/cliente</span>). Anote a senha e
                entregue a ele.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="label">E-mail de acesso</label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    className="input"
                    value={accessForm.email}
                    onChange={(e) =>
                      setAccessForm({ ...accessForm, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Senha inicial</label>
                  <input
                    type="text"
                    placeholder="Mínimo 6 caracteres"
                    className="input"
                    value={accessForm.password}
                    onChange={(e) =>
                      setAccessForm({ ...accessForm, password: e.target.value })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateAccess}
                  disabled={
                    accessBusy ||
                    accessForm.password.length < 6 ||
                    !accessForm.email.includes('@')
                  }
                  className="btn-gold-shimmer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {accessBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>Criar acesso</span>
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <p className="text-[11px] text-fg-subtle">
          Depois de cadastrar, abra o cliente para enviar foto já vinculada e
          criar o acesso ao painel dele.
        </p>
      )}
    </div>
  );
}
