'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SlideModal } from '@/components/slide-modal';
import { CustomerForm } from './customer-form';

export function NovoClienteModal({
  barbers,
}: {
  barbers: { id: string; display_name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gold-shimmer flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        <span>Novo cliente</span>
      </button>

      <SlideModal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo cliente"
        subtitle="Preencha os dados para cadastrar"
      >
        <CustomerForm
          barbers={barbers}
          onClose={() => setOpen(false)}
        />
      </SlideModal>
    </>
  );
}