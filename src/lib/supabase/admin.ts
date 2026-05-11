/**
 * Supabase Admin Client — usa service_role key.
 *
 * ⚠️ ATENÇÃO: NUNCA expor este cliente para o navegador.
 * Use APENAS em Server Actions, API Routes e Server Components.
 *
 * O service_role bypassa RLS, então cuidado especial é necessário.
 */
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase URL e SERVICE_ROLE_KEY são necessários para o admin client.'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
