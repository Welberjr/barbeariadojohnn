'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCheck, Loader2 } from 'lucide-react';
import { markAllNotificationsRead } from '@/app/cliente/actions';

export function MarkAllReadButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const result = await markAllNotificationsRead();
    setBusy(false);
    if (result.ok) {
      toast.success('Tudo lido!');
      startTransition(() => router.refresh());
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="btn-secondary text-xs flex items-center gap-1.5"
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <CheckCheck className="w-3.5 h-3.5" />
      )}
      <span>Marcar todas como lidas</span>
    </button>
  );
}
