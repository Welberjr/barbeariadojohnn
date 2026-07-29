import Link from 'next/link';
import { CalendarDays, CalendarPlus, Clock, Sparkles } from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { weeklyBonusReason } from '@/lib/weekly-bonus';
import { Raspadinha } from './_components/raspadinha';
import { UpcomingAppointments } from './_components/upcoming-appointments';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function ClienteHomePage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: nextAppointments }, { data: weeklyBonus }] = await Promise.all([
    admin
      .from('appointments')
      .select(`id, start_at, status, staff:staff (display_name),
               appointment_services ( services:services (name) )`)
      .eq('customer_id', customer.id)
      .eq('status', 'scheduled')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(2),
    admin
      .from('loyalty_transactions')
      .select('points')
      .eq('customer_id', customer.id)
      .eq('reason', weeklyBonusReason())
      .maybeSingle(),
  ]);

  const firstName = (customer.full_name ?? 'Cliente').trim().split(/\s+/)[0];
  const hasUpcomingAppointment = (nextAppointments?.length ?? 0) > 0;

  return (
    <div className="space-y-5 animate-fade-in pb-2">
      <section
        className="relative overflow-hidden rounded-2xl px-5 py-6"
        style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1204 62%, #2a1c00 100%)' }}
      >
        <div
          className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C518, transparent)' }}
        />
        <div className="relative space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold/75">
              Área do cliente
            </p>
            <h1
              className="mt-1 text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Olá, {firstName}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              Escolha seu melhor horário em poucos toques.
            </p>
          </div>

          <Link
            href="/cliente/agendar"
            className="btn-gold-shimmer flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base"
          >
            <CalendarPlus className="h-5 w-5" />
            <span>Agendar horário</span>
          </Link>

          <Link
            href="/cliente/agendamentos"
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-gold hover:underline"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Ver minha agenda
          </Link>
        </div>
      </section>

      {hasUpcomingAppointment ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <UpcomingAppointments appointments={(nextAppointments ?? []) as any} />
      ) : (
        <section className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">Nenhum horário marcado</p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              Quando quiser, seu próximo corte começa pelo botão acima.
            </p>
          </div>
        </section>
      )}

      {!weeklyBonus && (
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Seu bônus da semana
          </p>
          <Raspadinha initialBonus={{ used: false, points: null }} />
        </section>
      )}
    </div>
  );
}
