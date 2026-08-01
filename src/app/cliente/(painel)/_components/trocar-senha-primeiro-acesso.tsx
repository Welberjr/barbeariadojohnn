'use client';

/**
 * Troca da senha no primeiro acesso.
 *
 * A barbearia entrega a mesma senha para todo mundo, para o cliente conseguir
 * entrar sem depender de e-mail nem de link. Enquanto ele nao trocar, a conta
 * dele e de quem souber o telefone: e a troca que faz aquela conta virar dele.
 *
 * Por isso a tela cobre o painel inteiro e nao tem como fechar sem trocar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

import { trocarMinhaSenhaDeCliente } from '@/app/cliente/login/actions';

export function TrocarSenhaPrimeiroAcesso({ primeiroNome }: { primeiroNome: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ver, setVer] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (senha !== repetida) {
      toast.error('As duas senhas precisam ser iguais.');
      return;
    }

    setSalvando(true);
    try {
      const res = await trocarMinhaSenhaDeCliente(senha);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Senha trocada. Agora a conta é sua.');
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-4 backdrop-blur-sm">
      <div className="card-premium w-full max-w-sm space-y-5 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1
            className="text-xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Oi, {primeiroNome}
          </h1>
          <p className="mt-2 text-xs text-fg-muted">
            Essa senha foi a barbearia que criou. Escolha uma só sua para continuar.
          </p>
        </div>

        <form method="post" onSubmit={salvar} className="space-y-4">
          <div className="space-y-2">
            <label className="label flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-gold/70" />
              <span className="text-[11px] uppercase tracking-wider">Nova senha</span>
            </label>
            <div className="relative">
              <input
                type={ver ? 'text' : 'password'}
                className="input pr-12"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Pelo menos 6 caracteres"
                autoComplete="new-password"
                minLength={6}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setVer((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle transition-colors hover:text-gold"
                tabIndex={-1}
                aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="label text-[11px] uppercase tracking-wider">Repita a senha</label>
            <input
              type={ver ? 'text' : 'password'}
              className="input"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              placeholder="A mesma de cima"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <button type="submit" disabled={salvando} className="btn-gold-shimmer w-full">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Salvar minha senha
          </button>
        </form>
      </div>
    </div>
  );
}
