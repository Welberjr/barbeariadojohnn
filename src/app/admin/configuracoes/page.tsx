import { createClient } from '@/lib/supabase/server';
import { ConfiguracoesForm } from './_components/configuracoes-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Configurações',
};

export default async function ConfiguracoesPage() {
  const supabase = await createClient();

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          Sistema
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Configurações
        </h1>
        <p className="text-sm text-fg-muted mt-2">
          Dados da barbearia, identidade visual e regras gerais.
        </p>
      </div>

      <div className="divider-gold" />

      <ConfiguracoesForm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        barbershop={(barbershop ?? {}) as any}
      />
    </div>
  );
}
