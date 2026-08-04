import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  lojaAtual: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/manager', () => ({
  createManagerClient: async () => ({ from: mocks.from }),
}));

vi.mock('@/lib/loja', () => ({ lojaAtual: mocks.lojaAtual }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import {
  deleteBill,
  generateNextRecurrence,
  markBillAsPaid,
  reopenBill,
  updateBill,
} from './actions';

describe('updateBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lojaAtual.mockResolvedValue('loja-a');
  });

  it('recusa atualizar uma conta que não pertence à unidade atual', async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await expect(
      updateBill('bill-da-loja-b', {
        description: 'Aluguel',
        amount: 900,
        due_date: '2026-08-10',
      })
    ).resolves.toEqual({
      ok: false,
      error: 'Conta não pertence a esta unidade.',
    });
  });
});

describe('deleteBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lojaAtual.mockResolvedValue('loja-a');
  });

  it('recusa apagar uma conta que não pertence à unidade atual', async () => {
    const query = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
    };
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await expect(deleteBill('bill-da-loja-b')).resolves.toEqual({
      ok: false,
      error: 'Conta não pertence a esta unidade.',
    });
  });
});

describe('markBillAsPaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lojaAtual.mockResolvedValue('loja-a');
  });

  it('recusa baixar uma conta que não pertence à unidade atual', async () => {
    const readQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    readQuery.select.mockReturnValue(readQuery);
    readQuery.eq.mockReturnValue(readQuery);
    readQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const writeQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
    };
    writeQuery.update.mockReturnValue(writeQuery);
    writeQuery.eq.mockReturnValue(writeQuery);
    writeQuery.select.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValueOnce(readQuery).mockReturnValueOnce(writeQuery);

    await expect(markBillAsPaid('bill-da-loja-b', 'cash')).resolves.toEqual({
      ok: false,
      error: 'Conta não pertence a esta unidade.',
    });
  });
});

describe('reopenBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lojaAtual.mockResolvedValue('loja-a');
  });

  it('recusa reabrir uma conta que não pertence à unidade atual', async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await expect(reopenBill('bill-da-loja-b')).resolves.toEqual({
      ok: false,
      error: 'Conta não pertence a esta unidade.',
    });
  });
});

describe('generateNextRecurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lojaAtual.mockResolvedValue('loja-a');
  });

  it('não gera recorrência a partir de conta de outra unidade', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({
      data: {
        id: 'bill-da-loja-b',
        barbershop_id: 'loja-b',
        is_recurring: true,
        recurrence_type: 'monthly',
        due_date: '2026-08-10',
        description: 'Aluguel',
      },
      error: null,
    });
    query.eq.mockImplementation((column: string) => {
      if (column === 'barbershop_id') {
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
      }
      return query;
    });
    mocks.from.mockReturnValue(query);

    await expect(generateNextRecurrence('bill-da-loja-b')).resolves.toEqual({
      ok: false,
      error: 'Conta não pertence a esta unidade.',
    });
  });
});
