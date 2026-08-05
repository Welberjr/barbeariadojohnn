import { requireCustomer } from '@/lib/customer-auth';
import { getUnreadCount } from '@/lib/notifications';
import { precisaTrocarSenha } from '@/app/cliente/login/actions';
import { TrocarSenhaPrimeiroAcesso } from './_components/trocar-senha-primeiro-acesso';
import { ClientTopbar, ClientBottomNav } from './_components/client-nav';
import { ChatFloatLazy } from '@/components/chat-float-lazy';
import { ASSISTENTE_LIGADO } from '@/lib/assistente';

import type { Viewport } from 'next';
import { marcaAtual } from '@/lib/marca';

export const viewport: Viewport = {
  themeColor: '#D4A04F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};
export async function generateMetadata() {
  const marca = await marcaAtual();
  return {
    title: {
      default: `Área do Cliente | ${marca.nome}`,
      template: `%s | ${marca.nome}`,
    },
  };
}

export default async function ClientePainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { customer } = await requireCustomer();
  // A marca nao depende do cliente resolvido acima: vai junto das outras duas
  const [marca, unreadCount, senhaAindaEDaBarbearia] = await Promise.all([
    marcaAtual(),
    getUnreadCount(customer.id),
    precisaTrocarSenha(),
  ]);

  return (
    <div className="min-h-screen bg-bg relative">
      {/* Glow decorativo */}
      <div
        className="absolute inset-x-0 top-0 h-72 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(212, 160, 79, 0.10) 0%, transparent 70%)',
        }}
      />

      <ClientTopbar
        customerName={customer.full_name}
        photoUrl={customer.photo_url}
        unreadCount={unreadCount}
      />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-10">
        {children}
      </main>

      {/* Enquanto a senha for a que a barbearia entregou, a conta e de quem
          souber o telefone. A troca cobre a tela e nao tem como pular. */}
      {senhaAindaEDaBarbearia && (
        <TrocarSenhaPrimeiroAcesso primeiroNome={customer.full_name.split(' ')[0]} />
      )}

      <ClientBottomNav />
      {ASSISTENTE_LIGADO && (
        <ChatFloatLazy
          endpoint="/api/chat/cliente"
          title="Lara"
          avatarSrc="/lara.webp"
          welcomeMessage={`Olá! Sou o assistente da ${marca.nome}. Posso agendar, verificar horários, mostrar serviços e muito mais. Como posso te ajudar? 😊`}
          placeholder="Ex: Quero agendar um corte para amanhã..."
        />
      )}
    </div>
  );
}
