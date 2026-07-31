'use client';

/**
 * Botao de confirmar presenca.
 *
 * Responde na hora e so depois fala com o servidor: o cliente esta com o
 * celular na mao, muitas vezes na rua, e um botao que fica pensando parece
 * quebrado. Se a gravacao falhar, o botao volta e o aviso explica.
 */

import { useState } from 'react';
import { CheckCheck, Check } from 'lucide-react';
import { confirmarPresenca } from '@/app/cliente/actions';
import { useAcaoRapida } from '@/lib/use-acao-rapida';

interface Props {
  appointmentId: string;
  jaConfirmou: boolean;
}

export function ConfirmarPresenca({ appointmentId, jaConfirmou }: Props) {
  const [confirmado, setConfirmado] = useState(jaConfirmou);
  const { executar, ocupado } = useAcaoRapida();

  if (confirmado) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] text-success">
        <CheckCheck className="h-3.5 w-3.5" />
        Presença confirmada
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        executar({
          otimista: () => setConfirmado(true),
          desfazer: () => setConfirmado(false),
          acao: () => confirmarPresenca(appointmentId),
          sucesso: 'Presença confirmada. Até já!',
        })
      }
      disabled={ocupado}
      className="btn-primary w-full text-xs"
    >
      <Check className="h-3.5 w-3.5" />
      Confirmar que eu vou
    </button>
  );
}
