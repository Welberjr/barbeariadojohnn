'use client';

/**
 * Sino do painel do barbeiro.
 *
 * Mostra o que mexeu no dia dele: cliente novo na agenda, horario desmarcado,
 * vale respondido e comanda que ficou aberta. Nao mostra nada dos colegas.
 *
 * O que ele ja viu fica marcado no proprio aparelho. Marcar no banco exigiria
 * uma tabela nova e uma escrita a cada toque, para resolver uma pergunta que e
 * do aparelho mesmo: "eu ja olhei isso aqui?".
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Calendar, CalendarX, Wallet, ClipboardList, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Aviso {
  tipo: 'agendamento' | 'cancelamento' | 'vale' | 'comanda';
  cor: 'info' | 'ouro' | 'perigo';
  titulo: string;
  detalhe: string;
  href: string;
}

const CHAVE_VISTO = 'bj_sino_painel_visto_em';

const ICONES = {
  agendamento: Calendar,
  cancelamento: CalendarX,
  vale: Wallet,
  comanda: ClipboardList,
} as const;

const CORES = {
  info: 'text-info bg-info/10',
  ouro: 'text-gold bg-gold/10',
  perigo: 'text-danger bg-danger/10',
} as const;

export function SinoDoPainel() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const visto = localStorage.getItem(CHAVE_VISTO);
      const res = await fetch(
        `/api/painel/notificacoes${visto ? `?desde=${encodeURIComponent(visto)}` : ''}`
      );
      if (!res.ok) throw new Error('falhou');
      const dados = (await res.json()) as { avisos: Aviso[] };
      setAvisos(dados.avisos ?? []);
    } catch {
      // Sem alarde: o sino apenas fica sem contador
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo) {
      carregar();
    } else {
      // Marca ao fechar: quem abriu e leu ja viu
      localStorage.setItem(CHAVE_VISTO, new Date().toISOString());
    }
  }

  function ir(href: string) {
    setAberto(false);
    localStorage.setItem(CHAVE_VISTO, new Date().toISOString());
    router.push(href);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alternar}
        className="relative rounded-md p-2 text-fg-muted transition-colors hover:bg-bg-elevated hover:text-gold"
        aria-label="Avisos"
      >
        <Bell className="h-4 w-4" />
        {avisos.length > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={alternar} />
          <div className="card-premium absolute right-0 top-full z-50 mt-2 w-72 animate-fade-in p-2">
            <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-fg-dim">
              Avisos
            </p>

            {carregando && avisos.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" />
              </div>
            ) : avisos.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-fg-subtle">
                Nada novo por aqui.
              </p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {avisos.map((aviso, i) => {
                  const Icone = ICONES[aviso.tipo];
                  return (
                    <li key={`${aviso.tipo}-${i}`}>
                      <button
                        type="button"
                        onClick={() => ir(aviso.href)}
                        className="flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-bg-elevated"
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md',
                            CORES[aviso.cor]
                          )}
                        >
                          <Icone className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-fg">
                            {aviso.titulo}
                          </span>
                          <span className="block text-[11px] text-fg-subtle">
                            {aviso.detalhe}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
