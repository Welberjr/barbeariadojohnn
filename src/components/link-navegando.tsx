'use client';

/**
 * Marca visual de "estou indo" dentro de um Link.
 *
 * Vai dentro do <Link> e acende no mesmo instante do clique, antes de qualquer
 * resposta do servidor. Serve para o caso do celular em rede ruim: o esqueleto
 * da tela nova ja resolve a maior parte, mas quem clicou precisa ver o proprio
 * botao responder, senao clica de novo achando que nao pegou.
 */

import { useLinkStatus } from 'next/link';

export function LinkNavegando({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span
      className={
        pending
          ? 'contents [&_svg]:animate-pulse [&_span]:animate-pulse'
          : 'contents'
      }
    >
      {children}
    </span>
  );
}

/** Traço dourado que corre no topo enquanto a próxima tela não chega. */
export function BarraNavegando() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-full"
    >
      <span className="block h-full w-1/2 animate-[correr_0.9s_ease-in-out_infinite] bg-gold" />
    </span>
  );
}
