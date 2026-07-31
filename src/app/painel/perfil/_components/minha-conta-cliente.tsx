'use client';

/**
 * Um login, dois lados do balcao.
 *
 * Quem trabalha aqui tambem corta cabelo aqui. Em vez de dois cadastros e duas
 * senhas, o mesmo e-mail abre as duas portas: o painel de trabalho e a conta de
 * cliente, com os pontos, a assinatura e o historico de quem foi atendido.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserRound, ArrowRight } from 'lucide-react';

import { ativarMinhaContaDeCliente } from '../actions';

interface Props {
  /** Nome na ficha de cliente, quando ela já existe ligada a este login */
  nomeCliente: string | null;
  telefoneSugerido: string | null;
}

export function MinhaContaCliente({ nomeCliente, telefoneSugerido }: Props) {
  const router = useRouter();
  const [ligando, setLigando] = useState(false);
  const [abrindoForm, setAbrindoForm] = useState(false);
  const [telefone, setTelefone] = useState(telefoneSugerido ?? '');

  async function ativar() {
    setLigando(true);
    try {
      const res = await ativarMinhaContaDeCliente({ telefone });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Pronto. Este login também é a sua conta de cliente.');
      setAbrindoForm(false);
      router.refresh();
    } finally {
      setLigando(false);
    }
  }

  if (nomeCliente) {
    return (
      <section className="card p-5 space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">
          Quando você é o cliente
        </p>
        <p className="text-sm text-fg-muted">
          Este mesmo login é a sua conta de cliente, como{' '}
          <span className="text-fg">{nomeCliente}</span>. Quando um colega atender você, o
          atendimento entra aí, com os seus pontos e a sua assinatura.
        </p>
        <Link href="/cliente" className="btn-gold-outline w-full text-xs">
          <UserRound className="w-4 h-4" />
          Abrir minha conta de cliente
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    );
  }

  return (
    <section className="card p-5 space-y-3">
      <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">
        Quando você é o cliente
      </p>
      <p className="text-sm text-fg-muted">
        Você também corta o cabelo aqui? Ligue a sua ficha de cliente a este login e use o
        mesmo e-mail para os dois lados, sem segunda senha.
      </p>

      {!abrindoForm ? (
        <button
          type="button"
          onClick={() => setAbrindoForm(true)}
          className="btn-secondary w-full text-xs"
        >
          <UserRound className="w-4 h-4" />
          Também sou cliente aqui
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="tel"
            inputMode="numeric"
            className="input"
            placeholder="Seu telefone com DDD"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-fg-subtle">
            Se você já tem ficha aqui, o telefone acha ela e o seu histórico vem junto.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={ativar}
              disabled={ligando}
              className="btn-primary flex-1"
            >
              {ligando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserRound className="w-4 h-4" />
              )}
              Ligar minha ficha
            </button>
            <button
              type="button"
              onClick={() => setAbrindoForm(false)}
              className="btn-secondary flex-1"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
