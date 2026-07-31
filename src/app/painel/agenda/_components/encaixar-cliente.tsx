'use client';

/**
 * Encaixe de cliente na propria agenda.
 *
 * Feito para o balcao, com o cliente em pe esperando: tres passos curtos,
 * um por tela, sem rolagem. Quem chegou sem cadastro e cadastrado aqui mesmo,
 * sem sair da tela, porque mandar o barbeiro procurar a recepcao no meio do
 * atendimento e o mesmo que nao ter a funcao.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Search, UserPlus, X, ArrowLeft, Clock } from 'lucide-react';

import { buscarClienteParaEncaixe, encaixarCliente } from '../actions';
import { cadastrarClienteRapido } from '../../clientes/actions';
import { formatCurrency } from '@/lib/utils';

interface ServicoOpcao {
  id: string;
  nome: string;
  preco: number;
  minutos: number;
}

interface ClienteOpcao {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Props {
  /** Dia que a agenda está mostrando, no formato AAAA-MM-DD */
  data: string;
  servicos: ServicoOpcao[];
}

/** Horário de São Paulo agora, em HH:MM, arredondado para os próximos 5 minutos. */
function horaAgora(): string {
  const agora = new Date(Date.now() + 60000); // um minuto de folga
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora);
  return texto;
}

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date()
  );
}

export function EncaixarCliente({ data, servicos }: Props) {
  const router = useRouter();

  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<'cliente' | 'servico' | 'hora'>('cliente');
  const [ocupado, setOcupado] = useState(false);

  // Passo 1 · cliente
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [achados, setAchados] = useState<ClienteOpcao[]>([]);
  const [cliente, setCliente] = useState<ClienteOpcao | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [telefoneNovo, setTelefoneNovo] = useState('');

  // Passo 2 · serviço
  const [servico, setServico] = useState<ServicoOpcao | null>(null);

  // Passo 3 · horário
  const [hora, setHora] = useState(horaAgora());

  const ehHoje = data === hojeEmSaoPaulo();

  function fechar() {
    setAberto(false);
    setPasso('cliente');
    setTermo('');
    setAchados([]);
    setCliente(null);
    setServico(null);
    setCadastrando(false);
    setNomeNovo('');
    setTelefoneNovo('');
    setHora(horaAgora());
  }

  async function buscar(valor: string) {
    setTermo(valor);
    setCadastrando(false);
    if (valor.trim().length < 3) {
      setAchados([]);
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarClienteParaEncaixe(valor);
      setAchados(res.ok ? res.clientes : []);
      if (!res.ok) toast.error(res.error);
    } finally {
      setBuscando(false);
    }
  }

  function escolherCliente(c: ClienteOpcao) {
    setCliente(c);
    setPasso('servico');
  }

  /** Abre o cadastro já com o que ele digitou na busca no campo certo. */
  function abrirCadastro() {
    const digitado = termo.trim();
    const soDigitos = digitado.replace(/\D/g, '');
    if (soDigitos.length >= 8 && soDigitos.length === digitado.replace(/\s/g, '').length) {
      setTelefoneNovo(digitado);
      setNomeNovo('');
    } else {
      setNomeNovo(digitado);
      setTelefoneNovo('');
    }
    setCadastrando(true);
  }

  async function cadastrar() {
    setOcupado(true);
    try {
      const res = await cadastrarClienteRapido({ nome: nomeNovo, telefone: telefoneNovo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.jaExistia
          ? `${res.cliente.full_name} já era cliente. Usando o cadastro dele.`
          : 'Cliente cadastrado.'
      );
      escolherCliente(res.cliente);
      setCadastrando(false);
    } finally {
      setOcupado(false);
    }
  }

  async function encaixar() {
    if (!cliente || !servico) return;

    // A agenda trabalha em horário de Brasília. O -03:00 aqui é o que garante
    // que o encaixe cai na hora que ele digitou, e não na hora do celular.
    const inicioIso = `${data}T${hora}:00.000-03:00`;

    setOcupado(true);
    try {
      const res = await encaixarCliente({
        customerId: cliente.id,
        serviceId: servico.id,
        inicioIso,
      });

      if (res.ok) {
        toast.success(`${cliente.full_name.split(' ')[0]} encaixado às ${hora}.`);
        fechar();
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível encaixar.');
      }
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-primary w-full">
        <Plus className="w-4 h-4" />
        Encaixar cliente na minha agenda
      </button>
    );
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {passo !== 'cliente' && (
            <button
              type="button"
              onClick={() => setPasso(passo === 'hora' ? 'servico' : 'cliente')}
              className="text-fg-muted hover:text-fg"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <p className="text-sm font-medium text-fg truncate">
            {passo === 'cliente' && 'Quem é o cliente?'}
            {passo === 'servico' && `O que o ${cliente?.full_name.split(' ')[0]} vai fazer?`}
            {passo === 'hora' && 'Que horas?'}
          </p>
        </div>

        <button
          type="button"
          onClick={fechar}
          className="text-fg-muted hover:text-fg"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Passo 1 · cliente ─────────────────────────────────────────── */}
      {passo === 'cliente' && !cadastrando && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-fg-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Nome ou telefone"
              value={termo}
              onChange={(e) => buscar(e.target.value)}
              autoFocus
            />
          </div>

          {buscando && <p className="text-xs text-fg-dim">Procurando...</p>}

          <div className="space-y-2">
            {achados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => escolherCliente(c)}
                className="w-full text-left p-3 rounded-md border border-border hover:border-gold/40 transition-colors"
              >
                <span className="block text-sm text-fg">{c.full_name}</span>
                {c.phone && <span className="block text-xs text-fg-muted">{c.phone}</span>}
              </button>
            ))}
          </div>

          <button type="button" onClick={abrirCadastro} className="btn-gold-outline w-full text-xs">
            <UserPlus className="w-4 h-4" />
            {termo.trim().length >= 3 && achados.length === 0 && !buscando
              ? 'Não achei. Cadastrar cliente novo'
              : 'Cadastrar cliente novo'}
          </button>
        </>
      )}

      {/* ── Passo 1b · cadastro rápido ────────────────────────────────── */}
      {passo === 'cliente' && cadastrando && (
        <div className="space-y-3">
          <input
            type="text"
            className="input"
            placeholder="Nome do cliente"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            autoFocus
          />
          <input
            type="tel"
            inputMode="numeric"
            className="input"
            placeholder="Telefone com DDD"
            value={telefoneNovo}
            onChange={(e) => setTelefoneNovo(e.target.value)}
          />
          <p className="text-[11px] text-fg-subtle">
            O telefone é o que permite chamar o cliente de volta depois. A gestão completa o
            resto da ficha quando precisar.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={cadastrar}
              disabled={ocupado || nomeNovo.trim().length < 3}
              className="btn-primary flex-1"
            >
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Cadastrar
            </button>
            <button
              type="button"
              onClick={() => setCadastrando(false)}
              className="btn-secondary flex-1"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* ── Passo 2 · serviço ─────────────────────────────────────────── */}
      {passo === 'servico' && (
        <div className="space-y-2">
          {servicos.length === 0 && (
            <p className="text-xs text-fg-muted">Nenhum serviço cadastrado.</p>
          )}
          {servicos.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServico(s);
                setPasso('hora');
              }}
              className="w-full text-left p-3 rounded-md border border-border hover:border-gold/40 transition-colors flex items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="block text-sm text-fg truncate">{s.nome}</span>
                <span className="block text-xs text-fg-muted">{s.minutos} min</span>
              </span>
              <span className="text-sm text-gold shrink-0">{formatCurrency(s.preco)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Passo 3 · horário ─────────────────────────────────────────── */}
      {passo === 'hora' && cliente && servico && (
        <div className="space-y-3">
          <div className="p-3 rounded-md border border-border">
            <p className="text-sm text-fg">{cliente.full_name}</p>
            <p className="text-xs text-fg-muted">
              {servico.nome} · {servico.minutos} min · {formatCurrency(servico.preco)}
            </p>
          </div>

          {ehHoje && (
            <button
              type="button"
              onClick={() => setHora(horaAgora())}
              className="btn-secondary w-full text-xs"
            >
              <Clock className="w-4 h-4" />
              Começar agora
            </button>
          )}

          <div>
            <label className="block text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-2">
              Horário
            </label>
            <input
              type="time"
              className="input"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={encaixar}
            disabled={ocupado || !hora}
            className="btn-primary w-full"
          >
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Encaixar às {hora}
          </button>
        </div>
      )}
    </section>
  );
}
