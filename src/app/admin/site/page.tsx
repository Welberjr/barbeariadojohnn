import { createAdminClient } from '@/lib/supabase/admin';
import { Globe, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { SiteForm } from './_components/site-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Site Público',
};

export default async function SitePage() {
  const supabase = createAdminClient();

  const { data: bs } = await supabase
    .from('barbershops')
    .select('slug, name, site_config')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const cfg = (bs?.site_config ?? {}) as Record<string, unknown>;
  const slug = (bs?.slug as string) ?? 'barbearia-do-johnn';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Marketing
          </p>
          <h1
            className="text-3xl text-fg font-bold flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <Globe className="w-7 h-7 text-gold" />
            Site Público
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Personalize o cardápio público que seus clientes acessam para agendar.
          </p>
        </div>

        <Link
          href={`/cardapio/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Ver site público</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* PREVIEW URL */}
      <div className="card p-4 bg-info/5 border-info/30">
        <p className="text-xs text-fg-muted">URL do seu cardápio público:</p>
        <p className="text-sm font-mono text-fg mt-1">
          https://barbearia-do-johnn.vercel.app/cardapio/<strong>{slug}</strong>
        </p>
      </div>

      <SiteForm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultValues={cfg as any}
      />
    </div>
  );
}
