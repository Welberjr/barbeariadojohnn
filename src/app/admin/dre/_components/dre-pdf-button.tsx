'use client';

import { Download } from 'lucide-react';

export function DrePdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-primary py-2 text-sm flex items-center gap-1.5 no-print"
      title="Abre a impressão do navegador para salvar o DRE em PDF"
    >
      <Download className="w-4 h-4" />
      <span>Imprimir / salvar PDF</span>
    </button>
  );
}
