﻿﻿﻿﻿﻿import { redirect } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from './_components/sidebar';
import { ChatFloat } from '@/components/chat-float';
import { AdminTopbar } from './_components/topbar';

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Buscar o profile pra pegar o nome completo
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <>
    <div className="min-h-screen bg-bg flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          userEmail={user.email ?? ''}
          userName={profile?.full_name ?? undefined}
        />

        <main className="flex-1 p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
    <ChatFloat endpoint="/api/chat/admin" title="Assistente 📊" welcomeMessage="Olá, Jonathan! Me pergunte sobre métricas, clientes, estoque ou desempenho da equipe." placeholder="Como foi o faturamento essa semana?" accentColor="#ce0056" />
    </>
  );
}
