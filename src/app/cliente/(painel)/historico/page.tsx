import Link from 'next/link';
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  Star,
  Scissors,
  Package,
} from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn, formatCurrency } from '@/lib/utils';

export const metadata = { title: 'Histórico' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function HistoricoPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: comandas, count } = await admin
    .from('comandas')
    .select('id, closed_at, total, staff:staff (display_name)', {
      count: 'exact',
    })
    .eq('customer_id', customer.id)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (comandas ?? []) as any[];
  const comandaIds = rows.map((c) => c.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = [];
  const pointsByComanda = new Map<string, number>();
  if (comandaIds.length > 0) {
    const [{ data: itemsRaw }, { data: pointsRaw }] = await Promise.all([
      admin
        .from('comanda_items')
        .select('comanda_id, item_type, name, quantity, total_price')
        .in('comanda_id', comandaIds)
        .order('created_at'),
      admin
        .from('loyalty_points_events')
        .select('comanda_id, points')
        .in('comanda_id', comandaIds)
        .eq('event_type', 'earned_service'),
    ]);
    items = itemsRaw ?? [];
    for (const p of pointsRaw ?? []) {
      pointsByComanda.set(
        p.comanda_id as string,
        (pointsByComanda.get(p.comanda_id as string) ?? 0) + Number(p.points)
      );
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">
          Meus atendimentos
        </p>
        <h1
          className="text-2xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Histórico
        </h1>
        <p className="text-xs text-fg-muted mt-1">
          Tudo que você já fez na barbearia e os pontos que ganhou.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <Receipt className="w-7 h-7 text-fg-subtle mx-auto mb-3" />
          <p className="text-xs text-fg-muted">
            Nenhum atendimento concluído ainda.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((c) => {
              const cItems = items.filter((i) => i.comanda_id === c.id);
              const points = pointsByComanda.get(c.id) ?? 0;
              return (
                <div key={c.id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm text-fg font-medium">
                        {c.closed_at ? fmtDateTime(c.closed_at) : '-'}
                      </p>
                      <p className="text-[11px] text-fg-subtle">
                        Atendido por {c.staff?.display_name ?? '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-lg font-bold text-gold leading-none"
                        style={{ fontFamily: 'var(--font-playfair), serif' }}
                      >
                        {formatCurrency(Number(c.total ?? 0))}
                      </p>
                      {points > 0 && (
                        <p className="text-[10px] text-gold flex items-center gap-1 justify-end mt-1">
                          <Star className="w-2.5 h-2.5 fill-current" />+
                          {points.toLocaleString('pt-BR')} pontos
                        </p>
                      )}
                    </div>
                  </div>

                  {cItems.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-border/50">
                      {cItems.map((i, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-fg-muted flex items-center gap-1.5">
                            {i.item_type === 'product' ? (
                              <Package className="w-3 h-3 text-gold/70" />
                            ) : (
                              <Scissors className="w-3 h-3 text-gold/70" />
                            )}
                            {i.name}
                            {Number(i.quantity) > 1 && ` × ${i.quantity}`}
                          </span>
                          <span className="text-fg">
                            {Number(i.total_price) === 0
                              ? 'Assinatura'
                              : formatCurrency(Number(i.total_price))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Link
                href={`/cliente/historico?page=${page - 1}`}
                className={cn(
                  'btn-secondary text-xs flex items-center gap-1',
                  page <= 1 && 'opacity-40 pointer-events-none'
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </Link>
              <span className="text-xs text-fg-muted px-3">
                {page} / {totalPages}
              </span>
              <Link
                href={`/cliente/historico?page=${page + 1}`}
                className={cn(
                  'btn-secondary text-xs flex items-center gap-1',
                  page >= totalPages && 'opacity-40 pointer-events-none'
                )}
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
