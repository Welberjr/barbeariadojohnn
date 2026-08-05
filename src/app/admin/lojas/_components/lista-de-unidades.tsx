'use client';

/**
 * A lista de unidades e o formulario de abrir uma nova.
 *
 * Com uma unidade so, a tela nao esconde o que ainda nao existe: ela conta o
 * que muda quando a segunda for aberta. Isso e de proposito. A pergunta que o
 * Welber fez foi "onde ele cria a segunda loja?", e a resposta tem que estar
 * escrita na tela, nao so na cabeca de quem programou.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/utils';
import { Store, Plus, X, Users, UserRound, Check, Power, Loader2 } from 'lucide-react';
import {
  abrirUnidade,
  fecharUnidade,
  reabrirUnidade,
  trocarDeUnidade,
} from '../actions';

interface Unidade {
  id: string;
  nome: string;
  apelido: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  aberta: boolean;
  minha: boolean;
  atual: boolean;
  equipe: number;
  clientes: number;
  mesEmPalavras: string;
}

function endereco(u: Unidade): string {
  const partes = [
    [u.rua, u.numero].filter(Boolean).join(', '),
    u.bairro,
    [u.cidade, u.estado].filter(Boolean).join(' - '),
  ].filter(Boolean);
  return partes.join(' · ');
}

export function ListaDeUnidades({ unidades }: { unidades: Unidade[] }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const [salvando, setSalvando] = useState(false);

  const soUma = unidades.filter((u) => u.aberta).length === 1;

  function criar(form: FormData) {
    setSalvando(true);
    iniciar(async () => {
      const r = await abrirUnidade({
        nome: String(form.get('nome') ?? ''),
        telefone: String(form.get('telefone') ?? ''),
        cidade: String(form.get('cidade') ?? ''),
        estado: String(form.get('estado') ?? ''),
        bairro: String(form.get('bairro') ?? ''),
        rua: String(form.get('rua') ?? ''),
        numero: String(form.get('numero') ?? ''),
      });
      setSalvando(false);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui abrir a unidade.');
        return;
      }
      toast.success(`${r.nome} está aberta. Você já é gestor dela.`);
      setAbrindo(false);
      router.refresh();
    });
  }

  function entrar(u: Unidade) {
    iniciar(async () => {
      const r = await trocarDeUnidade(u.id);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui trocar de unidade.');
        return;
      }
      toast.success(`Agora você está vendo ${u.nome}.`);
      router.refresh();
    });
  }

  function fechar(u: Unidade) {
    iniciar(async () => {
      const r = await fecharUnidade(u.id);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui fechar.');
        return;
      }
      toast.success(`${u.nome} foi fechada. O histórico dela continua no sistema.`);
      router.refresh();
    });
  }

  function reabrir(u: Unidade) {
    iniciar(async () => {
      const r = await reabrirUnidade(u.id);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui reabrir.');
        return;
      }
      toast.success(`${u.nome} está aberta de novo.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {soUma && !abrindo && (
        <section className="card space-y-2 p-5">
          <p className="text-sm text-fg">Pensando em abrir a segunda?</p>
          <p className="text-[11px] leading-relaxed text-fg-subtle">
            Quando você abrir, cada unidade passa a ter agenda, caixa, equipe e clientes
            separados. Quem trabalha nas duas escolhe qual está vendo pelo menu, e quem
            trabalha em uma só nem percebe que existe outra. A unidade nova já nasce com o
            horário de funcionamento e as taxas desta aqui, para você só ajustar o que for
            diferente.
          </p>
        </section>
      )}

      {!abrindo ? (
        <button type="button" onClick={() => setAbrindo(true)} className="btn-gold text-sm">
          <Plus className="h-4 w-4" />
          Abrir nova unidade
        </button>
      ) : (
        <form action={criar} className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-fg">Nova unidade</p>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              className="text-fg-dim hover:text-fg"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block">
            <span className="text-[11px] text-fg-muted">Nome da unidade</span>
            <input
              name="nome"
              required
              placeholder="Barbearia do Johnn - Águas Claras"
              className="input mt-1 w-full"
            />
            <span className="mt-1 block text-[10px] text-fg-subtle">
              Coloque o bairro ou a cidade no nome: é assim que a equipe vai diferenciar uma
              da outra na hora de trocar.
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] text-fg-muted">Telefone</span>
              <input name="telefone" placeholder="(61) 90000-0000" className="input mt-1 w-full" />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Bairro</span>
              <input name="bairro" className="input mt-1 w-full" />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Rua</span>
              <input name="rua" className="input mt-1 w-full" />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Número</span>
              <input name="numero" className="input mt-1 w-full" />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Cidade</span>
              <input name="cidade" className="input mt-1 w-full" />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Estado</span>
              <input name="estado" maxLength={2} placeholder="DF" className="input mt-1 w-full" />
            </label>
          </div>

          <button type="submit" disabled={salvando} className="btn-gold w-full text-sm">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {salvando ? 'Abrindo...' : 'Abrir unidade'}
          </button>
        </form>
      )}

      <ul className="space-y-3">
        {unidades.map((u) => (
          <li
            key={u.id}
            className={`card p-5 ${u.atual ? 'border-gold/40' : ''} ${
              u.aberta ? '' : 'opacity-60'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                  <Store className="h-4 w-4 text-gold" />
                  {u.nome}
                  {u.atual && (
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">
                      você está aqui
                    </span>
                  )}
                  {!u.aberta && (
                    <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-fg-dim">
                      fechada
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-fg-subtle">
                  {endereco(u) || 'Sem endereço cadastrado'}
                  {u.telefone ? ` · ${formatPhone(u.telefone)}` : ''}
                </p>
                <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-fg-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {u.equipe} na equipe
                  </span>
                  <span className="flex items-center gap-1">
                    <UserRound className="h-3 w-3" /> {u.clientes} clientes
                  </span>
                  <span>{u.mesEmPalavras} no mês</span>
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-wrap gap-2">
                {u.aberta && u.minha && !u.atual && (
                  <button
                    type="button"
                    onClick={() => entrar(u)}
                    disabled={ocupado}
                    className="btn-gold-outline text-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Ver esta unidade
                  </button>
                )}
                {u.aberta && !u.minha && (
                  <span className="self-center text-[11px] text-fg-subtle">
                    Você não trabalha aqui
                  </span>
                )}
                {u.aberta ? (
                  <button
                    type="button"
                    onClick={() => fechar(u)}
                    disabled={ocupado}
                    className="btn-ghost text-xs"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Fechar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => reabrir(u)}
                    disabled={ocupado}
                    className="btn-secondary text-xs"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
