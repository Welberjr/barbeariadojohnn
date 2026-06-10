'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface WhatsAppConfig {
  enabled?: boolean;
  phone_number_id?: string;
  waba_id?: string;
  access_token?: string;
  verify_token?: string;
  webhook_url?: string;
  default_greeting?: string;
  meta_status?: string; // 'pending_verification', 'verified', 'disabled'
}

export async function updateWhatsAppConfig(data: WhatsAppConfig) {
  const admin = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleaned: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      cleaned[k] = trimmed.length === 0 ? null : trimmed;
    } else {
      cleaned[k] = v;
    }
  }

  const { error } = await admin
    .from('barbershops')
    .update({ whatsapp_config: cleaned })
    .eq('id', BARBERSHOP_ID);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/whatsapp');
  return { ok: true };
}

/**
 * Stub: testa envio (não envia de verdade, retorna sucesso simulado).
 * Real implementação dependerá da Cloud API da Meta após verificação.
 */
export async function testWhatsAppSend(_to: string, _message: string) {
  // Por enquanto: mock. Quando Meta Business estiver verificado, isso vai chamar fetch real para graph.facebook.com
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    ok: true,
    info: 'Envio simulado (mock). Integração real será habilitada após verificação Meta Business Manager.',
  };
}
