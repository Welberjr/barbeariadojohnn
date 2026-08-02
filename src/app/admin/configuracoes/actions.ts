'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';

import { lojaAtual } from '@/lib/loja';
export interface BarbershopSettings {
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
  debit_fee_percent?: number | null;
  no_show_fee_enabled?: boolean | null;
  no_show_fee_amount?: number | null;
  staff_default_view?: string | null;
}

function nullIfEmpty(v?: string | null) {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Salva os dados da barbearia.
 *
 * A tela fala a lingua de quem preenche ("Endereço", "Cidade", "CEP") e a
 * tabela guarda com outros nomes (address_street, address_city, address_zip).
 * A traducao acontece aqui.
 *
 * Sem isso, gravar qualquer campo derrubava o formulario inteiro com "não achei
 * a coluna address": seis dos quinze campos nao existiam com o nome que a tela
 * mandava, entao endereco, cidade, estado, CEP, slogan e taxa de falta nunca
 * foram salvos desde que a tela existe.
 */
export async function updateBarbershopSettings(data: BarbershopSettings) {
  const admin = await createManagerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.phone !== undefined) payload.phone = nullIfEmpty(data.phone);
  if (data.email !== undefined) payload.email = nullIfEmpty(data.email);

  // Endereco: a tabela guarda em pedacos
  if (data.address !== undefined) payload.address_street = nullIfEmpty(data.address);
  if (data.city !== undefined) payload.address_city = nullIfEmpty(data.city);
  if (data.state !== undefined) payload.address_state = nullIfEmpty(data.state);
  if (data.zip_code !== undefined) payload.address_zip = nullIfEmpty(data.zip_code);

  if (data.logo_url !== undefined)
    payload.logo_url = nullIfEmpty(data.logo_url);
  if (data.primary_color !== undefined)
    payload.primary_color = nullIfEmpty(data.primary_color);
  if (data.credit_fee_percent !== undefined && data.credit_fee_percent !== null)
    payload.credit_fee_percent = data.credit_fee_percent;
  if (data.debit_fee_percent !== undefined && data.debit_fee_percent !== null)
    payload.debit_fee_percent = data.debit_fee_percent;
  if (data.no_show_fee_enabled !== undefined)
    payload.no_show_fee_enabled = data.no_show_fee_enabled;

  // A cobranca por falta e em porcentagem do atendimento, nao em reais
  if (data.no_show_fee_amount !== undefined && data.no_show_fee_amount !== null)
    payload.no_show_fee_percent = data.no_show_fee_amount;

  if (data.staff_default_view !== undefined && data.staff_default_view !== null)
    payload.staff_default_view = data.staff_default_view;

  // O slogan mora no site_config, junto com o que so serve para a vitrine.
  // Precisa vir com o resto do conteudo junto, senao gravar o slogan apagaria
  // o Instagram e o horario que ja estao la.
  if (data.slogan !== undefined) {
    const { data: atual } = await admin
      .from('barbershops')
      .select('site_config')
      .eq('id', (await lojaAtual()))
      .maybeSingle();

    payload.site_config = {
      ...((atual?.site_config as Record<string, unknown>) ?? {}),
      slogan: nullIfEmpty(data.slogan),
    };
  }

  if (Object.keys(payload).length === 0) {
    return { ok: true };
  }

  const { error } = await admin
    .from('barbershops')
    .update(payload)
    .eq('id', (await lojaAtual()));

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/configuracoes');
  revalidatePath('/admin');
  revalidatePath('/cardapio');
  return { ok: true };
}

/**
 * Upload da logo para o Storage (bucket "logos") e atualizacao do cadastro.
 */
export async function uploadLogo(formData: FormData) {
  const admin = await createManagerClient();
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) return { ok: false, error: 'Nenhum arquivo enviado.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Imagem muito grande (máximo 2MB).' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Envie um arquivo de imagem (PNG, JPG, SVG ou WEBP).' };

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `barbearia/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from('logos')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (upErr) {
    const msg = upErr.message?.toLowerCase().includes('bucket')
      ? 'O bucket "logos" ainda não existe no Supabase Storage. Avise o suporte técnico.'
      : upErr.message;
    return { ok: false, error: msg };
  }

  const { data: pub } = admin.storage.from('logos').getPublicUrl(path);

  const { error } = await admin
    .from('barbershops')
    .update({ logo_url: pub.publicUrl })
    .eq('id', (await lojaAtual()));

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/configuracoes');
  return { ok: true, url: pub.publicUrl };
}