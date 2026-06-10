'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

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
  no_show_fee_enabled?: boolean | null;
  no_show_fee_amount?: number | null;
}

function nullIfEmpty(v?: string | null) {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function updateBarbershopSettings(data: BarbershopSettings) {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.slogan !== undefined) payload.slogan = nullIfEmpty(data.slogan);
  if (data.phone !== undefined) payload.phone = nullIfEmpty(data.phone);
  if (data.email !== undefined) payload.email = nullIfEmpty(data.email);
  if (data.address !== undefined) payload.address = nullIfEmpty(data.address);
  if (data.city !== undefined) payload.city = nullIfEmpty(data.city);
  if (data.state !== undefined) payload.state = nullIfEmpty(data.state);
  if (data.zip_code !== undefined)
    payload.zip_code = nullIfEmpty(data.zip_code);
  if (data.logo_url !== undefined)
    payload.logo_url = nullIfEmpty(data.logo_url);
  if (data.primary_color !== undefined)
    payload.primary_color = nullIfEmpty(data.primary_color);
  if (data.credit_fee_percent !== undefined && data.credit_fee_percent !== null)
    payload.credit_fee_percent = data.credit_fee_percent;
  if (data.no_show_fee_enabled !== undefined)
    payload.no_show_fee_enabled = data.no_show_fee_enabled;
  if (data.no_show_fee_amount !== undefined && data.no_show_fee_amount !== null)
    payload.no_show_fee_amount = data.no_show_fee_amount;

  if (Object.keys(payload).length === 0) {
    return { ok: true };
  }

  const { error } = await admin
    .from('barbershops')
    .update(payload)
    .eq('id', BARBERSHOP_ID);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/configuracoes');
  revalidatePath('/admin');
  revalidatePath('/cardapio');
  return { ok: true };
}
