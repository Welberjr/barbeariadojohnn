import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  isValidMercadoPagoWebhookSignature,
  isValidWhatsAppWebhookSignature,
} from './webhook-signature';

describe('assinatura do webhook WhatsApp', () => {
  const body = '{"object":"whatsapp_business_account"}';
  const secret = 'segredo-de-teste';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('aceita somente a assinatura do corpo original com segredo configurado', () => {
    expect(isValidWhatsAppWebhookSignature(body, signature, secret)).toBe(true);
    expect(isValidWhatsAppWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(isValidWhatsAppWebhookSignature(body, signature, undefined)).toBe(false);
  });
});

describe('assinatura do webhook Mercado Pago', () => {
  const secret = 'segredo-mp';
  const requestId = 'req-123';
  const timestamp = '1742505638683';
  const id = 'AbC123';
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');

  it('aceita o manifesto oficial e recusa cabeçalho ou segredo inválido', () => {
    const input = {
      dataId: id,
      requestId,
      signature: `ts=${timestamp},v1=${hash}`,
      secret,
    };
    expect(isValidMercadoPagoWebhookSignature(input)).toBe(true);
    expect(isValidMercadoPagoWebhookSignature({ ...input, dataId: 'outro' })).toBe(false);
    expect(isValidMercadoPagoWebhookSignature({ ...input, secret: undefined })).toBe(false);
  });
});
