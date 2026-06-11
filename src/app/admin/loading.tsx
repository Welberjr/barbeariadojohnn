import { Loader2 } from 'lucide-react';

/**
 * Feedback imediato em toda navegação do painel:
 * evita a sensação de tela travada enquanto a página dinâmica carrega.
 */
export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3 text-fg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <p className="text-[10px] tracking-[0.3em] uppercase">Carregando...</p>
      </div>
    </div>
  );
}
