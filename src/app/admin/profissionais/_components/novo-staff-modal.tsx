'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SlideModal } from '@/components/slide-modal';
import { StaffForm } from './staff-form';

export function NovoStaffModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gold-shimmer flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        <span>Adicionar profissional</span>
      </button>

      <SlideModal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo profissional"
        subtitle="Preencha os dados do barbeiro ou atendente"
        width="max-w-2xl"
      >
        <StaffForm onClose={() => setOpen(false)} />
      </SlideModal>
    </>
  );
}