'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, KeyRound, Copy, Check, Info } from 'lucide-react';

import { salvarAcessoStaff, definirSenhaAcesso } from '../actions';
import { MODULOS, MODULO_INFO, type Modulo, type Permissoes } from '@/lib/staff-permissions';

interface StaffAccessCardProps {
  staffId: string;
  displayName: string;
  canManage: boolean;
  permissions: Permissoes;
  mustChangePassword: boolean;
  ultimoAcesso: string | null;
  ativo: boolean;
}

export function StaffAccessCard({
  staffId,
  displayName,
  canManage: canManageInicial,
  permissions,
  mustChangePassword,
  ultimoAcesso,
  ativo,
}: StaffAccessCardProps) {
  const router = useRouter();
  const [canManage, setCanManage] = useState(canManageInicial);
  const [marcados, setMarcados] = useState<Record<Modulo, boolean>>({ ...permissions });
  const [salvando, setSalvando] = useState(false);
  const [gerandoSenha, setGerandoSenha] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function alternar(modulo: Modulo) {
    setMarcados((atual) => {
      const proximo = { ...atual, [modulo]: !atual[modulo] };
      // Pedir vale sem enxergar vale não faz sentido
      if (modulo === 'vales_ver' && !proximo.vales_ver) proximo.vales_pedir = false;
      if (modulo === 'vales_pedir' && proximo.vales_pedir) proximo.vales_ver = true;
      return proximo;
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const modulos = MODULOS.filter((m) => marcados[m]);
      const res = await salvarAcessoStaff(staffId, canManage, modulos);
      if (res.ok) {
        toast.success('Acesso atualizado.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível salvar o acesso.');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function gerarSenha() {
    setGerandoSenha(true);
    setSenhaGerada(null);
    setCopiado(false);
    try {
      const res = await definirSenhaAcesso(staffId);
      if (res.ok && res.senha) {
        setSenhaGerada(res.senha);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível definir a senha.');
      }
    } finally {
      setGerandoSenha(false);
    }
  }

  async function copiarSenha() {
    if (!senhaGerada) return;
    await navigator.clipboard.writeText(senhaGerada);
    setCopiado(true);
    toast.success('Senha copiada.');
  }

  const fmtAcesso = ultimoAcesso
    ? new Date(ultimoAcesso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : null;

  return (
    <section className="card p-6 space-y-5">
      <div>
        <h2
          className="text-lg font-semibold text-fg flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <ShieldCheck className="w-5 h-5 text-gold" />
          Acesso ao sistema
        </h2>
        <p className="text-xs text-fg-muted mt-1">
          Define o que {displayName} enxerga quando entra com o login dele.
        </p>
      </div>

      {!ativo && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-md p-3">
          Profissional inativo. Ele não consegue entrar, mesmo com acesso liberado aqui.
        </p>
      )}

      {/* Acesso de gestão */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 accent-gold"
          checked={canManage}
          onChange={(e) => setCanManage(e.target.checked)}
        />
        <span>
          <span className="text-sm font-medium text-fg">Acesso de gestão</span>
          <span className="block text-xs text-fg-muted">
            Entra na gestão completa: financeiro, DRE, contas a pagar, clientes e configurações.
            Deixe desligado para quem deve ver apenas o painel dele.
          </span>
        </span>
      </label>

      <div className="divider-gold" />

      {/* Módulos do painel */}
      <div className="space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">
          Módulos do painel
        </p>

        {canManage ? (
          <p className="text-xs text-fg-muted bg-bg-elevated border border-border rounded-md p-3 flex gap-2">
            <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
            Com o acesso de gestão ligado, esta pessoa vê tudo de qualquer forma. Desligue a gestão
            para escolher módulo a módulo.
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            A agenda dele em modo leitura está sempre disponível. Marque o que ele pode além disso.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODULOS.map((modulo) => (
            <label
              key={modulo}
              className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                canManage
                  ? 'border-border/50 opacity-50 cursor-not-allowed'
                  : 'border-border hover:border-gold/40 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-gold"
                disabled={canManage}
                checked={canManage || marcados[modulo]}
                onChange={() => alternar(modulo)}
              />
              <span>
                <span className="text-sm font-medium text-fg">{MODULO_INFO[modulo].label}</span>
                <span className="block text-xs text-fg-muted">{MODULO_INFO[modulo].ajuda}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button type="button" onClick={salvar} disabled={salvando} className="btn-primary">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Salvar acesso
      </button>

      <div className="divider-gold" />

      {/* Senha */}
      <div className="space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">Senha de acesso</p>

        <p className="text-xs text-fg-muted">
          {fmtAcesso ? `Último acesso em ${fmtAcesso}.` : 'Este profissional nunca entrou no sistema.'}
          {mustChangePassword && ' Ele precisa trocar a senha no próximo acesso.'}
        </p>

        <button
          type="button"
          onClick={gerarSenha}
          disabled={gerandoSenha || !ativo}
          className="btn-gold-outline"
        >
          {gerandoSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Definir senha de acesso
        </button>

        {senhaGerada && (
          <div className="bg-bg-elevated border border-gold/40 rounded-md p-4 space-y-2">
            <p className="text-xs text-fg-muted">
              Senha de {displayName}. Ela aparece uma vez só, então copie agora e entregue a ele.
              No primeiro acesso o sistema pede para ele trocar.
            </p>
            <div className="flex items-center gap-3">
              <code className="text-lg font-mono text-gold tracking-wider">{senhaGerada}</code>
              <button
                type="button"
                onClick={copiarSenha}
                className="btn-ghost text-xs"
                aria-label="Copiar senha"
              >
                {copiado ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copiado ? 'Copiada' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
