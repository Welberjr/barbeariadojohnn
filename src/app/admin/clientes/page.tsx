import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Plus, Users, Crown, TrendingUp, Heart, Trophy } from 'lucide-react';
import Link from 'next/link';
import { CustomersList } from './_components/customers-list';
import { formatCurrency } from '@/lib/utils';

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
  const admin = createAdminClient();
  const [{ count: totalAll }, { count: vips }, { count: regulars }, { count: news }, { data: topCustomers }, { data: shopConfig }] =
    await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tier', 'vip'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tier', 'active'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tier', 'new'),
      admin
        .from('customers')
        .select('id, full_name, photo_url, total_spent, total_appointments, tier')
        .eq('barbershop_id', '11111111-1111-1111-1111-111111111111')
        .eq('active', true)
        .order('total_spent', { ascending: false })
        .limit(5),
      admin
        .from('barbershops')
        .select('vip_total_spent_threshold')
        .eq('id', '11111111-1111-1111-1111-111111111111')
        .maybeSingle(),
    ]);

  const vipThreshold = Number(shopConfig?.vip_total_spent_threshold ?? 500);
  const totalTicket = (topCustomers ?? []).reduce((s, c) => s + Number(c.total_spent ?? 0), 0);
  const topVip = (topCustomers ?? []).find((c) => c.tier === 'vip');
  const globalTicket =
    (totalAll ?? 0) > 0
      ? (topCustomers ?? []).reduce((s, c) => {
          const t = c.total_appointments > 0 ? Number(c.total_spent) / c.total_appointments : 0;
          return s + t;
        }, 0) / Math.min(topCustomers?.length ?? 1, 5)
      : 0;

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
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">Total clientes</p>
          </div>
          <p className="text-3xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>{totalAll ?? 0}</p>
          <p className="text-[10px] text-fg-subtle mt-1">{vips ?? 0} VIPs · {news ?? 0} Novos</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Crown className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">Cliente VIP</p>
          </div>
          {topVip ? (
            <>
              <p className="text-xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>{topVip.full_name}</p>
              <p className="text-[10px] text-fg-subtle mt-1">{formatCurrency(Number(topVip.total_spent))} gastos</p>
            </>
          ) : (
            <p className="text-sm text-fg-subtle mt-2">Nenhum VIP ainda</p>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">Ticket médio</p>
          </div>
          <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>{formatCurrency(globalTicket)}</p>
          <p className="text-[10px] text-fg-subtle mt-1">Média por atendimento</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Heart className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">Recorrentes</p>
          </div>
          <p className="text-3xl font-bold text-success" style={{ fontFamily: 'var(--font-playfair), serif' }}>{regulars ?? 0}</p>
        </div>
      </div>

      {/* CRITÉRIO VIP */}
      <div className="card p-4 border-gold/20 bg-gold/5 flex items-start gap-3">
        <Crown className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
        <p className="text-xs text-fg-muted">
          <span className="text-fg font-semibold">Critério Cliente VIP:</span> Clientes que já gastaram{' '}
          <span className="text-gold font-semibold">mais de {formatCurrency(vipThreshold)}</span> na barbearia são automaticamente classificados como VIPs.
        </p>
      </div>

      {/* TOP 5 POR RECEITA */}
      {(topCustomers ?? []).length > 0 && (
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gold" />
              <h2 className="text-base font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Top 5 Clientes por Receita</h2>
            </div>
            <p className="text-xs text-fg-muted">{formatCurrency(totalTicket)} total</p>
          </div>
          <div className="space-y-2">
            {(topCustomers ?? []).map((c, i) => {
              const ticket = c.total_appointments > 0 ? Number(c.total_spent) / c.total_appointments : 0;
              const initials = c.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              const medalColors = ['text-gold', 'text-gray-300', 'text-amber-600'];
              return (
                <Link key={c.id} href={`/admin/clientes/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-md bg-bg-elevated border border-border/60 hover:border-gold/40 transition-colors">
                  <span className={`w-6 text-center text-sm font-bold flex-shrink-0 ${medalColors[i] ?? 'text-fg-muted'}`}>{i + 1}</span>
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_url} alt={c.full_name} className="w-8 h-8 rounded-full object-cover border border-gold/30 flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)' }}>{initials}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{c.full_name}</p>
                    <p className="text-[10px] text-fg-subtle">{c.total_appointments} atendimentos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-fg">{formatCurrency(Number(c.total_spent))}</p>
                    <p className="text-[10px] text-fg-subtle">Ticket: {formatCurrency(ticket)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
