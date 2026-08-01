'use client';

/**
 * O link unico do aplicativo, para divulgar de uma vez.
 *
 * Mandar convite um a um para 400 clientes nao acontece na vida real. Este link
 * serve para todo mundo: vai no status do WhatsApp, na descricao do Instagram,
 * num QR code no balcao. Quem entra por ele digita o telefone, e o sistema
 * reconhece a ficha que ja existe.
 *
 * Quem tem assinatura ativa nao e reconhecido por telefone, porque ai assumir a
 * ficha de outro daria acesso ao plano que a pessoa paga. Para esses, o convite
 * individual continua na ficha de cada um.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, Copy, Check, MessageCircle } from 'lucide-react';

interface Props {
  link: string;
  nomeBarbearia: string;
  /** Quantos clientes precisam de convite individual por serem assinantes */
  assinantes: number;
}

export function LinkDoAplicativo({ link, nomeBarbearia, assinantes }: Props) {
  const [copiou, setCopiou] = useState<'link' | 'texto' | null>(null);

  const texto =
    `A ${nomeBarbearia} agora tem aplicativo! ` +
    `Marque seu horário sozinho, acompanhe seus pontos e veja seu histórico. ` +
    `Crie sua conta aqui, leva um minuto: ${link}`;

  async function copiar(valor: string, qual: 'link' | 'texto') {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiou(qual);
      toast.success(qual === 'link' ? 'Link copiado.' : 'Mensagem copiada.');
      setTimeout(() => setCopiou(null), 2500);
    } catch {
      toast.error('Não consegui copiar. Selecione e copie na mão.');
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Link do aplicativo</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Um link só, para mandar no grupo, no status ou colocar num QR code no balcão. Quem
            já é cliente digita o telefone e o histórico dele aparece junto.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg-elevated/60 px-3 py-2">
        <p className="break-all font-mono text-[11px] text-fg-muted">{link}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copiar(texto, 'texto')}
          className="btn-gold-outline flex-1 text-xs"
        >
          {copiou === 'texto' ? <Check className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
          Copiar mensagem pronta
        </button>
        <button
          type="button"
          onClick={() => copiar(link, 'link')}
          className="btn-secondary flex-1 text-xs"
        >
          {copiou === 'link' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar só o link
        </button>
      </div>

      {assinantes > 0 && (
        <p className="text-[11px] text-fg-subtle">
          {assinantes} {assinantes === 1 ? 'cliente assinante precisa' : 'clientes assinantes precisam'}{' '}
          de convite individual, na ficha de cada um: por telefone o sistema não libera acesso a
          plano que alguém paga.
        </p>
      )}
    </section>
  );
}
