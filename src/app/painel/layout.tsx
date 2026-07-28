import type { Metadata, Viewport } from 'next';
import { requireStaff } from '@/lib/staff-auth';
import { modulosLiberados } from '@/lib/staff-permissions';
import { PainelTopbar, PainelBottomNav } from './_components/painel-nav';

export const viewport: Viewport = {
  themeColor: '#D4A04F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'Meu Painel | Barbearia do Johnn',
    template: '%s | Meu Painel',
  },
  manifest: '/manifest-painel.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Meu Painel',
  },
};

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Confere no banco quem é, se continua ativo e o que pode.
  // A troca de senha obrigatória é cobrada nas páginas, não aqui: a tela de
  // perfil mora dentro deste layout.
  const staff = await requireStaff(undefined, { ignorarTrocaSenha: true });
  const modulos = modulosLiberados(staff);

  return (
    <div className="min-h-screen bg-bg relative">
      <div
        className="absolute inset-x-0 top-0 h-72 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(212, 160, 79, 0.10) 0%, transparent 70%)',
        }}
      />

      <PainelTopbar displayName={staff.displayName} modulos={modulos} />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-10">
        {children}
      </main>

      <PainelBottomNav modulos={modulos} />
    </div>
  );
}
