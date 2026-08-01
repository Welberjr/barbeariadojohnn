export interface UnlinkedCustomerCandidate {
  id: string;
  email: string | null;
  auth_user_id: string | null;
}

/**
 * Escolhe um unico cadastro ainda sem login para recuperar apos uma importacao.
 * O vinculo so e seguro quando o e-mail e exatamente o mesmo e nao ha duplicidade.
 */
export function findSingleUnlinkedCustomerForEmail<T extends UnlinkedCustomerCandidate>(
  customers: T[],
  authEmail: string
): T | null {
  const email = authEmail.trim().toLowerCase();
  if (!email) return null;

  const matches = customers.filter(
    (customer) =>
      customer.auth_user_id === null &&
      customer.email?.trim().toLowerCase() === email
  );

  return matches.length === 1 ? matches[0] : null;
}
