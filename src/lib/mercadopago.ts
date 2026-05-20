/**
 * Mercado Pago integration helper.
 *
 * Funciona em 2 modos:
 * - Se mp_config.enabled = false ou access_token vazio: mock (gera preference fake)
 * - Se mp_config.enabled = true e access_token preenchido: chama API real do MP
 *
 * Para ativar: salvar credenciais em /admin/configuracoes/pagamento e habilitar.
 */

import { createAdminClient } from '@/lib/supabase/admin';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const MP_API_BASE = 'https://api.mercadopago.com';

export interface MercadoPagoConfig {
  enabled?: boolean;
  public_key?: string;
  access_token?: string;
  notification_url?: string;
}

export interface MPPreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface CreatePreferenceInput {
  items: MPPreferenceItem[];
  external_reference?: string;
  payer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
}

export interface CreatePreferenceResult {
  ok: boolean;
  mocked: boolean;
  preferenceId?: string;
  initPoint?: string;
  sandboxInitPoint?: string;
  error?: string;
}

/**
 * Cria uma Preference no MP (link de pagamento) ou retorna mock.
 */
export async function createMPPreference(
  input: CreatePreferenceInput
): Promise<CreatePreferenceResult> {
  const admin = createAdminClient();

  const { data: bs } = await admin
    .from('barbershops')
    .select('mp_config')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const cfg = (bs?.mp_config ?? {}) as MercadoPagoConfig;

  // MOCK se não está configurado
  if (!cfg.enabled || !cfg.access_token) {
    const mockId = `mock_pref_${Date.now()}`;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `[MP MOCK] Preference simulada: ${mockId}, items=${input.items.length}, ref=${input.external_reference}`
      );
    }
    return {
      ok: true,
      mocked: true,
      preferenceId: mockId,
      initPoint: `https://barbearia-do-johnn.vercel.app/mock-checkout?ref=${input.external_reference ?? mockId}`,
    };
  }

  // ENVIO REAL via API MP
  try {
    const body = {
      items: input.items.map((i) => ({
        title: i.title,
        quantity: i.quantity,
        unit_price: Number(i.unit_price.toFixed(2)),
        currency_id: i.currency_id ?? 'BRL',
      })),
      external_reference: input.external_reference,
      payer: input.payer
        ? {
            name: input.payer.name,
            email: input.payer.email,
            phone: input.payer.phone
              ? { number: input.payer.phone }
              : undefined,
          }
        : undefined,
      back_urls: input.back_urls ?? {
        success: 'https://barbearia-do-johnn.vercel.app/pagamento/sucesso',
        failure: 'https://barbearia-do-johnn.vercel.app/pagamento/erro',
        pending: 'https://barbearia-do-johnn.vercel.app/pagamento/pendente',
      },
      notification_url:
        cfg.notification_url ??
        'https://barbearia-do-johnn.vercel.app/api/mp/webhook',
      auto_return: 'approved',
    };

    const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return {
        ok: false,
        mocked: false,
        error: `MP API ${response.status}: ${errBody.substring(0, 300)}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    return {
      ok: true,
      mocked: false,
      preferenceId: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Busca informação de um pagamento no MP (usado pelo webhook).
 */
export async function fetchMPPayment(paymentId: string): Promise<
  | {
      ok: true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();

  const { data: bs } = await admin
    .from('barbershops')
    .select('mp_config')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const cfg = (bs?.mp_config ?? {}) as MercadoPagoConfig;

  if (!cfg.access_token) {
    return { ok: false, error: 'MP access_token não configurado' };
  }

  try {
    const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${cfg.access_token}`,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `MP API ${response.status}`,
      };
    }

    return { ok: true, data: await response.json() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
