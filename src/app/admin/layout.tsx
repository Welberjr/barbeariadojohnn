import type { Metadata, Viewport } from 'next';
import { requireCanManage } from '@/lib/staff-auth';
import { AdminSidebar } from './_components/sidebar';
import { ChatFloatLazy } from '@/components/chat-float-lazy';
import { AdminTopbar } from './_components/topbar';
import { portasDoUsuario } from '@/lib/portas-de-entrada';
import { lojaAtual, lojasDoUsuario } from '@/lib/loja';
import { marcaAtual } from '@/lib/marca';

export const viewport: Viewport = {
  themeColor: '#D4A04F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaAtual();
  return {
    title: `${marca.nome} — Gestão`,
    manifest: '/manifest-admin.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      // O nome que aparece embaixo do ícone quando o app vai para a tela de
      // início do celular. Cabe pouca coisa, então vai só a primeira palavra
      // que identifica a casa.
      title: `${marca.nome.split(' ').pop()} Admin`,
    },
  };
}
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

  const marca = await marcaAtual();

  // Unidades onde ele trabalha. Com uma só, o menu não mostra nada disso.
  const daVez = await lojaAtual();
  const unidades = (await lojasDoUsuario(staff.userId)).map((l) => ({
    id: l.id,
    nome: l.nome,
    atual: l.id === daVez,
  }));

  return (
    <>
    <div className="min-h-screen bg-bg flex">
      <AdminSidebar temRede={unidades.length > 1} marca={marca} />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          outrosLados={outrosLados}
          unidades={unidades}
          userEmail={staff.email ?? ''}
          userName={staff.fullName ?? staff.displayName}
        />

        <main className="flex-1 p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
    <ChatFloatLazy endpoint="/api/chat/admin" title="Lara" avatarSrc="/lara.webp" welcomeMessage="Opa, Jonathan, tudo bem? 👋 Tô aqui pra te ajudar com a barbearia. Quer ver o quê: faturamento, movimento, barbeiros ou produtos? E de qual período, hoje, semana ou mês?" placeholder="Como foi o faturamento essa semana?" accentColor="#ce0056" />
    </>
  );
}
