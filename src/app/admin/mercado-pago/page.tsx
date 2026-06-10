import { createAdminClient } from '@/lib/supabase/admin';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { MPConfigForm } from './_components/mp-config-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Mercado Pago',
};

export default async function MercadoPagoPage() {
  const supabase = createAdminClient();

  const { data: bs } = await supabase
    .from('barbershops')
    .select('mp_config')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const cfg = (bs?.mp_config ?? {}) as Record<string, unknown>;
  const enabled = Boolean(cfg.enabled);
  const hasToken = Boolean(cfg.access_token);
  const ready = enabled && hasToken;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Sistema
          </p>
          <h1
            className="text-3xl text-fg font-bold flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <CreditCard className="w-7 h-7 text-gold" />
            Mercado Pago
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Configure pagamento online via PIX, cartão e boleto.
          </p>
        </div>

        <div
          className={`badge-${
            ready ? 'success' : 'gold'
          } text-[11px]`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              ready ? 'bg-success animate-pulse' : 'bg-gold'
            }`}
          />
          <span>{ready ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* STATUS */}
      <section
        className={`card p-5 border-${
          ready ? 'success' : 'gold'
        }/30 bg-${ready ? 'success' : 'gold'}/5`}
      >
        <div className="flex items-start gap-3">
          {ready ? (
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm font-semibold text-${
                ready ? 'success' : 'gold'
              }`}
            >
              {ready
                ? 'Mercado Pago configurado e ativo'
                : 'Configure credenciais para ativar pagamento online'}
            </p>
            <p className="text-xs text-fg-muted mt-1">
              {ready
                ? 'Comandas podem gerar links de pagamento via PIX/cartão. Webhook recebe confirmações automaticamente.'
                : 'Sem isso, links de pagamento são gerados em modo mock (não cobram de verdade).'}
            </p>
          </div>
        </div>
      </section>

      {/* GUIA */}
      <section className="card p-6 space-y-3">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Como configurar
        </h2>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              1
            </span>
            <div>
              <p className="text-fg font-medium">Criar conta Mercado Pago</p>
              <p className="text-[12px] text-fg-muted">
                Cadastre-se em{' '}
                <a
                  href="https://www.mercadopago.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline inline-flex items-center gap-1"
                >
                  mercadopago.com.br
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                e crie sua conta de vendedor.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              2
            </span>
            <div>
              <p className="text-fg font-medium">Acessar Painel do Desenvolvedor</p>
              <p className="text-[12px] text-fg-muted">
                No menu, vai em{' '}
                <a
                  href="https://www.mercadopago.com.br/developers/panel/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline inline-flex items-center gap-1"
                >
                  Painel do Desenvolvedor &gt; Credenciais
                  <ExternalLink className="w-3 h-3" />
                </a>
                .
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              3
            </span>
            <div>
              <p className="text-fg font-medium">Copiar credenciais de produção</p>
              <p className="text-[12px] text-fg-muted">
                Copie <strong>Public Key</strong> e <strong>Access Token</strong>{' '}
                de Produção. Cole no formulário abaixo.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              4
            </span>
            <div>
              <p className="text-fg font-medium">Configurar webhook no MP</p>
              <p className="text-[12px] text-fg-muted">
                Em <strong>Suas integrações &gt; Webhooks</strong>, cole a URL:{' '}
                <code className="text-gold font-mono text-[11px]">
                  https://barbearia-do-johnn.vercel.app/api/mp/webhook
                </code>{' '}
                e marque o evento <strong>payment</strong>.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              5
            </span>
            <div>
              <p className="text-fg font-medium">Habilitar e salvar</p>
              <p className="text-[12px] text-fg-muted">
                Marque &quot;Habilitar Mercado Pago&quot; e salve. Após isso, comandas
                podem gerar links reais que cobram via PIX/cartão.
              </p>
            </div>
          </li>
        </ol>

        <div className="pt-3 border-t border-border/40">
          <p className="text-[11px] text-fg-subtle">
            💡 <strong>Dica:</strong> Para testar antes de produção, use as
            credenciais de <strong>Sandbox</strong> do MP. Webhook funciona igual.
          </p>
        </div>
      </section>

      {/* FORM */}
      <MPConfigForm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultValues={cfg as any}
      />
    </div>
  );
}
