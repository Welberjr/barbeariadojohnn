import { createAdminClient } from '@/lib/supabase/admin';
import { ConfiguracoesForm } from './_components/configuracoes-form';
import { AvisosNoCelular } from '@/components/avisos-no-celular';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Configurações',
};

export default async function ConfiguracoesPage() {
  const supabase = createAdminClient();

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
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

      {/* Avisos são por aparelho, não por barbearia: cada pessoa liga no
          celular dela. Por isso fica aqui em cima, e não dentro do formulário
          de dados da loja. */}
      <section className="card max-w-md space-y-3 p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-fg-dim">
            Avisos no celular
          </p>
          <p className="mt-1 text-[11px] text-fg-muted">
            Cliente marcando, confirmando ou cancelando pelo aplicativo toca no seu
            aparelho, mesmo com o sistema fechado.
          </p>
        </div>
        <AvisosNoCelular />
      </section>

      <ConfiguracoesForm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        barbershop={(barbershop ?? {}) as any}
      />
    </div>
  );
}
