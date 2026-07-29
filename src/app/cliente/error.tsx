'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

export default function ClienteError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('Erro na área do cliente:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-center">
      <div className="card-premium max-w-sm space-y-4 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Área do cliente</p>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Vamos atualizar esta página
        </h1>
        <p className="text-sm leading-relaxed text-fg-muted">
          Não foi possível carregar esta página por completo. Atualize para tentar novamente; isso também resolve quando uma versão nova acaba de ser publicada.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-gold-shimmer flex w-full items-center justify-center gap-2 py-3"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar agora
        </button>
        <Link href="/cliente" className="block text-xs font-medium text-gold hover:underline">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
