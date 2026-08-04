import { ConfirmProvider } from '@/components/confirm-dialog';
import type { Metadata } from 'next';
import { marcaPadrao } from '@/lib/marca';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

/**
 * O nome na aba do navegador vem do cadastro da barbearia.
 *
 * Estava escrito aqui, o que obrigava a mexer no codigo para vender o sistema
 * para outra barbearia. Agora o mesmo programa serve qualquer uma: quem troca o
 * nome e o dono, na tela de configuracoes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaPadrao();
  const descricao = marca.cidade
    ? `Cabelo, barba e visagismo em ${marca.cidade}.`
    : 'Cabelo, barba e visagismo.';

  return {
    title: {
      default: marca.nome,
      template: `%s | ${marca.nome}`,
    },
    description: descricao,
    icons: {
      icon: '/favicon.ico',
    },
    openGraph: {
      title: marca.nome,
      description: descricao,
      type: 'website',
      locale: 'pt_BR',
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body className="bg-bg text-fg antialiased font-sans">
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: '#121212',
              border: '1px solid rgba(212, 160, 79, 0.2)',
              color: '#FAFAFA',
            },
          }}
        />
      </body>
    </html>
  );
}
