import { describe, expect, it } from 'vitest';

import { gerarSenhaTemporariaProfissional } from '@/lib/staff-password';

describe('gerarSenhaTemporariaProfissional', () => {
  it('gera uma senha longa, imprevisivel e pronta para o primeiro acesso', () => {
    const senha = gerarSenhaTemporariaProfissional();

    expect(senha).toMatch(/^Bbj![A-Za-z0-9_-]{24}$/);
    expect(senha).toHaveLength(28);
  });

  it('nao repete a senha em geracoes consecutivas', () => {
    const senhas = new Set(
      Array.from({ length: 10 }, () => gerarSenhaTemporariaProfissional())
    );

    expect(senhas).toHaveLength(10);
  });
});
