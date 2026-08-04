export type CurrentStoreRecord<T extends { barbershop_id: string | null }> =
  | { ok: true; record: T }
  | { ok: false; error: string };

export function requireCurrentStoreRecord<T extends { barbershop_id: string | null }>(
  record: T | null,
  storeId: string,
  resource: string
): CurrentStoreRecord<T> {
  if (!record || record.barbershop_id !== storeId) {
    return { ok: false, error: `${resource} não pertence a esta unidade.` };
  }

  return { ok: true, record };
}

export function requireScopedMutation<T>(
  rows: T[] | null,
  error: { message: string } | null,
  resource: string
): { ok: true } | { ok: false; error: string } {
  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) {
    return { ok: false, error: `${resource} não pertence a esta unidade.` };
  }

  return { ok: true };
}
