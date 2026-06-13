'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SlideModal: painel lateral que desliza da direita.
 * Abre instantaneamente (sem navegacao de rota).
 * Uso:
 *   <SlideModal open={show} onClose={() => setShow(false)} title="Novo cliente">
 *     <CustomerForm ... />
 *   </SlideModal>
 */
export function SlideModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}) {
  // Fechar com ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Travar scroll do body
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className={cn(
          'w-full bg-bg border-l border-border/60 flex flex-col animate-slide-in-right overflow-hidden',
          width
        )}
        style={{ animation: 'slideInRight 0.22s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border/60 flex-shrink-0">
          <div>
            <h2
              className="text-xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-fg-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-subtle hover:text-fg mt-0.5 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteudo */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}