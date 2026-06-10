import { createAdminClient } from '@/lib/supabase/admin';
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { WhatsAppForm } from './_components/whatsapp-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'WhatsApp',
};

export default async function WhatsAppPage() {
  const supabase = createAdminClient();

  const { data: bs } = await supabase
    .from('barbershops')
    .select('whatsapp_config')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const cfg = (bs?.whatsapp_config ?? {}) as Record<string, unknown>;
  const enabled = Boolean(cfg.enabled);
  const status = (cfg.meta_status as string) ?? 'not_started';

  const statusInfo = (() => {
    switch (status) {
      case 'verified':
        return {
          label: 'Verificado',
          color: 'success',
          icon: CheckCircle2,
          description:
            'Sua conta Meta Business está verificada. Envios automáticos estão habilitados.',
        };
      case 'pending_verification':
        return {
          label: 'Em verificação',
          color: 'warning',
          icon: Clock,
          description:
            'Aguardando aprovação da Meta. Prazo típico: 5-7 dias úteis. Você receberá email quando aprovado.',
        };
      case 'disabled':
        return {
          label: 'Desabilitado',
          color: 'fg-subtle',
          icon: AlertTriangle,
          description:
            'Verificação Meta foi rejeitada ou desabilitada. Tente novamente ou contate o suporte.',
        };
      default:
        return {
          label: 'Não iniciado',
          color: 'fg-subtle',
          icon: AlertTriangle,
          description:
            'Configure suas credenciais Meta Business Manager abaixo e inicie a verificação.',
        };
    }
  })();

  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
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
            <MessageSquare className="w-7 h-7 text-gold" />
            WhatsApp
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Envie lembretes automáticos, confirmações e promoções via WhatsApp.
          </p>
        </div>

        <div
          className={`badge-${
            enabled ? 'success' : 'gold'
          } text-[11px]`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              enabled ? 'bg-success animate-pulse' : 'bg-gold'
            }`}
          />
          <span>{enabled ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* STATUS */}
      <section
        className={`card p-5 border-${statusInfo.color}/30 bg-${statusInfo.color}/5`}
      >
        <div className="flex items-start gap-3">
          <StatusIcon className={`w-5 h-5 text-${statusInfo.color} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <p
              className={`text-sm font-semibold text-${statusInfo.color}`}
            >
              Status Meta Business: {statusInfo.label}
            </p>
            <p className="text-xs text-fg-muted mt-1">
              {statusInfo.description}
            </p>
          </div>
        </div>
      </section>

      {/* PASSO A PASSO META */}
      <section className="card p-6 space-y-3">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Como começar
        </h2>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              1
            </span>
            <div>
              <p className="text-fg font-medium">
                Criar conta Meta Business Manager
              </p>
              <p className="text-[12px] text-fg-muted">
                Cadastre-se gratuitamente em{' '}
                <a
                  href="https://business.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline inline-flex items-center gap-1"
                >
                  business.facebook.com
                  <ExternalLink className="w-3 h-3" />
                </a>
                .
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              2
            </span>
            <div>
              <p className="text-fg font-medium">
                Configurar conta WhatsApp Business
              </p>
              <p className="text-[12px] text-fg-muted">
                No painel da Meta, ative o WhatsApp Business Platform e crie sua conta WABA (WhatsApp Business Account).
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              3
            </span>
            <div>
              <p className="text-fg font-medium">
                Gerar credenciais (tokens e IDs)
              </p>
              <p className="text-[12px] text-fg-muted">
                Pegue o <strong>Phone Number ID</strong>, <strong>WABA ID</strong>, <strong>Access Token</strong> e configure um <strong>Verify Token</strong> personalizado.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              4
            </span>
            <div>
              <p className="text-fg font-medium">
                Aguardar verificação (5-7 dias úteis)
              </p>
              <p className="text-[12px] text-fg-muted">
                A Meta verifica seu negócio antes de liberar envios. Documentos do CNPJ podem ser solicitados.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
              5
            </span>
            <div>
              <p className="text-fg font-medium">
                Configurar webhook no painel da Meta
              </p>
              <p className="text-[12px] text-fg-muted">
                Use a URL gerada por nós (configurada abaixo) para receber respostas automaticamente.
              </p>
            </div>
          </li>
        </ol>

        <div className="pt-3 border-t border-border/40">
          <p className="text-[11px] text-fg-subtle">
            💡 <strong>Dica:</strong> A integração só fica 100% funcional após Meta verificar sua conta. Antes disso, você pode salvar as credenciais aqui para que tudo funcione no momento da aprovação.
          </p>
        </div>
      </section>

      {/* FORM DE CONFIG */}
      <WhatsAppForm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultValues={cfg as any}
      />
    </div>
  );
}
