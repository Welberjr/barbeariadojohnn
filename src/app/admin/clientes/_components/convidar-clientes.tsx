'use client';

/**
 * Convidar cliente para criar a conta dele.
 *
 * A barbearia tem centenas de clientes com historico, pontos e assinatura, e
 * nenhum deles tem login. Este e o caminho para eles entrarem: cada um recebe o
 * link dele, cria a senha e ja encontra o proprio historico do outro lado.
 *
 * O link e por pessoa de proposito. Um link solto ligaria a conta pelo telefone
 * digitado, e telefone nao e segredo: quem soubesse o numero de um cliente
 * entraria na ficha dele, veria o historico e usaria a assinatura que ele paga.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Check, MessageCircle, Copy } from 'lucide-react';
import { normalizarTelefone } from '@/lib/telefone';

interface Props {
  clienteId: string;
  nome: string;
  telefone: string | null;
  /** Link pronto, assinado no servidor */
  link: string;
  mensagem: string;
}

export function ConvidarCliente({ nome, telefone, link, mensagem }: Props) {
  const [copiou, setCopiou] = useState<'link' | 'mensagem' | null>(null);

  async function copiar(texto: string, qual: 'link' | 'mensagem') {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiou(qual);
      toast.success(qual === 'link' ? 'Link copiado.' : 'Mensagem copiada.');
      setTimeout(() => setCopiou(null), 2500);
    } catch {
      toast.error('Não consegui copiar. Selecione e copie na mão.');
    }
  }

  // A forma canonica devolve o celular COM o nono digito, mesmo quando o
  // cadastro veio do sistema antigo sem ele. Sem isso o convite ia para um
  // numero de oito casas que nao existe mais.
  const numero = normalizarTelefone(telefone ?? '') ?? '';
  const zap = numero
    ? `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`
    : null;

  return (
    <section className="card space-y-3 p-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-fg-dim">Aplicativo</p>
        <p className="mt-1 text-sm text-fg-muted">
          Mande o link para {nome.split(' ')[0]} criar a conta. Entrando por ele, o histórico e os
          pontos que já são dele aparecem no primeiro acesso.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {zap ? (
          <a href={zap} target="_blank" rel="noreferrer" className="btn-gold-outline flex-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            Mandar no WhatsApp
          </a>
        ) : (
          <span className="flex-1 self-center text-[11px] text-fg-dim">
            Sem telefone cadastrado para mandar direto
          </span>
        )}

        <button
          type="button"
          onClick={() => copiar(mensagem, 'mensagem')}
          className="btn-secondary flex-1 text-xs"
        >
          {copiou === 'mensagem' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar mensagem
        </button>
      </div>

      <button
        type="button"
        onClick={() => copiar(link, 'link')}
        className="btn-ghost w-full text-xs"
        title={link}
      >
        {copiou === 'link' ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        Copiar só o link
      </button>

      <p className="text-[11px] text-fg-subtle">
        O link é só desta pessoa. Não repasse para outro cliente: ele abre a ficha dela.
      </p>
    </section>
  );
}
