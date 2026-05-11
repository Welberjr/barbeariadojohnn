import { Logo } from '@/components/brand/logo';
import { LoginForm } from './_components/login-form';

export default function LoginPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* ========== LOGO HERO ========== */}
      <div className="flex justify-center">
        <Logo variant="full" size="2xl" className="drop-shadow-[0_0_30px_rgba(212,160,79,0.15)]" />
      </div>

      {/* ========== CARD DE LOGIN PREMIUM ========== */}
      <div
        className="card-premium p-8 space-y-6 relative"
        style={{
          background:
            'linear-gradient(180deg, rgba(18, 18, 18, 0.95) 0%, rgba(10, 10, 10, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Linha dourada no topo do card */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

        {/* Título do painel */}
        <div className="text-center space-y-1.5 pt-2">
          <h2
            className="text-xl text-fg-muted font-light tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Painel de Gestão
          </h2>
          <div className="divider-gold mx-auto w-24" />
          <p className="text-xs text-fg-subtle pt-1">
            Entre com suas credenciais para continuar
          </p>
        </div>

        {/* Formulário */}
        <LoginForm />

        {/* Footer do card */}
        <div className="pt-4 border-t border-border/60">
          <p className="text-center text-[11px] text-fg-subtle tracking-wider uppercase">
            Esqueceu sua senha? Fale com o administrador
          </p>
        </div>
      </div>

      {/* Tagline final */}
      <div className="text-center">
        <p className="text-[11px] text-fg-dim tracking-[0.3em] uppercase">
          Padrão Premium · Brasília
        </p>
      </div>
    </div>
  );
}
