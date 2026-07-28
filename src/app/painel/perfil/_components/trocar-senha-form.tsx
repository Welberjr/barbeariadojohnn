'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';
import { trocarMinhaSenha } from '../actions';

interface TrocarSenhaFormProps {
  obrigatoria: boolean;
}

export function TrocarSenhaForm({ obrigatoria }: TrocarSenhaFormProps) {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (nova !== confirmacao) {
      toast.error('As duas senhas não são iguais.');
      return;
    }

    setSalvando(true);
    try {
      const res = await trocarMinhaSenha({
        senhaAtual: obrigatoria ? undefined : senhaAtual,
        novaSenha: nova,
      });

      if (res.ok) {
        toast.success('Senha alterada.');
        setSenhaAtual('');
        setNova('');
        setConfirmacao('');
        router.refresh();
        if (obrigatoria) router.push('/painel');
      } else {
        toast.error(res.error ?? 'Não foi possível trocar a senha.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="card p-5 space-y-4">
      <div>
        <h2
          className="text-lg font-semibold text-fg flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <KeyRound className="w-5 h-5 text-gold" />
          {obrigatoria ? 'Crie a sua senha' : 'Trocar senha'}
        </h2>
        {obrigatoria && (
          <p className="text-xs text-warn mt-1">
            Sua senha foi criada pela gestão. Escolha uma senha sua para continuar.
          </p>
        )}
      </div>

      {!obrigatoria && (
        <div>
          <label className="label">Senha atual</label>
          <input
            type="password"
            className="input"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
      )}

      <div>
        <label className="label">Nova senha</label>
        <input
          type="password"
          className="input"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-[10px] text-fg-subtle mt-1">Mínimo de 8 caracteres.</p>
      </div>

      <div>
        <label className="label">Repita a nova senha</label>
        <input
          type="password"
          className="input"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <button type="submit" disabled={salvando} className="btn-primary w-full">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        Salvar senha
      </button>
    </form>
  );
}
