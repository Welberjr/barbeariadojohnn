import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verifica o X-Hub-Signature-256 enviado pela Meta no corpo bruto. */
export function isValidWhatsAppWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string | undefined
): boolean {
  if (!appSecret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

/** Valida o manifesto HMAC oficial do webhook do Mercado Pago. */
export function isValidMercadoPagoWebhookSignature({
  dataId,
  requestId,
  signature,
  secret,
}: {
  dataId: string | null | undefined;
  requestId: string | null;
  signature: string | null;
  secret: string | undefined;
}): boolean {
  if (!secret || !signature || !requestId || !dataId) return false;
  const parts = new Map(
    signature.split(',').map((part) => {
      const [key, value] = part.trim().split('=', 2);
      return [key, value];
    })
  );
  const timestamp = parts.get('ts');
  const receivedSignature = parts.get('v1');
  if (!timestamp || !receivedSignature) return false;

  const normalizedId = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const received = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}
