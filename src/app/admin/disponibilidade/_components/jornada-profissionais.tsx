'use client';

/**
 * Jornada de cada profissional.
 *
 * Um cartao por pessoa, fechado. Abre so quem vai mexer, porque o normal e
 * todo mundo seguir o horario da barbearia e ninguem precisar tocar aqui.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Clock, Loader2, ChevronDown, UtensilsCrossed } from 'lucide-react';

import { salvarJornada } from '../actions';
import {
  resumoDaJornada,
  type JornadaSimples,
} from '@/lib/jornada';

export interface ProfissionalJornada {
  id: string;
  nome: string;
  segueALoja: boolean;
  jornada: JornadaSimples;
}

function CampoHora({
  rotulo,
  valor,
  aoMudar,
  desabilitado,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
}) {
  return (
    <label className="flex-1 min-w-[110px]">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-fg-dim">
        {rotulo}
      </span>
      <input
        type="time"
        className="input"
        value={valor}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </label>
  );
}

function CartaoProfissional({ p }: { p: ProfissionalJornada }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [segueALoja, setSegueALoja] = useState(p.segueALoja);
  const [j, setJ] = useState<JornadaSimples>(p.jornada);

  const mudar = (campo: keyof JornadaSimples, valor: string | boolean) =>
    setJ((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    setSalvando(true);
    try {
      const res = await salvarJornada({ staffId: p.id, segueALoja, jornada: j });
      if (res.ok) {
        toast.success(`Jornada do ${p.nome.split(' ')[0]} salva.`);
        setAberto(false);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível salvar.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-bg-elevated"
      >
        <span className="min-w-0">
          <span className="block text-sm text-fg">{p.nome}</span>
          <span className="block text-[11px] text-fg-muted">
            {resumoDaJornada(j, segueALoja)}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${
            aberto ? 'rotate-180' : ''
          }`}
        />
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-border/40 p-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-gold"
              checked={segueALoja}
              onChange={(e) => setSegueALoja(e.target.checked)}
            />
            <span className="text-sm text-fg">Segue o horário da barbearia</span>
          </label>

          {!segueALoja && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-fg-dim">
                    Segunda a sexta
                  </p>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-gold"
                      checked={j.semanaFolga}
                      onChange={(e) => mudar('semanaFolga', e.target.checked)}
                    />
                    <span className="text-[11px] text-fg-muted">não atende</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <CampoHora
                    rotulo="Entra"
                    valor={j.semanaAbre}
                    aoMudar={(v) => mudar('semanaAbre', v)}
                    desabilitado={j.semanaFolga}
                  />
                  <CampoHora
                    rotulo="Sai"
                    valor={j.semanaFecha}
                    aoMudar={(v) => mudar('semanaFecha', v)}
                    desabilitado={j.semanaFolga}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-fg-dim">Sábado</p>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-gold"
                      checked={j.sabadoFolga}
                      onChange={(e) => mudar('sabadoFolga', e.target.checked)}
                    />
                    <span className="text-[11px] text-fg-muted">não atende</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <CampoHora
                    rotulo="Entra"
                    valor={j.sabadoAbre}
                    aoMudar={(v) => mudar('sabadoAbre', v)}
                    desabilitado={j.sabadoFolga}
                  />
                  <CampoHora
                    rotulo="Sai"
                    valor={j.sabadoFecha}
                    aoMudar={(v) => mudar('sabadoFecha', v)}
                    desabilitado={j.sabadoFolga}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-fg-dim">Domingo</p>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-gold"
                      checked={j.domingoFolga}
                      onChange={(e) => mudar('domingoFolga', e.target.checked)}
                    />
                    <span className="text-[11px] text-fg-muted">não atende</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <CampoHora
                    rotulo="Entra"
                    valor={j.domingoAbre}
                    aoMudar={(v) => mudar('domingoAbre', v)}
                    desabilitado={j.domingoFolga}
                  />
                  <CampoHora
                    rotulo="Sai"
                    valor={j.domingoFecha}
                    aoMudar={(v) => mudar('domingoFecha', v)}
                    desabilitado={j.domingoFolga}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-fg-dim">
              <UtensilsCrossed className="h-3 w-3" />
              Almoço
            </p>
            <div className="flex gap-2">
              <CampoHora
                rotulo="Para"
                valor={j.almocoInicio}
                aoMudar={(v) => mudar('almocoInicio', v)}
              />
              <CampoHora
                rotulo="Volta"
                valor={j.almocoFim}
                aoMudar={(v) => mudar('almocoFim', v)}
              />
            </div>
            <p className="text-[11px] text-fg-subtle">
              Nesse intervalo o cliente não consegue marcar com esta pessoa. Deixe em branco
              para quem não para.
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={salvar} disabled={salvando} className="btn-primary flex-1">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Salvar jornada
            </button>
            <button
              type="button"
              onClick={() => {
                setJ(p.jornada);
                setSegueALoja(p.segueALoja);
                setAberto(false);
              }}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function JornadaProfissionais({ lista }: { lista: ProfissionalJornada[] }) {
  if (lista.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-fg-muted">Nenhum profissional ativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lista.map((p) => (
        <CartaoProfissional key={p.id} p={p} />
      ))}
    </div>
  );
}
