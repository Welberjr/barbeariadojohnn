import { randomBytes } from 'node:crypto';

/**
 * Senha inicial entregue uma unica vez pelo gestor. O prefixo garante os
 * requisitos comuns de complexidade; o restante vem de criptografia do Node.
 */
export function gerarSenhaTemporariaProfissional() {
  return `Bbj!${randomBytes(18).toString('base64url')}`;
}
