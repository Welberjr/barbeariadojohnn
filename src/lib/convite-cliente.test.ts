import { describe, it, expect, beforeAll } from 'vitest';
import {
  gerarConvite,
  conviteValido,
  linkDoConvite,
  mensagemDoConvite,
} from './convite-cliente';

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste-para-assinar';
});

const CLIENTE = 'a1b2c3d4-0000-0000-0000-000000000001';
const OUTRO = 'a1b2c3d4-0000-0000-0000-000000000002';

describe('convite do cliente', () => {
  it('o convite que a gente gera é aceito', () => {
    expect(conviteValido(CLIENTE, gerarConvite(CLIENTE))).toBe(true);
  });

  it('o convite de um cliente não serve para outro', () => {
    expect(conviteValido(OUTRO, gerarConvite(CLIENTE))).toBe(false);
  });

  it('convite inventado não passa', () => {
    expect(conviteValido(CLIENTE, 'qualquercoisaquealguemdigitou')).toBe(false);
    expect(conviteValido(CLIENTE, '')).toBe(false);
    expect(conviteValido(CLIENTE, null)).toBe(false);
  });

  it('mudar um caractere do convite já derruba', () => {
    const bom = gerarConvite(CLIENTE);
    const adulterado = (bom[0] === 'a' ? 'b' : 'a') + bom.slice(1);
    expect(conviteValido(CLIENTE, adulterado)).toBe(false);
  });

  it('o mesmo cliente sempre recebe o mesmo convite', () => {
    expect(gerarConvite(CLIENTE)).toBe(gerarConvite(CLIENTE));
  });

  it('o link leva o cliente e a assinatura', () => {
    const link = linkDoConvite(CLIENTE, 'https://barbearia.exemplo');
    expect(link).toContain('/cliente/cadastro');
    expect(link).toContain(`c=${CLIENTE}`);
    expect(link).toContain('t=');
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
