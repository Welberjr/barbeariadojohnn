'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Save, Building2, Image as ImageIcon, Palette, CreditCard, Upload } from 'lucide-react';

import { updateBarbershopSettings, uploadLogo } from '../actions';
import type { BarbershopSettings } from '../actions';

interface Barbershop {
  name?: string;
  slogan?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  credit_fee_percent?: number | null;
  no_show_fee_enabled?: boolean | null;
  no_show_fee_amount?: number | null;
}

interface ConfiguracoesFormProps {
  barbershop: Barbershop;
}

export function ConfiguracoesForm({ barbershop }: ConfiguracoesFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(barbershop.logo_url ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const result = await uploadLogo(fd);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (result.ok && result.url) {
      setLogoPreview(result.url);
      toast.success('Logo enviada com sucesso!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao enviar a logo.');
    }
  }

  const { register, handleSubmit } = useForm<BarbershopSettings>({
    defaultValues: {
      name: barbershop.name ?? '',
      slogan: barbershop.slogan ?? '',
      phone: barbershop.phone ?? '',
      email: barbershop.email ?? '',
      address: barbershop.address ?? '',
      city: barbershop.city ?? '',
      state: barbershop.state ?? '',
      zip_code: barbershop.zip_code ?? '',
      logo_url: barbershop.logo_url ?? '',
      primary_color: barbershop.primary_color ?? '',
      credit_fee_percent: barbershop.credit_fee_percent != null
        ? Number(barbershop.credit_fee_percent)
        : null,
      no_show_fee_enabled: barbershop.no_show_fee_enabled ?? false,
      no_show_fee_amount: barbershop.no_show_fee_amount != null
        ? Number(barbershop.no_show_fee_amount)
        : null,
    },
  });

  async function onSubmit(data: BarbershopSettings) {
    setIsLoading(true);
    try {
      const result = await updateBarbershopSettings(data);
      if (result.ok) {
        toast.success('Configurações salvas!');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* DADOS BÁSICOS */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Dados da Barbearia
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Nome da barbearia</label>
            <input type="text" className="input" {...register('name')} />
          </div>

          <div className="md:col-span-2">
            <label className="label">Slogan</label>
            <input
              type="text"
              placeholder='Ex: "Tradição em estilo desde 2020"'
              className="input"
              {...register('slogan')}
            />
          </div>

          <div>
            <label className="label">Telefone</label>
            <input
              type="tel"
              placeholder="(61) 99999-0000"
              className="input"
              {...register('phone')}
            />
          </div>

          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              placeholder="contato@barbearia.com"
              className="input"
              {...register('email')}
            />
          </div>
        </div>
      </section>

      {/* ENDEREÇO */}
      <section className="card p-6 space-y-4">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Endereço
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-4">
            <label className="label">Endereço</label>
            <input
              type="text"
              placeholder="Rua, número, complemento"
              className="input"
              {...register('address')}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">CEP</label>
            <input
              type="text"
              placeholder="71900-000"
              className="input"
              {...register('zip_code')}
            />
          </div>

          <div className="md:col-span-4">
            <label className="label">Cidade</label>
            <input type="text" className="input" {...register('city')} />
          </div>

          <div className="md:col-span-2">
            <label className="label">UF</label>
            <input
              type="text"
              maxLength={2}
              placeholder="DF"
              className="input uppercase"
              {...register('state')}
            />
          </div>
        </div>
      </section>

      {/* IDENTIDADE VISUAL */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Identidade Visual
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-3">
            <label className="label flex items-center gap-2">
              <ImageIcon className="w-3 h-3" />
              Logo da barbearia
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-20 h-20 rounded-md bg-bg-elevated border border-border/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo atual" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-fg-dim" />
                )}
              </div>
              <div className="space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="btn-gold-outline text-xs flex items-center gap-1.5"
                >
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{isUploading ? 'Enviando...' : 'Enviar logo do computador'}</span>
                </button>
                <p className="text-[10px] text-fg-subtle">PNG, JPG, SVG ou WEBP · máximo 2MB</p>
              </div>
            </div>
            <div>
              <label className="label text-[11px]">Ou informe a URL da logo</label>
              <input
                type="url"
                placeholder="https://..."
                className="input"
                {...register('logo_url')}
              />
            </div>
          </div>

          <div>
            <label className="label">Cor primária (hex)</label>
            <input
              type="text"
              placeholder="#D4AF37"
              className="input"
              {...register('primary_color')}
            />
          </div>
        </div>
      </section>

      {/* FINANCEIRO */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Regras Financeiras
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Taxa cartão crédito (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="3.99"
              className="input"
              {...register('credit_fee_percent', { valueAsNumber: true })}
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              Descontado do valor líquido nas vendas em cartão.
            </p>
          </div>

          <div>
            <label className="label">Multa por falta (no-show, R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="input"
              {...register('no_show_fee_amount', { valueAsNumber: true })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
                {...register('no_show_fee_enabled')}
              />
              <div>
                <p className="text-sm text-fg font-medium">
                  Cobrar multa em caso de falta sem aviso
                </p>
                <p className="text-[11px] text-fg-subtle">
                  Quando ativado, clientes que faltarem sem cancelar serão
                  cobrados.
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* AÇÕES */}
      <div className="flex justify-end gap-3">
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
              <span>Salvar configurações</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
