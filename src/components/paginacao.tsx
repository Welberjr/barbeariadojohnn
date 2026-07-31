'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paginacao de lista.
 *
 * Some quando cabe tudo em uma pagina, para nao poluir tela curta. Mostra o
 * intervalo em vez de so o numero da pagina, porque "31 a 60 de 214" responde
 * a pergunta que o gestor faz olhando a lista.
 */
interface PaginacaoProps {
  paginaAtual: number;
  totalItens: number;
  itensPorPagina: number;
  aoMudar: (pagina: number) => void;
  /** Nome do que esta sendo listado, no plural. Ex: lancamentos, clientes */
  rotulo?: string;
}

export function Paginacao({
  paginaAtual,
  totalItens,
  itensPorPagina,
  aoMudar,
  rotulo = 'itens',
}: PaginacaoProps) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
  if (totalPaginas <= 1) return null;

  const primeiro = (paginaAtual - 1) * itensPorPagina + 1;
  const ultimo = Math.min(paginaAtual * itensPorPagina, totalItens);

  // Mostra no maximo cinco numeros em volta da pagina atual
  const inicio = Math.max(1, Math.min(paginaAtual - 2, totalPaginas - 4));
  const paginas = Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => inicio + i);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-border/60">
      <p className="text-xs text-fg-muted">
        {primeiro} a {ultimo} de {totalItens} {rotulo}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => aoMudar(paginaAtual - 1)}
          disabled={paginaAtual === 1}
          className="btn-ghost p-2 disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {paginas.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => aoMudar(p)}
            className={`min-w-9 h-9 px-2 rounded-md text-xs transition-colors ${
              p === paginaAtual
                ? 'bg-gold/15 text-gold font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-bg-elevated'
            }`}
            aria-current={p === paginaAtual ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => aoMudar(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas}
          className="btn-ghost p-2 disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
