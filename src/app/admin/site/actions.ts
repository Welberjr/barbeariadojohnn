'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface SiteConfig {
  hero_title?: string;
  hero_subtitle?: string;
  hero_cta?: string;
  about_text?: string;
  about_title?: string;
  show_hours?: boolean;
  show_gallery?: boolean;
  gallery_urls?: string[];
  instagram_url?: string;
  facebook_url?: string;
  google_maps_url?: string;
  custom_message?: string;
}

export async function updateSiteConfig(data: SiteConfig) {
  const admin = createAdminClient();

  // Limpa strings vazias
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleaned: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      cleaned[k] = trimmed.length === 0 ? null : trimmed;
    } else if (Array.isArray(v)) {
      cleaned[k] = v.filter((url) => typeof url === 'string' && url.trim().length > 0);
    } else {
      cleaned[k] = v;
    }
  }

  const { error } = await admin
    .from('barbershops')
    .update({ site_config: cleaned })
    .eq('id', BARBERSHOP_ID);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/site');
  revalidatePath('/cardapio/barbearia-do-johnn');
  revalidatePath('/cardapio');
  return { ok: true };
}
