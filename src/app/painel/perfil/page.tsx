import Link from 'next/link';
import { ShieldCheck, UserRound, ChevronRight } from 'lucide-react';
import { requireStaff } from '@/lib/staff-auth';
import { portasDoUsuario } from '@/lib/portas-de-entrada';
import { modulosLiberados, MODULO_INFO } from '@/lib/staff-permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrocarSenhaForm } from './_components/trocar-senha-form';
import { MinhaContaCliente } from './_components/minha-conta-cliente';
import { SairButton } from './_components/sair-button';

export const metadata = { title: 'Meu perfil' };
export const dynamic = 'force-dynamic';

const ROTULO_PAPEL: Record<string, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  barber: 'Barbeiro',
  receptionist: 'Recepcionista',
  assistant: 'Auxiliar',
};

export default async function PerfilPage() {
  // A própria tela de troca de senha não pode redirecionar para si mesma
  const staff = await requireStaff(undefined, { ignorarTrocaSenha: true });
  const modulos = modulosLiberados(staff);

  // Ficha de cliente ligada a este mesmo login, quando existe
  const { data: comoCliente } = await createAdminClient()
    .from('customers')
    .select('full_name, phone')
    .eq('auth_user_id', staff.profileId)
    .maybeSingle();

  // Os outros lados que este mesmo login abre. O painel nao entra: e onde ele
  // ja esta.
  const outrosLados = (await portasDoUsuario(staff.profileId)).filter(
    (porta) => porta.id !== 'painel'
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Perfil</p>
        <h1
          className="text-2xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {staff.displayName}
        </h1>
        <p className="text-sm text-fg-muted">
          {ROTULO_PAPEL[staff.role] ?? staff.role}
          {staff.email ? ` · ${staff.email}` : ''}
        </p>
      </div>

      <TrocarSenhaForm obrigatoria={staff.mustChangePassword} />

      {/* Trocar de lado sem sair da conta. Enquanto a senha for provisoria,
          nao aparece: primeiro ele troca a senha, depois circula. */}
      {!staff.mustChangePassword && outrosLados.length > 0 && (
        <section className="card space-y-2 p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-fg-dim">Trocar para</p>
          {outrosLados.map((porta) => (
            <Link
              key={porta.id}
              href={porta.destino}
              className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 transition-colors hover:border-gold/40"
            >
              {porta.id === 'admin' ? (
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-gold" />
              ) : (
                <UserRound className="h-4 w-4 flex-shrink-0 text-gold" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg">{porta.titulo}</p>
                <p className="text-[11px] text-fg-subtle">{porta.descricao}</p>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-fg-subtle" />
            </Link>
          ))}
        </section>
      )}

      {!staff.mustChangePassword && (
        <MinhaContaCliente
          nomeCliente={(comoCliente?.full_name as string) ?? null}
          telefoneSugerido={(comoCliente?.phone as string) ?? null}
        />
      )}

      <section className="card p-5 space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">
          O que você acessa
        </p>

        <ul className="space-y-2">
          <li className="text-sm text-fg">
            Minha agenda
            <span className="block text-xs text-fg-muted">
              Ver os seus atendimentos do dia.
            </span>
          </li>
          {modulos.map((m) => (
            <li key={m} className="text-sm text-fg">
              {MODULO_INFO[m].label}
              <span className="block text-xs text-fg-muted">{MODULO_INFO[m].ajuda}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-fg-subtle">
          Precisa de mais alguma coisa aqui? Fale com a gestão.
        </p>
      </section>

      <SairButton />
    </div>
  );
}
