import Link from 'next/link';
import { Home } from 'lucide-react';

export const metadata = { title: 'Página não encontrada' };

/**
 * 404 global do app.
 * Mantém a identidade da casa: fundo escuro, dourado e a fonte Playfair,
 * com um caminho claro de volta para o início.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
      <div className="card-premium w-full max-w-md space-y-4 p-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-fg-dim">Erro 404</p>
        <h1
          className="text-3xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Página não encontrada
        </h1>
        <div className="mx-auto h-px w-16 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <p className="text-sm leading-relaxed text-fg-muted">
          O endereço que você tentou abrir não existe ou mudou de lugar.
          Ajeite o topete e volte para a cadeira: a casa continua aberta.
        </p>
        <div className="flex justify-center pt-2">
          <Link href="/" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Home className="h-4 w-4" />
            <span>Voltar para o início</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
