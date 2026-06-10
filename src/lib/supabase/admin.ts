/**
 * Supabase Admin Client -- usa service_role key.
 *
 * ATENCAO: NUNCA expor este cliente para o navegador.
 * Use APENAS em Server Actions, API Routes e Server Components.
 *
 * O service_role bypassa RLS, entao cuidado especial e necessario.
 */
import { createClient } from '@supabase/supabase-js';

function stripBOM(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/^\uFEFF/, '').trim();
}

export function createAdminClient() {
  const url = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = stripBOM(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase URL e SERVICE_ROLE_KEY sao necessarios para o admin client.'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}