'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

/**
 * Error boundary do painel admin.
 * Isola erros de uma página sem derrubar o painel inteiro:
 * o usuário vê um aviso amigável e pode tentar de novo ou voltar ao dashboard.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] erro capturado pelo error boundary:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="card-premium p-8 max-w-md w-full text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2
          className="text-xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Algo deu errado nesta página
        </h2>
        <p className="text-sm text-fg-muted">
          Ocorreu um erro inesperado ao carregar esta seção. O restante do
          painel continua funcionando normalmente.
        </p>
        {error.digest && (
          <p className="text-[10px] text-fg-dim font-mono">
            Código do erro: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
          <Link
            href="/admin"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Ir para o Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
