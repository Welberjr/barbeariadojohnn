import { createClient } from '@/lib/supabase/server';
import { Plus, Users, Crown, TrendingUp, Heart } from 'lucide-react';
import Link from 'next/link';
import { CustomersList } from './_components/customers-list';

export const metadata = {
  title: 'Clientes',
};

const PAGE_SIZE = 24;

interface ClientesPageProps {
  searchParams: Promise<{ q?: string; tier?: string; page?: string }>;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const { q, tier, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('customers')
    .select(
      'id, full_name, phone, email, cpf, birth_date, tier, loyalty_tier, loyalty_points, total_appointments, total_spent, last_visit_at, photo_url, active, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  if (tier && tier !== 'all') {
    query = query.eq('tier', tier);
  }

  const { data: customers, count, error } = await query.range(from, to);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Stats globais (independentes da busca)
  const [{ count: totalAll }, { count: vips }, { count: regulars }, { count: news }] =
    await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'vip'),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'active'),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'new'),
    ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Relacionamento
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Clientes
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Cadastro, histórico e segmentação dos seus clientes.
          </p>
        </div>

        <Link
          href="/admin/clientes/novo"
          className="btn-gold-shimmer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Novo cliente</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            {totalAll ?? 0}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Crown className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              VIPs
            </p>
          </div>
          <p
            className="text-3xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {vips ?? 0}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Recorrentes
            </p>
          </div>
          <p
            className="text-3xl font-bold text-info"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {regulars ?? 0}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Heart className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Novos
            </p>
          </div>
          <p
            className="text-3xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {news ?? 0}
          </p>
        </div>
      </div>

      {/* LISTA / EMPTY STATE */}
      {error ? (
        <div className="card p-8 text-center">
          <p className="text-danger text-sm">
            Erro ao carregar clientes: {error.message}
          </p>
        </div>
      ) : !customers || customers.length === 0 ? (
        q || tier ? (
          <div className="card p-12 text-center">
            <div className="inline-flex p-3 rounded-full bg-fg-dim/10 text-fg-subtle mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h2
              className="text-xl font-bold text-fg mb-2"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Nenhum cliente encontrado
            </h2>
            <p className="text-sm text-fg-muted mb-4">
              Tente outro termo de busca ou limpe os filtros.
            </p>
            <Link href="/admin/clientes" className="btn-secondary inline-flex">
              Limpar filtros
            </Link>
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h2
              className="text-xl font-bold text-fg mb-2"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Nenhum cliente cadastrado ainda
            </h2>
            <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
              Cadastre seus clientes para acompanhar o histórico e oferecer um
              atendimento personalizado.
            </p>
            <Link
              href="/admin/clientes/novo"
              className="btn-gold-shimmer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar primeiro cliente</span>
            </Link>
          </div>
        )
      ) : (
        <CustomersList
          customers={customers}
          initialQuery={q ?? ''}
          initialTier={tier ?? 'all'}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      )}
    </div>
  );
}
