'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, Eye, EyeOff, Key, Webhook } from 'lucide-react';
import { updateMPConfig } from '../../mp/actions';

interface MPConfig {
  enabled?: boolean;
  public_key?: string;
  access_token?: string;
  notification_url?: string;
}

interface MPConfigFormProps {
  defaultValues?: Partial<MPConfig>;
}

export function MPConfigForm({ defaultValues }: MPConfigFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const [enabled, setEnabled] = useState(defaultValues?.enabled ?? false);
  const [publicKey, setPublicKey] = useState(defaultValues?.public_key ?? '');
  const [accessToken, setAccessToken] = useState(
    defaultValues?.access_token ?? ''
  );

  const webhookUrl = 'https://barbearia-do-johnn.vercel.app/api/mp/webhook';

  async function handleSave() {
    setIsLoading(true);
    const result = await updateMPConfig({
      enabled,
      public_key: publicKey,
      access_token: accessToken,
    });
    if (result.ok) {
      toast.success('Configuração do Mercado Pago salva!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* ATIVAÇÃO */}
      <section className="card p-6 space-y-3">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Status
        </h2>

        <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <div>
            <p className="text-sm text-fg font-medium">
              Habilitar Mercado Pago
            </p>
            <p className="text-[11px] text-fg-subtle">
              Quando ativo, comandas geram link de pagamento real (PIX, cartão, boleto). Sem isso, sistema usa mock para testar.
            </p>
          </div>
        </label>
      </section>

      {/* CREDENCIAIS */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-gold" />
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Credenciais Mercado Pago
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowSecrets(!showSecrets)}
            className="text-xs text-fg-muted hover:text-gold flex items-center gap-1"
          >
            {showSecrets ? (
              <>
                <EyeOff className="w-3 h-3" />
                Ocultar
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Mostrar
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label">Public Key</label>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              Pública, pode ser exposta no frontend.
            </p>
          </div>

          <div>
            <label className="label">Access Token *</label>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="APP_USR-xxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              <strong>SECRETO</strong>. Nunca compartilhe. Usado para criar
              pagamentos e validar webhooks.
            </p>
          </div>
        </div>
      </section>

      {/* WEBHOOK URL */}
      <section className="card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            URL do Webhook
          </h2>
        </div>

        <div className="p-3 rounded-md bg-bg-elevated border border-border">
          <p className="text-xs text-fg-muted mb-1">
            Configure essa URL no painel do MP:
          </p>
          <p className="text-xs font-mono text-fg break-all">{webhookUrl}</p>
        </div>

        <p className="text-[11px] text-fg-subtle">
          📌 Vai em <strong>Suas integrações &gt; Webhooks &gt; Configurar
          notificações</strong>. Cole a URL e marque o evento{' '}
          <strong>Pagamentos</strong>.
        </p>
      </section>

      {/* SALVAR */}
      <div className="flex justify-end gap-3 sticky bottom-4 z-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="btn-gold-shimmer flex items-center gap-2 shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar configuração</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
