'use client';

/**
 * Ligar e desligar o aviso que toca no celular.
 *
 * Um botao so, usado nas tres pontas da casa. Ele conta a verdade em vez de
 * sumir quando nao da: navegador que nao suporta, iPhone que precisa da tela de
 * inicio, permissao que a pessoa negou uma vez e nao lembra mais. Cada caso tem
 * uma frase, porque "nao funcionou" nao ajuda ninguem.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { guardarAparelho, esquecerAparelho } from '@/app/avisos-actions';

type Situacao =
  | 'checando'
  | 'sem_suporte'
  | 'precisa_instalar'
  | 'desligado'
  | 'ligado'
  | 'bloqueado';

/** A chave publica vem em texto e o navegador quer bytes. */
function chaveEmBytes(base64: string): ArrayBuffer {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const limpo = preenchido.replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(limpo);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes.buffer;
}

function ehIPhone(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function estaNaTelaDeInicio(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export function AvisosNoCelular({ compacto = false }: { compacto?: boolean }) {
  const [situacao, setSituacao] = useState<Situacao>('checando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    async function conferir() {
      if (typeof window === 'undefined') return;

      const temSuporte =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      // No iPhone o aviso so existe depois de a pessoa adicionar o aplicativo a
      // tela de inicio. Isso e regra da Apple, e sem explicar o usuario acha
      // que o sistema esta quebrado.
      if (!temSuporte) {
        setSituacao(ehIPhone() && !estaNaTelaDeInicio() ? 'precisa_instalar' : 'sem_suporte');
        return;
      }

      if (Notification.permission === 'denied') {
        setSituacao('bloqueado');
        return;
      }

      try {
        const registro = await navigator.serviceWorker.getRegistration();
        const inscricao = await registro?.pushManager.getSubscription();
        setSituacao(inscricao ? 'ligado' : 'desligado');
      } catch {
        setSituacao('desligado');
      }
    }
    conferir();
  }, []);

  async function ligar() {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setSituacao(permissao === 'denied' ? 'bloqueado' : 'desligado');
        toast.error('Você precisa permitir os avisos para eles chegarem.');
        return;
      }

      const registro = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) {
        toast.error('Os avisos ainda não estão configurados no servidor.');
        return;
      }

      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveEmBytes(chave),
      });

      const bruto = inscricao.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const r = await guardarAparelho({
        endpoint: bruto.endpoint ?? '',
        p256dh: bruto.keys?.p256dh ?? '',
        auth: bruto.keys?.auth ?? '',
        userAgent: navigator.userAgent.slice(0, 200),
      });

      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui ligar os avisos.');
        return;
      }

      setSituacao('ligado');
      toast.success('Pronto. Os avisos vão chegar neste aparelho.');
    } catch {
      toast.error('Não consegui ligar os avisos neste aparelho.');
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const inscricao = await registro?.pushManager.getSubscription();
      if (inscricao) {
        await esquecerAparelho(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setSituacao('desligado');
      toast.success('Avisos desligados neste aparelho.');
    } catch {
      toast.error('Não consegui desligar.');
    } finally {
      setOcupado(false);
    }
  }

  if (situacao === 'checando') return null;

  if (situacao === 'sem_suporte') {
    if (compacto) return null;
    return (
      <p className="text-[11px] text-fg-subtle">
        Este navegador não recebe avisos no aparelho. Tente pelo Chrome no Android ou
        adicionando o app à tela de início no iPhone.
      </p>
    );
  }

  if (situacao === 'precisa_instalar') {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 p-3">
        <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
        <p className="text-[11px] text-fg-muted">
          No iPhone, os avisos só chegam com o app na tela de início. Toque em Compartilhar
          e depois em <span className="text-fg">Adicionar à Tela de Início</span>. Depois
          abra por lá e ligue os avisos.
        </p>
      </div>
    );
  }

  if (situacao === 'bloqueado') {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 p-3">
        <BellOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-dim" />
        <p className="text-[11px] text-fg-muted">
          Os avisos estão bloqueados nas configurações do navegador para este site. Libere
          na permissão de notificações e volte aqui.
        </p>
      </div>
    );
  }

  const ligado = situacao === 'ligado';

  return (
    <button
      type="button"
      onClick={ligado ? desligar : ligar}
      disabled={ocupado}
      className={ligado ? 'btn-secondary w-full text-xs' : 'btn-gold-outline w-full text-xs'}
    >
      {ocupado ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : ligado ? (
        <BellOff className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      <span>{ligado ? 'Desligar avisos neste aparelho' : 'Receber avisos no celular'}</span>
    </button>
  );
}
