'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { TransactionModal } from './transaction-modal';

interface StaffOption { id: string; display_name: string; }

interface FinanceiroHeaderProps {
  staff: StaffOption[];
  selectedStaffId: string;
  onStaffChange: (id: string) => void;
}

export function FinanceiroButtons({ staff }: { staff: StaffOption[] }) {
  const [modal, setModal] = useState<'income' | 'expense' | null>(null);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setModal('income')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          <span>+ Adicionar Receita</span>
        </button>
        <button
          type="button"
          onClick={() => setModal('expense')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors"
        >
          <TrendingDown className="w-4 h-4" />
          <span>+ Adicionar Despesa</span>
        </button>
      </div>

      {modal && (
        <TransactionModal
          type={modal}
          staff={staff}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
