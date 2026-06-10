import Link from 'next/link';
import {
  Calendar,
  Clock,
  Scissors,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
} from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';
import { CancelAppointmentButton } from './_components/cancel-appointment-button';

export const metadata = { title: 'Meus agendamentos' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado', cls: 'bg-gold/10 text-gold border-gold/30' },
  in_progress: { label: 'Em atendimento', cls: 'bg-info/10 text-info border-info/30' },
  completed: { label: 'Concluído', cls: 'bg-success/10 text-success border-success/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-fg-dim/10 text-fg-subtle border-border-strong' },
  no_show: { label: 'Não compareceu', cls: 'bg-danger/10 text-danger border-danger/30' },
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AgendamentosPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const nowISO = new Date().toISOString();

  // Próximos (futuros, agendados)
  const { data: upcoming } = await admin
    .from('appointments')
    .select(
      `id, start_at, end_at, status, subscription_id,
       staff:staff (display_name),
       appointment_services ( price, services:services (name) )`
    )
    .eq('customer_id', customer.id)
    .eq('status', 'scheduled')
    .gte('start_at', nowISO)
    .order('start_at', { ascending: true })
    .limit(20);

  // Histórico paginado (tudo que não é futuro-agendado)
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const {
    data: history,
    count,
  } = await admin
    .from('appointments')
    .select(
      `id, start_at, end_at, status, subscription_id,
       staff:staff (display_name),
       appointment_services ( price, services:services (name) )`,
      { count: 'exact' }
    )
    .eq('customer_id', customer.id)
    .or(`status.neq.scheduled,start_at.lt.${nowISO}`)
    .order('start_at', { ascending: false })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderCard(a: any, withCancel: boolean) {
    const serviceNames = (a.appointment_services ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => s.services?.name)
      .filter(Boolean)
      .join(' + ');
    const status = STATUS_CONFIG[a.status as string] ?? STATUS_CONFIG.scheduled;

    return (
      <div key={a.id} className="card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-fg font-medium">
                {serviceNames || 'Atendimento'}
              </p>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold border',
                  status.cls
                )}
              >
                {status.label}
              </span>
              {a.subscription_id && (
                <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold bg-gold/10 text-gold border border-gold/30">
                  Assinatura
                </span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {fmtDateTime(a.start_at)} · {a.staff?.display_name ?? '-'}
            </p>
          </div>
          {withCancel && a.status === 'scheduled' && (
            <CancelAppointmentButton
              appointmentId={a.id}
              startAt={a.start_at}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">
            Minha agenda
          </p>
          <h1
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Meus agendamentos
          </h1>
        </div>
        <Link
          href="/cliente/agendar"
          className="btn-gold-outline text-xs flex items-center gap-1.5"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>Novo</span>
        </Link>
      </div>

      {/* PRÓXIMOS */}
      <section className="space-y-3">
        <h2
          className="text-base font-semibold text-fg flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <Calendar className="w-4 h-4 text-gold" />
          Próximos
        </h2>
        {!upcoming || upcoming.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-xs text-fg-muted">
              Nenhum agendamento futuro.{' '}
              <Link href="/cliente/agendar" className="text-gold hover:underline">
                Agendar agora
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(upcoming as any[]).map((a) => renderCard(a, true))}
          </div>
        )}
      </section>

      {/* HISTÓRICO */}
      <section className="space-y-3">
        <h2
          className="text-base font-semibold text-fg flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <Clock className="w-4 h-4 text-gold" />
          Histórico
        </h2>
        {!history || history.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-xs text-fg-muted">Nada por aqui ainda.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(history as any[]).map((a) => renderCard(a, false))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Link
                  href={`/cliente/agendamentos?page=${page - 1}`}
                  aria-disabled={page <= 1}
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
                  href={`/cliente/agendamentos?page=${page + 1}`}
                  aria-disabled={page >= totalPages}
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
      </section>
    </div>
  );
}
