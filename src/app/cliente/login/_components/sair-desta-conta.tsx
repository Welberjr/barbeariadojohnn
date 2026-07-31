'use client';

/**
 * Saida para quem chegou aqui logado com a conta errada.
 *
 * Sem este botao a pessoa fica olhando a tela de login enquanto o navegador
 * ainda carrega uma sessao que nao abre nada, e tentar entrar de novo com o
 * mesmo e-mail so repete o aviso.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function SairDestaConta() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await createClient().auth.signOut();
    router.replace('/cliente/login');
    router.refresh();
  }

  return (
    <button type="button" onClick={sair} disabled={saindo} className="btn-ghost mt-3 w-full text-xs">
      {saindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      Sair desta conta e entrar com outra
    </button>
  );
}
