import type { Metadata, Viewport } from 'next';
import { requireCanManage } from '@/lib/staff-auth';
import { AdminSidebar } from './_components/sidebar';
import { ChatFloat } from '@/components/chat-float';
import { AdminTopbar } from './_components/topbar';
import { portasDoUsuario } from '@/lib/portas-de-entrada';

export const viewport: Viewport = {
  themeColor: '#D4A04F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Barbearia do Johnn — Gestão',
  manifest: '/manifest-admin.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Johnn Admin',
  },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Confere acesso de gestão no banco a cada carregamento.
  // Profissional sem gestão é mandado para o painel dele.
  const staff = await requireCanManage();

  // Quem e mais de uma coisa na casa troca de lado pelo proprio menu, sem sair
  // da conta e entrar de novo. A gestao nao aparece aqui: ja e onde ele esta.
  const outrosLados = (await portasDoUsuario(staff.userId)).filter(
    (porta) => porta.id !== 'admin'
  );

  return (
    <>
    <div className="min-h-screen bg-bg flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          outrosLados={outrosLados}
          userEmail={staff.email ?? ''}
          userName={staff.fullName ?? staff.displayName}
        />

        <main className="flex-1 p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
    <ChatFloat endpoint="/api/chat/admin" title="Lara" avatarSrc="/lara.webp" welcomeMessage="Opa, Jonathan, tudo bem? 👋 Tô aqui pra te ajudar com a barbearia. Quer ver o quê: faturamento, movimento, barbeiros ou produtos? E de qual período, hoje, semana ou mês?" placeholder="Como foi o faturamento essa semana?" accentColor="#ce0056" />
    </>
  );
}
