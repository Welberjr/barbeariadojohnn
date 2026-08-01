/**
 * "Como voce quer entrar?"
 *
 * So aparece para quem tem mais de um papel. Uma porta so significa entrar
 * direto, sem clique a mais: a escolha existe para quem precisa dela.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Scissors, User, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { portasDoUsuario, destinoUnico, type PortaId } from '@/lib/portas-de-entrada';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

const ICONES: Record<PortaId, typeof ShieldCheck> = {
  admin: ShieldCheck,
  painel: Scissors,
  cliente: User,
};

export default async function EntrarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const portas = await portasDoUsuario(user.id);

  // Sem porta nenhuma: login sem cadastro de equipe nem ficha de cliente
  if (portas.length === 0) redirect('/cliente/cadastro');

  const unico = destinoUnico(portas);
  if (unico) redirect(unico);

  const primeiroNome =
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-fg-dim">Barbearia do Johnn</p>
        <h1
          className="text-2xl font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {primeiroNome ? `Como você quer entrar, ${primeiroNome}?` : 'Como você quer entrar?'}
        </h1>
        <p className="text-xs text-fg-subtle">
          Você pode trocar de lado depois, sem sair da conta.
        </p>
      </div>

      <div className="space-y-3">
        {portas.map((porta) => {
          const Icone = ICONES[porta.id];
          return (
            <Link
              key={porta.id}
              href={porta.destino}
              className="card card-hover flex items-center gap-4 p-5 transition-colors hover:border-gold/40"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
                <Icone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{porta.titulo}</p>
                <p className="text-[11px] text-fg-subtle">{porta.descricao}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-fg-subtle" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
