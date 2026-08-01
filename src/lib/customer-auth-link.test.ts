import { describe, expect, it } from 'vitest';
import { findSingleUnlinkedCustomerForEmail } from './customer-auth-link';

describe('findSingleUnlinkedCustomerForEmail', () => {
  it('recupera o cadastro importado quando o e-mail do login coincide', () => {
    const customer = findSingleUnlinkedCustomerForEmail(
      [
        { id: 'cliente-importado', email: 'cliente@exemplo.com', auth_user_id: null },
        { id: 'cliente-ja-vinculado', email: 'outro@exemplo.com', auth_user_id: 'auth-outro' },
      ],
      'CLIENTE@EXEMPLO.COM'
    );

    expect(customer?.id).toBe('cliente-importado');
  });

  it('nao vincula quando houver mais de um cadastro com o mesmo e-mail', () => {
    const customer = findSingleUnlinkedCustomerForEmail(
      [
        { id: 'duplicado-1', email: 'cliente@exemplo.com', auth_user_id: null },
        { id: 'duplicado-2', email: 'cliente@exemplo.com', auth_user_id: null },
      ],
      'cliente@exemplo.com'
    );

    expect(customer).toBeNull();
  });
});
