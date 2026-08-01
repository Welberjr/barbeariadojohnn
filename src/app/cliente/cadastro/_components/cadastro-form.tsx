'use client';

/**
 * Criar a conta do cliente.
 *
 * Quando vem por convite, os dados que a barbearia ja tem chegam preenchidos e
 * a pessoa so escolhe a senha: quanto menos ela digita, mais gente termina.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserPlus, Eye, EyeOff, Sparkles } from 'lucide-react';

import { cadastrarCliente } from '../actions';

interface Props {
  convite: {
    id: string;
    token: string;
    nome: string;
    telefone: string;
    email: string;
    visitas: number;
    pontos: number;
  } | null;
}

export function CadastroForm({ convite }: Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  const [nome, setNome] = useState(convite?.nome ?? '');
  const [telefone, setTelefone] = useState(convite?.telefone ?? '');
  const [email, setEmail] = useState(convite?.email ?? '');
  const [senha, setSenha] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    try {
      const res = await cadastrarCliente({
        nome,
        telefone,
        email,
        senha,
        clienteId: convite?.id,
        token: convite?.token,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        res.jaEraCliente
          ? 'Conta criada. Seu histórico já está aí dentro.'
          : 'Conta criada. Bem-vindo!'
      );
      router.push('/cliente/login');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form method="post" onSubmit={enviar} className="space-y-4">
      {convite && (convite.visitas > 0 || convite.pontos > 0) && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
          <p className="flex items-center gap-1.5 text-sm text-gold">
            <Sparkles className="h-4 w-4" />
            A gente já te conhece
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {convite.visitas > 0 && `${convite.visitas} atendimentos`}
            {convite.visitas > 0 && convite.pontos > 0 && ' e '}
            {convite.pontos > 0 && `${convite.pontos} pontos`} esperando por você. É só criar
            sua senha.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="label text-[11px] uppercase tracking-wider">Nome completo</label>
        <input
          type="text"
          className="input"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como você quer ser chamado"
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="label text-[11px] uppercase tracking-wider">Telefone</label>
        <input
          type="tel"
          inputMode="numeric"
          className="input"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="Com DDD"
          autoComplete="tel"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="label text-[11px] uppercase tracking-wider">E-mail</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="label text-[11px] uppercase tracking-wider">Crie uma senha</label>
        <div className="relative">
          <input
            type={verSenha ? 'text' : 'password'}
            className="input pr-12"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Pelo menos 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle transition-colors hover:text-gold"
            tabIndex={-1}
            aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button type="submit" disabled={salvando} className="btn-gold-shimmer w-full text-base">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Criar minha conta
      </button>
    </form>
  );
}
