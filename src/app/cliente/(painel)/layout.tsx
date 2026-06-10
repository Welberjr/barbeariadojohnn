import { requireCustomer } from '@/lib/customer-auth';
import { getUnreadCount } from '@/lib/notifications';
import { ClientTopbar, ClientBottomNav } from './_components/client-nav';

export const metadata = {
  title: {
    default: 'Área do Cliente | Barbearia do Johnn',
    template: '%s | Barbearia do Johnn',
  },
};

export default async function ClientePainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { customer } = await requireCustomer();
  const unreadCount = await getUnreadCount(customer.id);

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

      <ClientBottomNav />
    </div>
  );
}
