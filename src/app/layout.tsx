import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: {
    default: 'Barbearia do Johnn',
    template: '%s | Barbearia do Johnn',
  },
  description: 'Cabelo, barba e visagismo com padrão premium em Brasília.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Barbearia do Johnn',
    description: 'Cabelo, barba e visagismo com padrão premium em Brasília.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body className="bg-bg text-fg antialiased font-sans">
        {children}
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
