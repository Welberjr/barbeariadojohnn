'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  Send,
  Key,
  MessageSquare,
  Webhook,
  Eye,
  EyeOff,
} from 'lucide-react';
import { updateWhatsAppConfig, testWhatsAppSend } from '../actions';
import type { WhatsAppConfig } from '../actions';

interface WhatsAppFormProps {
  defaultValues?: Partial<WhatsAppConfig>;
}

const SAMPLE_GREETING =
  'Olá! Sou a assistente da Barbearia do Johnn. Como posso ajudar? Você pode agendar, ver horários disponíveis ou tirar dúvidas.';

export function WhatsAppForm({ defaultValues }: WhatsAppFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const [enabled, setEnabled] = useState(defaultValues?.enabled ?? false);
  const [phoneNumberId, setPhoneNumberId] = useState(
    defaultValues?.phone_number_id ?? ''
  );
  const [wabaId, setWabaId] = useState(defaultValues?.waba_id ?? '');
  const [accessToken, setAccessToken] = useState(
    defaultValues?.access_token ?? ''
  );
  const [verifyToken, setVerifyToken] = useState(
    defaultValues?.verify_token ?? ''
  );
  const [webhookUrl] = useState(
    defaultValues?.webhook_url ??
      'https://barbearia-do-johnn.vercel.app/api/whatsapp/webhook'
  );
  const [greeting, setGreeting] = useState(
    defaultValues?.default_greeting ?? SAMPLE_GREETING
  );
  const [status, setStatus] = useState(defaultValues?.meta_status ?? 'not_started');

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState(
    'Teste de mensagem do sistema da Barbearia do Johnn 🪒'
  );

  async function handleSave() {
    setIsLoading(true);
    const result = await updateWhatsAppConfig({
      enabled,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: accessToken,
      verify_token: verifyToken,
      webhook_url: webhookUrl,
      default_greeting: greeting,
      meta_status: status,
    });
    if (result.ok) {
      toast.success('Configuração do WhatsApp salva!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsLoading(false);
  }

  async function handleTest() {
    if (!testPhone) {
      toast.error('Informe um número de teste.');
      return;
    }
    setIsTesting(true);
    const result = await testWhatsAppSend(testPhone, testMessage);
    if (result.ok) {
      toast.info(result.info ?? 'Teste enviado.');
    } else {
      toast.error('Erro no teste.');
    }
    setIsTesting(false);
  }

  function generateVerifyToken() {
    const random = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    setVerifyToken(`barbearia_${random}`);
  }

  return (
    <div className="space-y-6">
      {/* ATIVAÇÃO */}
      <section className="card p-6 space-y-3">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Status da Integração
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
              Habilitar integração WhatsApp
            </p>
            <p className="text-[11px] text-fg-subtle">
              Ative apenas após receber aprovação da Meta Business.
            </p>
          </div>
        </label>

        <div>
          <label className="label">Status Meta Business</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
          >
            <option value="not_started">Não iniciado</option>
            <option value="pending_verification">Em verificação</option>
            <option value="verified">Verificado</option>
            <option value="disabled">Desabilitado</option>
          </select>
        </div>
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
              Credenciais Meta Business
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Phone Number ID</label>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="Ex: 123456789012345"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              Identificador único do número WhatsApp na Meta.
            </p>
          </div>

          <div>
            <label className="label">WABA ID</label>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="Ex: 987654321098765"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              WhatsApp Business Account ID.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="label">Access Token</label>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              Token permanente gerado no Meta Business Manager. Comece com EAA...
            </p>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Verify Token (webhook)</label>
              <button
                type="button"
                onClick={generateVerifyToken}
                className="text-[10px] text-gold hover:underline"
              >
                Gerar token aleatório
              </button>
            </div>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="Ex: barbearia_abc123xyz789"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              Você define esse token. Use-o tanto aqui quanto no painel Meta ao configurar webhook.
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
            Configure essa URL no Meta Business Manager:
          </p>
          <p className="text-xs font-mono text-fg break-all">{webhookUrl}</p>
        </div>

        <p className="text-[11px] text-fg-subtle">
          📌 No Meta Business: <strong>WhatsApp &gt; Configuração &gt; Webhooks &gt; Editar</strong>, cole a URL acima e o Verify Token configurado.
        </p>
      </section>

      {/* MENSAGEM DEFAULT */}
      <section className="card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Saudação Padrão
          </h2>
        </div>

        <textarea
          rows={4}
          placeholder={SAMPLE_GREETING}
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          className="input resize-none"
        />
        <p className="text-[11px] text-fg-subtle">
          Mensagem que será enviada quando um cliente iniciar contato pela primeira vez.
        </p>
      </section>

      {/* TESTE */}
      <section className="card p-6 space-y-4 border-info/20">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-info" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Enviar Teste
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="label">Número de destino</label>
            <input
              type="tel"
              placeholder="5561999999999 (com DDI + DDD)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="input"
            />
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !enabled || status !== 'verified'}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            title={
              !enabled || status !== 'verified'
                ? 'Habilite a integração e verifique no Meta antes'
                : ''
            }
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Enviar teste</span>
          </button>
        </div>

        <div>
          <label className="label">Mensagem</label>
          <textarea
            rows={2}
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="input resize-none"
          />
        </div>

        {(!enabled || status !== 'verified') && (
          <p className="text-[11px] text-warning">
            ⚠️ Teste só funcionará após habilitar a integração e ter status &quot;Verificado&quot; na Meta.
          </p>
        )}
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
