'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Search, X, UserPlus } from 'lucide-react';
import { abrirMinhaComanda } from '../actions';
import { buscarClienteParaComanda } from '../buscar-actions';
import { cadastrarClienteRapido } from '../../clientes/actions';

interface AbrirComandaBotaoProps {
  appointmentId?: string;
  variante?: 'agendamento' | 'avulsa';
  rotulo?: string;
  icone?: React.ReactNode;
}

export function AbrirComandaBotao({
  appointmentId,
  variante = 'agendamento',
  rotulo = 'Abrir comanda',
  icone,
}: AbrirComandaBotaoProps) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [clientes, setClientes] = useState<
    Array<{ id: string; full_name: string; phone: string | null }>
  >([]);
  const [cadastrando, setCadastrando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [telefoneNovo, setTelefoneNovo] = useState('');

  /** Cliente que chegou sem cadastro: nasce aqui e a comanda abre em seguida. */
  async function cadastrarEAbrir() {
    setAbrindo(true);
    try {
      const res = await cadastrarClienteRapido({ nome: nomeNovo, telefone: telefoneNovo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.jaExistia) {
        toast.success(`${res.cliente.full_name} já era cliente. Abrindo a comanda dele.`);
      }
      await abrir(res.cliente.id);
    } finally {
      setAbrindo(false);
    }
  }

  async function abrir(customerId?: string) {
    setAbrindo(true);
    try {
      const res = await abrirMinhaComanda({ appointmentId, customerId });
      if (res.ok && res.comandaId) {
        router.push(`/painel/comandas/${res.comandaId}`);
      } else {
        toast.error(res.error ?? 'Não foi possível abrir a comanda.');
      }
    } finally {
      setAbrindo(false);
    }
  }

  async function buscar(valor: string) {
    setTermo(valor);
    if (valor.trim().length < 3) {
      setClientes([]);
      return;
    }
    setBuscando(true);
    try {
      const res = await buscarClienteParaComanda(valor);
      setClientes(res.ok ? res.clientes : []);
      if (!res.ok) toast.error(res.error);
    } finally {
      setBuscando(false);
    }
  }

  if (variante === 'agendamento') {
    return (
      <button
        type="button"
        onClick={() => abrir()}
        disabled={abrindo}
        className="btn-gold-outline text-xs shrink-0"
      >
        {abrindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Abrir comanda
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {!painelAberto ? (
        <button
          type="button"
          onClick={() => setPainelAberto(true)}
          className="btn-primary w-full"
        >
          {icone ?? <Plus className="w-4 h-4" />}
          {rotulo}
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-fg">Escolha o cliente</p>
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              className="text-fg-muted hover:text-fg"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-fg-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Nome ou telefone"
              value={termo}
              onChange={(e) => buscar(e.target.value)}
            />
          </div>

          {buscando && <p className="text-xs text-fg-dim">Procurando...</p>}

          <div className="space-y-2">
            {clientes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrir(c.id)}
                disabled={abrindo}
                className="w-full text-left p-3 rounded-md border border-border hover:border-gold/40 transition-colors"
              >
                <span className="block text-sm text-fg">{c.full_name}</span>
                {c.phone && <span className="block text-xs text-fg-muted">{c.phone}</span>}
              </button>
            ))}
          </div>

          {/* Cliente novo, cadastrado na hora pelo próprio barbeiro */}
          {!cadastrando ? (
            <button
              type="button"
              onClick={() => {
                setNomeNovo(termo.trim().replace(/\d/g, '').trim());
                setTelefoneNovo('');
                setCadastrando(true);
              }}
              className="btn-gold-outline w-full text-xs"
            >
              <UserPlus className="w-4 h-4" />
              {termo.trim().length >= 3 && clientes.length === 0 && !buscando
                ? 'Não achei. Cadastrar cliente novo'
                : 'Cadastrar cliente novo'}
            </button>
          ) : (
            <div className="space-y-3 pt-1">
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cadastrarEAbrir}
                  disabled={abrindo || nomeNovo.trim().length < 3}
                  className="btn-primary flex-1"
                >
                  {abrindo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Cadastrar e abrir
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
        </div>
      )}
    </div>
  );
}
