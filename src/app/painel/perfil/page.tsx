import { requireStaff } from '@/lib/staff-auth';
import { modulosLiberados, MODULO_INFO } from '@/lib/staff-permissions';
import { TrocarSenhaForm } from './_components/trocar-senha-form';
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
