'use client';

/**
 * Apagar um aviso e limpar a caixa inteira.
 *
 * O apagar de um aviso e otimista: some da tela no toque e o servidor confirma
 * atras. Ninguem quer esperar meio segundo olhando para um aviso que ja mandou
 * embora.
 *
 * Limpar tudo pergunta antes, porque nao tem volta.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Loader2, X } from 'lucide-react';
import { apagarNotificacao, limparNotificacoes } from '@/app/cliente/actions';

export function ApagarNotificacao({
  id,
  onApagado,
}: {
  id: string;
  onApagado: () => void;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  function apagar() {
    onApagado();
    iniciar(async () => {
      const r = await apagarNotificacao(id);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui apagar.');
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={apagar}
      className="-m-1 flex-shrink-0 rounded-md p-1 text-fg-subtle transition-colors hover:text-danger"
      aria-label="Apagar este aviso"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function LimparTudo() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function limpar() {
    setOcupado(true);
    const r = await limparNotificacoes();
    setOcupado(false);
    setConfirmando(false);
    if (r.ok) {
      toast.success('Caixa limpa.');
      router.refresh();
    } else {
      toast.error(r.error ?? 'Não consegui limpar.');
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="btn-ghost flex items-center gap-1.5 text-xs"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>Limpar tudo</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-fg-muted">Apagar todos?</span>
      <button
        type="button"
        onClick={limpar}
        disabled={ocupado}
        className="btn-secondary text-xs text-danger"
      >
        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apagar'}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="btn-ghost text-xs"
      >
        Voltar
      </button>
    </div>
  );
}
