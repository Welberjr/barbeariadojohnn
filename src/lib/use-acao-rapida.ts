'use client';

/**
 * Padrao de acao com resposta imediata.
 *
 * O problema que isso resolve: antes, todo botao esperava a ida ao servidor
 * inteira (guarda de acesso, gravacao, revalidacao e recarga da tela) para so
 * entao mudar alguma coisa na tela. Sao uns dois segundos olhando para um
 * botao parado, e a sensacao de sistema travado.
 *
 * Aqui a ordem se inverte: a tela muda no clique, a gravacao acontece atras.
 * Se der errado, a tela volta ao que era e o erro aparece, entao ninguem fica
 * achando que gravou quando nao gravou.
 *
 * Uso:
 *   const { executar, ocupado } = useAcaoRapida();
 *
 *   executar({
 *     otimista: () => setStatus('confirmed'),
 *     desfazer: () => setStatus('scheduled'),
 *     acao: () => updateAppointmentStatus(id, 'confirmed'),
 *     sucesso: 'Presença confirmada',
 *   });
 */

import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export interface Resultado {
  ok: boolean;
  error?: string;
}

export interface AcaoRapida {
  /** Muda a tela agora, antes de falar com o servidor */
  otimista?: () => void;
  /** Volta a tela ao estado anterior quando a gravacao falha */
  desfazer?: () => void;
  /** A gravacao de verdade */
  acao: () => Promise<Resultado | void>;
  /** Aviso curto de sucesso. Omita quando a propria tela ja mostra o efeito */
  sucesso?: string;
  /** Chamado depois que a gravacao deu certo */
  aoConcluir?: () => void;
  /**
   * Recarrega os dados do servidor no fim. Ligado por padrao, e acontece em
   * segundo plano, sem travar a tela. Desligue quando a tela ja tem o dado.
   */
  sincronizar?: boolean;
}

export function useAcaoRapida() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [, startTransition] = useTransition();
  // Evita a mesma acao ser disparada duas vezes por clique duplo em rede ruim
  const emVoo = useRef(false);

  const executar = useCallback(
    (config: AcaoRapida) => {
      if (emVoo.current) return;
      emVoo.current = true;
      setOcupado(true);

      config.otimista?.();
      if (config.sucesso) toast.success(config.sucesso);

      // Sem await de proposito: quem chamou continua e a tela ja mudou
      config.acao()
        .then((res) => {
          if (res && res.ok === false) {
            config.desfazer?.();
            toast.error(res.error ?? 'Não foi possível concluir.');
            // A tela voltou ao estado anterior, mas o servidor manda mais que
            // a nossa suposicao: busca o estado real
            startTransition(() => router.refresh());
            return;
          }

          config.aoConcluir?.();
          if (config.sincronizar !== false) {
            startTransition(() => router.refresh());
          }
        })
        .catch(() => {
          config.desfazer?.();
          toast.error('Falha de conexão. Confira se a ação foi registrada.');
          startTransition(() => router.refresh());
        })
        .finally(() => {
          emVoo.current = false;
          setOcupado(false);
        });
    },
    [router]
  );

  return { executar, ocupado };
}
