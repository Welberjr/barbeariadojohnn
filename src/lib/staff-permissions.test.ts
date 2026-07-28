import { describe, it, expect } from 'vitest';
import {
  parseStaffPermissions,
  buildStaffPermissions,
  podeModulo,
  modulosLiberados,
  PERMISSOES_VAZIAS,
} from './staff-permissions';

const ativo = { active: true, canManage: false };

describe('parseStaffPermissions', () => {
  it('trata jsonb vazio como nada liberado', () => {
    expect(parseStaffPermissions({})).toEqual(PERMISSOES_VAZIAS);
  });

  it('trata nulo, texto e lista como nada liberado', () => {
    expect(parseStaffPermissions(null)).toEqual(PERMISSOES_VAZIAS);
    expect(parseStaffPermissions('financeiro')).toEqual(PERMISSOES_VAZIAS);
    expect(parseStaffPermissions(['financeiro'])).toEqual(PERMISSOES_VAZIAS);
  });

  it('só aceita o booleano true, nunca texto', () => {
    const p = parseStaffPermissions({ financeiro: 'true', comanda: 1, clientes: true });
    expect(p.financeiro).toBe(false);
    expect(p.comanda).toBe(false);
    expect(p.clientes).toBe(true);
  });

  it('ignora chave desconhecida e erro de digitação', () => {
    const p = parseStaffPermissions({ finaceiro: true, dre: true, admin: true });
    expect(p).toEqual(PERMISSOES_VAZIAS);
  });

  it('derruba pedir vale quando ver vale está desligado', () => {
    const p = parseStaffPermissions({ vales_pedir: true });
    expect(p.vales_pedir).toBe(false);
  });

  it('mantém pedir vale quando ver vale está ligado', () => {
    const p = parseStaffPermissions({ vales_ver: true, vales_pedir: true });
    expect(p.vales_pedir).toBe(true);
  });
});

describe('buildStaffPermissions', () => {
  it('monta o jsonb a partir das chaves marcadas na tela', () => {
    const p = buildStaffPermissions(['financeiro', 'clientes']);
    expect(p.financeiro).toBe(true);
    expect(p.clientes).toBe(true);
    expect(p.comanda).toBe(false);
  });

  it('descarta chave inventada vinda do formulário', () => {
    const p = buildStaffPermissions(['financeiro', 'dre', 'contas_pagar']);
    expect(p.financeiro).toBe(true);
    expect(Object.values(p).filter(Boolean)).toHaveLength(1);
  });

  it('não deixa passar pedir vale sozinho', () => {
    const p = buildStaffPermissions(['vales_pedir']);
    expect(p.vales_pedir).toBe(false);
  });
});

describe('podeModulo', () => {
  it('libera tudo para quem tem acesso de gestão', () => {
    const gestor = { ...ativo, canManage: true, permissions: PERMISSOES_VAZIAS };
    expect(podeModulo(gestor, 'financeiro')).toBe(true);
    expect(podeModulo(gestor, 'comanda')).toBe(true);
  });

  it('nega tudo para profissional inativo, mesmo sendo gestor', () => {
    const demitido = {
      active: false,
      canManage: true,
      permissions: parseStaffPermissions({ financeiro: true }),
    };
    expect(podeModulo(demitido, 'financeiro')).toBe(false);
  });

  it('respeita módulo a módulo para quem não é gestão', () => {
    const barbeiro = {
      ...ativo,
      permissions: parseStaffPermissions({ financeiro: true, vales_ver: true }),
    };
    expect(podeModulo(barbeiro, 'financeiro')).toBe(true);
    expect(podeModulo(barbeiro, 'vales_ver')).toBe(true);
    expect(podeModulo(barbeiro, 'comanda')).toBe(false);
    expect(podeModulo(barbeiro, 'clientes')).toBe(false);
  });
});

describe('modulosLiberados', () => {
  it('devolve só o que está ligado, na ordem do menu', () => {
    const barbeiro = {
      ...ativo,
      permissions: parseStaffPermissions({
        clientes: true,
        financeiro: true,
        vales_ver: true,
        vales_pedir: true,
      }),
    };
    expect(modulosLiberados(barbeiro)).toEqual([
      'financeiro',
      'vales_ver',
      'vales_pedir',
      'clientes',
    ]);
  });

  it('devolve vazio para quem só tem a agenda em leitura', () => {
    const novato = { ...ativo, permissions: PERMISSOES_VAZIAS };
    expect(modulosLiberados(novato)).toEqual([]);
  });
});
