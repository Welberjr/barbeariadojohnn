import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import React from 'react';

interface MockCheckoutPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function MockCheckoutPage({ searchParams }: MockCheckoutPageProps) {
  const { ref } = await searchParams;

  return (
    <main className="min-h-screen bg-bg px-5 py-10 text-fg sm:flex sm:items-center sm:justify-center">
      <section className="card mx-auto max-w-md space-y-5 p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
          <FlaskConical className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.24em] text-gold">MERCADO PAGO</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Pagamento em modo de teste
          </h1>
          <p className="text-sm leading-6 text-fg-muted">
            Nenhuma cobrança foi realizada. Configure e ative o Mercado Pago no painel administrativo para gerar um checkout real.
          </p>
        </div>
        {ref && (
          <p className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-fg-subtle break-all">
            Referência: {ref}
          </p>
        )}
        <Link href="/" className="btn-gold-shimmer inline-flex w-full justify-center">
          Voltar para a barbearia
        </Link>
      </section>
    </main>
  );
}
