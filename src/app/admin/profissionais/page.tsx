import { createClient } from '@/lib/supabase/server';
import { Plus, Users } from 'lucide-react';
import { StaffList } from './_components/staff-list';
import Link from 'next/link';

export const metadata = {
  title: 'Profissionais',
};

export default async function ProfissionaisPage() {
  const supabase = await createClient();

  // Buscar staff com profile vinculado
  const { data: staff, error } = await supabase
    .from('staff')
    .select(
      `
      id,
      display_name,
      role,
      bio,
      photo_url,
      specialties,
      use_barbershop_hours,
      default_commission_percent,
      active,
      hired_at,
      created_at,
      profile:profiles (
        id,
        full_name,
        email,
        phone
      )
    `
    )
    .order('created_at', { ascending: false });

  const totalAtivos = staff?.filter((s) => s.active).length ?? 0;
  const totalInativos = staff?.filter((s) => !s.active).length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Equipe
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Profissionais
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Gerencie os profissionais (barbeiros) da sua equipe.
          </p>
        </div>

        <Link
          href="/admin/profissionais/novo"
          className="btn-gold-shimmer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar profissional</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Total
            </p>
          </div>
          <p
            className="text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {staff?.length ?? 0}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Ativos
            </p>
          </div>
          <p
            className="text-3xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalAtivos}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-fg-dim/10 text-fg-subtle">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Inativos
            </p>
          </div>
          <p
            className="text-3xl font-bold text-fg-subtle"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalInativos}
          </p>
        </div>
      </div>

      {/* LISTA */}
      {error ? (
        <div className="card p-8 text-center">
          <p className="text-danger text-sm">
            Erro ao carregar profissionais: {error.message}
          </p>
        </div>
      ) : !staff || staff.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h2
            className="text-xl font-bold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Nenhum profissional cadastrado
          </h2>
          <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
            Adicione os barbeiros da sua equipe para começar a aceitar
            agendamentos.
          </p>
          <Link
            href="/admin/profissionais/novo"
            className="btn-gold-shimmer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar primeiro profissional</span>
          </Link>
        </div>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <StaffList staff={staff as any} />
      )}
    </div>
  );
}
