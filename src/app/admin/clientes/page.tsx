import { createAdminClient } from '@/lib/supabase/admin';
import { Plus, Users, Crown, TrendingUp, Heart, Trophy } from 'lucide-react';
import Link from 'next/link';
import { CustomersList } from './_components/customers-list';
import { NovoClienteModal } from './_components/novo-cliente-modal';
import { formatCurrency } from '@/lib/utils';
import { InfoTip } from '@/components/info-tip';
import { headers } from 'next/headers';
import { LinkDoAplicativo } from './_components/link-do-aplicativo';
import { lojaAtual } from '@/lib/loja';

export const metadata = {
  title: 'Clientes',
};

// Lista sempre renderizada por requisicao (filtros via searchParams)
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

interface ClientesPageProps {
  searchParams: Promise<{ q?: string; tier?: string; page?: string }>;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const { q, tier, page: pageParam } = await searchParams;
  const supabase = createAdminClient();
  const loja = await lojaAtual();

  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // O criterio VIP vem antes de tudo porque entra nas consultas de contagem
  // e de filtro logo abaixo.
  const { data: shopConfig } = await supabase
    .from('barbershops')
    .select('vip_total_spent_threshold')
    .eq('id', loja)
    .maybeSingle();
  const vipThreshold = Number(shopConfig?.vip_total_spent_threshold ?? 500);

  let query = supabase
    .from('customers')
    .select(
      'id, full_name, phone, email, cpf, birth_date, tier, loyalty_tier, loyalty_points, total_appointments, total_spent, last_visit_at, photo_url, active, created_at',
      { count: 'exact' }
    )
    .eq('barbershop_id', loja)
    .order('full_name', { ascending: true });

  if (q && q.trim()) {
    // Remove caracteres que quebram a sintaxe do filtro .or() do PostgREST
    const term = q.trim().replace(/[,()]/g, '');
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
      );
    }
  }

  // A segmentacao e DERIVADA do que o cliente fez (gasto e visitas), nao da
  // coluna customers.tier: aquela coluna nasce 'new' e nada no sistema a
  // atualiza, entao ela mentia 0 VIPs com cliente de mil reais na base.
  if (tier && tier !== 'all') {
    if (tier === 'vip') query = query.gt('total_spent', vipThreshold);
    else if (tier === 'active')
      query = query.gt('total_appointments', 1).lte('total_spent', vipThreshold);
    else if (tier === 'new')
      query = query.lte('total_appointments', 1).lte('total_spent', vipThreshold);
    else if (tier === 'inactive') query = query.eq('active', false);
  }
  if (tier !== 'inactive') {
    query = query.eq('active', true);
  }

  // A página filtrada e as stats globais não dependem uma da outra: tudo junto.
  const admin = createAdminClient();
  const [{ data: customers, count, error }, { count: totalAll }, { count: vips }, { count: regulars }, { count: news }, { data: topCustomers }] =
    await Promise.all([
      query.range(from, to),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('barbershop_id', loja).eq('active', true),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('barbershop_id', loja).eq('active', true).gt('total_spent', vipThreshold),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('barbershop_id', loja).eq('active', true).gt('total_appointments', 1).lte('total_spent', vipThreshold),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('barbershop_id', loja).eq('active', true).lte('total_appointments', 1).lte('total_spent', vipThreshold),
      admin
        .from('customers')
        .select('id, full_name, photo_url, total_spent, total_appointments, tier')
        .eq('barbershop_id', loja)
        .eq('active', true)
        .order('total_spent', { ascending: false })
        .limit(5),
    ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const totalTicket = (topCustomers ?? []).reduce((s, c) => s + Number(c.total_spent ?? 0), 0);
  const topVip = (topCustomers ?? []).find((c) => Number(c.total_spent ?? 0) > vipThreshold);
  const globalTicket =
    (totalAll ?? 0) > 0
      ? (topCustomers ?? []).reduce((s, c) => {
          const t = c.total_appointments > 0 ? Number(c.total_spent) / c.total_appointments : 0;
          return s + t;
        }, 0) / Math.min(topCustomers?.length ?? 1, 5)
      : 0;

  // Link unico do aplicativo, para divulgar de uma vez em vez de convidar um a um
  const cabecalhos = await headers();
  const host = cabecalhos.get('host') ?? 'barbearia-do-johnn.vercel.app';
  const linkDoAplicativo = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/cliente/cadastro`;

  const { data: dadosBarbearia } = await supabase
    .from('barbershops')
    .select('name')
    .eq('id', (await lojaAtual()))
    .maybeSingle();

  const nomeDaBarbearia = (dadosBarbearia?.name as string) ?? 'Barbearia do Johnn';

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

        <div className="flex items-center gap-2">
          <LinkDoAplicativo link={linkDoAplicativo} nomeBarbearia={nomeDaBarbearia} />
          <NovoClienteModal barbers={[]} />
        </div>
      </div>

      <div className="divider-gold" />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">Total clientes <InfoTip text="Clientes ativos no cadastro. Quem foi desativado sai desta conta." /></p>
          </div>
          <p className="text-3xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>{totalAll ?? 0}</p>
          <p className="text-[10px] text-fg-subtle mt-1">{vips ?? 0} VIPs · {news ?? 0} Novos</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Crown className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">Cliente VIP <InfoTip text="O cliente que mais gastou na barbearia desde o início. Trate bem, ele paga muitas contas." /></p>
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
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">Ticket médio <InfoTip text="Gasto médio por visita entre os 5 clientes que mais gastaram. O ticket médio geral da casa está no Financeiro." /></p>
          </div>
          <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>{formatCurrency(globalTicket)}</p>
          <p className="text-[10px] text-fg-subtle mt-1">Média por atendimento do top 5</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Heart className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted flex items-center gap-1">Recorrentes <InfoTip text="Clientes com mais de uma visita. Recorrência alta significa clientela fiel." /></p>
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

      {/* LISTA / EMPTY STATE */}
      {error ? (
        <div className="card p-8 text-center">
          <p className="text-danger text-sm">
            Erro ao carregar clientes: {error.message}
          </p>
        </div>
      ) : (!customers || customers.length === 0) && !(q || tier) ? (
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
      ) : (
        <CustomersList
          customers={customers}
          initialQuery={q ?? ''}
          initialTier={tier ?? 'all'}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          vipThreshold={vipThreshold}
        />
      )}

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
              const initials = ((c.full_name ?? '').trim().split(/\s+/).map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()) || '?';
              const medalColors = ['text-gold', 'text-gray-300', 'text-amber-600'];
              return (
                <Link key={c.id} href={`/admin/clientes/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-md bg-bg-elevated border border-border/60 hover:border-gold/40 transition-colors">
                  <span className={`w-6 text-center text-sm font-bold flex-shrink-0 ${medalColors[i] ?? 'text-fg-muted'}`}>{i + 1}</span>
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_url} alt={c.full_name ?? 'Cliente'} className="w-8 h-8 rounded-full object-cover border border-gold/30 flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)' }}>{initials}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{c.full_name ?? 'Sem nome'}</p>
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
    </div>
  );
}
