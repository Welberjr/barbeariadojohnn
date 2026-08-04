import { describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from './cron-auth';

describe('autorização de cron', () => {
  it('nega a execução quando o segredo não existe', () => {
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
    expect(isAuthorizedCronRequest('Bearer qualquer', '')).toBe(false);
  });

  it('aceita somente o token exato', () => {
    expect(isAuthorizedCronRequest('Bearer segredo', 'segredo')).toBe(true);
    expect(isAuthorizedCronRequest('Bearer errado', 'segredo')).toBe(false);
  });
});
