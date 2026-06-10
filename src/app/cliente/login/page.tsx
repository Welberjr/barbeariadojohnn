import { Logo } from '@/components/brand/logo';
import { CustomerLoginForm } from './_components/customer-login-form';

export const metadata = {
  title: 'Área do Cliente | Barbearia do Johnn',
};

export default function CustomerLoginPage() {
  return (
    <div className="min-h-screen bg-bg relative overflow-hidden flex items-center justify-center p-4">
      {/* Background decorativo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212, 160, 79, 0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(212, 160, 79, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(212, 160, 79, 0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo
              variant="full"
              size="xl"
              className="drop-shadow-[0_0_40px_rgba(212,160,79,0.2)]"
            />
          </div>
          <div>
            <p className="text-[10px] text-gold tracking-[0.4em] uppercase font-semibold">
              Área do Cliente
            </p>
            <h1
              className="text-2xl font-bold text-fg mt-1"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Seu clube, seus pontos
            </h1>
            <p className="text-xs text-fg-muted mt-2">
              Agendamentos, assinatura, ranking e muito mais.
            </p>
          </div>
        </div>

        <div className="card-premium p-6">
          <CustomerLoginForm />
        </div>

        <p className="text-[10px] text-fg-dim text-center tracking-[0.3em] uppercase">
          Cabelo · Barba · Visagismo
        </p>
      </div>
    </div>
  );
}
