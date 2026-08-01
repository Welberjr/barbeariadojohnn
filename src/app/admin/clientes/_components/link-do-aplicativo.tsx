'use client';

/**
 * Botao que copia o link de cadastro do aplicativo.
 *
 * Era um cartao inteiro no meio da tela, com link a mostra e dois botoes. Para
 * uma acao de um clique, aquilo so ocupava espaco e empurrava a lista de
 * clientes para baixo. Virou um botao ao lado do "novo cliente", que e onde a
 * mao ja esta.
 *
 * O link e o mesmo para todos: quem ja e cliente digita o telefone e a ficha
 * dele e reconhecida. Assinante nao entra por telefone, porque ai assumir a
 * ficha de outro daria acesso ao plano que a pessoa paga: esses a barbearia
 * convida pela ficha de cada um.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Check } from 'lucide-react';

interface Props {
  link: string;
  nomeBarbearia: string;
}

export function LinkDoAplicativo({ link, nomeBarbearia }: Props) {
  const [copiou, setCopiou] = useState(false);

  const mensagem =
    `A ${nomeBarbearia} agora tem aplicativo! ` +
    `Marque seu horário sozinho, acompanhe seus pontos e veja seu histórico. ` +
    `Crie sua conta aqui, leva um minuto: ${link}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiou(true);
      toast.success('Mensagem com o link copiada. É só colar no WhatsApp.');
      setTimeout(() => setCopiou(false), 2500);
    } catch {
      // Sem area de transferencia, o link ainda precisa chegar em alguem
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.error('Não consegui copiar. O link é: ' + link);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="btn-secondary text-sm"
      title="Copia a mensagem com o link de cadastro, pronta para mandar no WhatsApp"
    >
      {copiou ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      <span>Link de cadastro</span>
    </button>
  );
}
