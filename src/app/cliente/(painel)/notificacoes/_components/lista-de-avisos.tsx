'use client';

/**
 * A lista de avisos do cliente.
 *
 * Fica do lado do navegador so por causa do apagar: o aviso precisa sumir no
 * toque, sem esperar a volta do servidor. O resto continua vindo pronto de la.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ApagarNotificacao } from './acoes-notificacao';

export interface Aviso {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

function quando(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function ListaDeAvisos({ avisos }: { avisos: Aviso[] }) {
  const [apagados, setApagados] = useState<string[]>([]);

  // A lista de verdade chegou: o que era suposicao ja virou fato
  const chave = avisos.map((a) => a.id).join(',');
  useEffect(() => {
    setApagados([]);
  }, [chave]);

  const naTela = avisos.filter((a) => !apagados.includes(a.id));

  return (
    <div className="space-y-2">
      {naTela.map((aviso) => (
        <div
          key={aviso.id}
          className={cn('card p-4', !aviso.read_at && 'border-gold/30')}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-fg">{aviso.title}</p>
            <div className="flex flex-shrink-0 items-center gap-2">
              {!aviso.read_at && (
                <span className="mt-1.5 h-2 w-2 rounded-full bg-gold" />
              )}
              <ApagarNotificacao
                id={aviso.id}
                onApagado={() => setApagados((atual) => [...atual, aviso.id])}
              />
            </div>
          </div>
          <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-fg-muted">
            {aviso.body}
          </p>
          <p className="mt-1.5 text-[10px] text-fg-dim">{quando(aviso.created_at)}</p>
        </div>
      ))}
    </div>
  );
}
