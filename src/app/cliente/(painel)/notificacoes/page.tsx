import Link from 'next/link';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';
import { MarkAllReadButton } from './_components/mark-all-read-button';

export const metadata = { title: 'Notificações' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NotificacoesPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: notifications, count }, { count: unread }] = await Promise.all([
    admin
      .from('notifications')
      .select('id, title, body, created_at, read_at', { count: 'exact' })
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .range(from, to),
    admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .is('read_at', null),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const unreadCount = unread ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">
            Fique por dentro
          </p>
          <h1
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Notificações
          </h1>
          {unreadCount > 0 && (
            <p className="text-xs text-fg-muted mt-1">
              {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
            </p>
          )}
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {!notifications || notifications.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell className="w-7 h-7 text-fg-subtle mx-auto mb-3" />
          <p className="text-xs text-fg-muted">
            Nada por aqui ainda. Suas confirmações de agendamento, pontos e
            avisos da assinatura vão aparecer aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn('card p-4', !n.read_at && 'border-gold/30')}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-fg font-medium">{n.title}</p>
                  {!n.read_at && (
                    <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-[11px] text-fg-muted mt-1 leading-relaxed whitespace-pre-line">
                  {n.body}
                </p>
                <p className="text-[10px] text-fg-dim mt-1.5">
                  {fmtDateTime(n.created_at)}
                </p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Link
                href={`/cliente/notificacoes?page=${page - 1}`}
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
                href={`/cliente/notificacoes?page=${page + 1}`}
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
