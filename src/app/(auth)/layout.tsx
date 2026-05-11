import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-bg">
      {/* ========== CAMADA 1: Vinheta radial dourada (do topo) ========== */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212, 160, 79, 0.15) 0%, transparent 60%)',
        }}
      />

      {/* ========== CAMADA 2: Glow inferior sutil ========== */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(212, 160, 79, 0.08) 0%, transparent 60%)',
        }}
      />

      {/* ========== CAMADA 3: Grid sutil dourado ========== */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212, 160, 79, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212, 160, 79, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ========== CAMADA 4: Linhas decorativas douradas nas bordas ========== */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* ========== CONTEÚDO ========== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* ========== ASSINATURA DECORATIVA NO RODAPÉ ========== */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-xs text-fg-subtle tracking-widest uppercase">
          Cabelo · Barba · Visagismo
        </p>
      </div>
    </div>
  );
}
