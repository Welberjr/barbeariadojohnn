'use client';

/**
 * Trocar a unidade que estou vendo, sem sair da conta.
 *
 * So aparece para quem trabalha em mais de uma. Enquanto o Johnn tiver uma loja
 * so, ninguem ve este bloco e a tela continua exatamente como era.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Store, Check } from 'lucide-react';
import { trocarDeUnidade } from '@/app/admin/lojas/actions';

export interface UnidadeDoMenu {
  id: string;
  nome: string;
  atual: boolean;
}

export function TrocarUnidade({
  unidades,
  aoTrocar,
}: {
  unidades: UnidadeDoMenu[];
  aoTrocar?: () => void;
}) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();

  if (unidades.length < 2) return null;

  function trocar(u: UnidadeDoMenu) {
    if (u.atual) return;
    iniciar(async () => {
      const r = await trocarDeUnidade(u.id);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui trocar de unidade.');
        return;
      }
      aoTrocar?.();
      toast.success(`Agora você está vendo ${u.nome}.`);
      // Recarrega de verdade: agenda, caixa e equipe da tela inteira mudaram
      router.refresh();
    });
  }

  return (
    <div className="mt-1 border-t border-border/60 pt-1">
      <p className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wider text-fg-dim">
        Unidade
      </p>
      {unidades.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => trocar(u)}
          disabled={ocupado}
          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            u.atual
              ? 'text-gold'
              : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
          }`}
        >
          {u.atual ? (
            <Check className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Store className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate">{u.nome}</span>
        </button>
      ))}
    </div>
  );
}
