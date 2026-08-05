import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { clienteDoConvite } from './actions';
import { CadastroForm } from './_components/cadastro-form';

export const metadata = {
  // A marca entra pelo template do layout raiz; escrever aqui dobrava o nome.
  title: 'Criar conta',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ c?: string; t?: string }>;
}

export default async function CadastroPage({ searchParams }: Props) {
  const { c, t } = await searchParams;

  // Convite: o cliente que a barbearia ja tem, com a assinatura que so o
  // servidor sabe fazer. Sem convite valido, a conta nasce do zero.
  const cliente = c && t ? await clienteDoConvite(c, t) : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212, 160, 79, 0.12) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-6 animate-fade-in">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo variant="full" size="xl" className="drop-shadow-[0_0_40px_rgba(212,160,79,0.2)]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-gold">
              Área do Cliente
            </p>
            <h1
              className="mt-1 text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {cliente ? `Bem-vindo, ${cliente.nome.split(' ')[0]}` : 'Criar minha conta'}
            </h1>
            <p className="mt-2 text-xs text-fg-muted">
              Marque horário sozinho, acompanhe seus pontos e a sua assinatura.
            </p>
          </div>
        </div>

        {/* Convite de quem já criou conta: não adianta cadastrar de novo */}
        {cliente?.jaTemConta ? (
          <div className="card-premium space-y-3 p-6 text-center">
            <p className="text-sm text-fg">Você já tem conta aqui.</p>
            <p className="text-xs text-fg-muted">
              Entre com o e-mail e a senha que você criou. Se esqueceu a senha, fale com a
              barbearia.
            </p>
            <Link href="/cliente/login" className="btn-gold-shimmer w-full">
              Ir para o login
            </Link>
          </div>
        ) : (
          <div className="card-premium p-6">
            <CadastroForm
              convite={
                cliente
                  ? {
                      id: cliente.id,
                      token: t as string,
                      nome: cliente.nome,
                      telefone: cliente.telefone,
                      email: cliente.email,
                      visitas: cliente.visitas,
                      pontos: cliente.pontos,
                    }
                  : null
              }
            />
          </div>
        )}

        <p className="text-center text-xs text-fg-muted">
          Já tem conta?{' '}
          <Link href="/cliente/login" className="text-gold hover:underline">
            Entrar
          </Link>
        </p>

        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-fg-dim">
          Cabelo · Barba · Visagismo
        </p>
      </div>
    </div>
  );
}
