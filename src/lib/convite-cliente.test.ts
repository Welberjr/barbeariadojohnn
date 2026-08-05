import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  gerarConvite,
  conviteValido,
  linkDoConvite,
  mensagemDoConvite,
} from './convite-cliente';

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste-para-assinar';
});

afterEach(() => {
  vi.useRealTimers();
});

const CLIENTE = 'a1b2c3d4-0000-0000-0000-000000000001';
const OUTRO = 'a1b2c3d4-0000-0000-0000-000000000002';

/**
 * Reproduz o formato ANTIGO de convite, sem validade, do jeito que ele era
 * gerado antes de 04/08/2026. Os links já mandados aos clientes têm esta cara,
 * e precisam continuar funcionando até a aceitação antiga ser removida.
 */
function conviteAntigo(customerId: string): string {
  return createHmac('sha256', `convite-cliente:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .update(customerId)
    .digest('base64url')
    .slice(0, 32);
}

describe('convite do cliente', () => {
  it('o convite que a gente gera é aceito', () => {
    expect(conviteValido(CLIENTE, gerarConvite(CLIENTE))).toBe(true);
  });

  it('o convite novo carrega o prazo no próprio token', () => {
    const token = gerarConvite(CLIENTE);
    expect(token.startsWith('v2.')).toBe(true);
    expect(token.split('.')).toHaveLength(3);
  });

  it('o convite de um cliente não serve para outro', () => {
    expect(conviteValido(OUTRO, gerarConvite(CLIENTE))).toBe(false);
  });

  it('convite inventado não passa', () => {
    expect(conviteValido(CLIENTE, 'qualquercoisaquealguemdigitou')).toBe(false);
    expect(conviteValido(CLIENTE, '')).toBe(false);
    expect(conviteValido(CLIENTE, null)).toBe(false);
    expect(conviteValido(CLIENTE, 'v2.abc.def')).toBe(false);
  });

  it('mudar um caractere do convite já derruba', () => {
    const bom = gerarConvite(CLIENTE);
    const adulterado = bom.slice(0, -1) + (bom.endsWith('a') ? 'b' : 'a');
    expect(conviteValido(CLIENTE, adulterado)).toBe(false);
  });

  it('esticar o prazo na mão derruba a assinatura', () => {
    const [v2, expiraEm, assinatura] = gerarConvite(CLIENTE).split('.');
    const esticado = `${v2}.${Number(expiraEm) + 86400}.${assinatura}`;
    expect(conviteValido(CLIENTE, esticado)).toBe(false);
  });

  it('convite vencido é recusado', () => {
    const token = gerarConvite(CLIENTE);

    // 31 dias depois: um dia além da validade de 30
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);

    expect(conviteValido(CLIENTE, token)).toBe(false);
  });

  it('convite dentro do prazo continua valendo dias depois', () => {
    const token = gerarConvite(CLIENTE);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 29 * 24 * 60 * 60 * 1000);

    expect(conviteValido(CLIENTE, token)).toBe(true);
  });

  it('o convite do formato antigo ainda é aceito', () => {
    expect(conviteValido(CLIENTE, conviteAntigo(CLIENTE))).toBe(true);
  });

  it('o convite antigo de um cliente não serve para outro', () => {
    expect(conviteValido(OUTRO, conviteAntigo(CLIENTE))).toBe(false);
  });

  it('o link leva o cliente e a assinatura', () => {
    const link = linkDoConvite(CLIENTE, 'https://barbearia.exemplo');
    expect(link).toContain('/cliente/cadastro');
    expect(link).toContain(`c=${CLIENTE}`);
    expect(link).toContain('t=v2.');
  });
});

describe('mensagem do convite', () => {
  it('chama a pessoa pelo primeiro nome e leva o link', () => {
    const texto = mensagemDoConvite({
      nomeCliente: 'João da Silva Santos',
      nomeBarbearia: 'Barbearia do Johnn',
      link: 'https://exemplo/cadastro?c=1&t=2',
    });

    expect(texto).toContain('Oi, João!');
    expect(texto).toContain('Barbearia do Johnn');
    expect(texto).toContain('https://exemplo/cadastro?c=1&t=2');
  });
});
