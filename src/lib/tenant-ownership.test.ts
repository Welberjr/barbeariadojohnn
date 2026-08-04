import { describe, expect, it } from 'vitest';
import { requireCurrentStoreRecord, requireScopedMutation } from './tenant-ownership';

describe('requireCurrentStoreRecord', () => {
  it('recusa registro de outra unidade', () => {
    expect(
      requireCurrentStoreRecord(
        { id: 'other', barbershop_id: 'loja-b' },
        'loja-a',
        'Agendamento'
      )
    ).toEqual({
      ok: false,
      error: 'Agendamento não pertence a esta unidade.',
    });
  });

  it('recusa escrita que não afetou registro da unidade atual', () => {
    expect(requireScopedMutation([], null, 'Agendamento')).toEqual({
      ok: false,
      error: 'Agendamento não pertence a esta unidade.',
    });
  });
});
