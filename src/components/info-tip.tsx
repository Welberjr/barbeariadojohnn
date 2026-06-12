'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tooltip de ajuda: icone "?" que mostra uma explicacao no hover/toque.
 * Uso: <InfoTip text="O que este card significa" />
 */
export function InfoTip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Ajuda"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="text-fg-subtle hover:text-gold transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-56 p-2.5 rounded-md bg-bg-elevated border border-gold/30 shadow-xl text-[11px] leading-relaxed text-fg-muted normal-case tracking-normal font-normal text-left animate-fade-in"
        >
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gold/30" />
        </span>
      )}
    </span>
  );
}