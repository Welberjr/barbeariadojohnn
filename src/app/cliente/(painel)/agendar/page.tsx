import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveSubscription, SHOP_TZ } from '@/lib/subscriptions';
import { BookingWizard } from './_components/booking-wizard';

export const metadata = { title: 'Agendar' };
export const dynamic = 'force-dynamic';

const DAYS_AHEAD = 14;

interface DayOption {
  dateStr: string; // yyyy-mm-dd no fuso da barbearia
  dow: number; // 0=Dom..6=Sáb
  dayNum: string;
  weekdayShort: string;
  monthShort: string;
  isToday: boolean;
}

function buildDays(): DayOption[] {
  const days: DayOption[] = [];
  const now = new Date();

  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const weekdayFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SHOP_TZ,
    weekday: 'short',
  });
  const dayFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SHOP_TZ,
    day: '2-digit',
  });
  const monthFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SHOP_TZ,
    month: 'short',
  });
  const dowFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TZ,
    weekday: 'short',
  });
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    days.push({
      dateStr: dateFmt.format(d),
      dow: dowMap[dowFmt.format(d)] ?? d.getDay(),
      dayNum: dayFmt.format(d),
      weekdayShort: weekdayFmt.format(d).replace('.', ''),
      monthShort: monthFmt.format(d).replace('.', ''),
      isToday: i === 0,
    });
  }
  return days;
}

export default async function AgendarPage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: services }, { data: staff }, { data: staffServices }, sub] =
    await Promise.all([
      admin
        .from('services')
        .select('id, name, description, category, base_price, base_duration_minutes')
        .eq('active', true)
        .order('category', { ascending: true })
        .order('display_order', { ascending: true }),
      admin
        .from('staff')
        .select('id, display_name')
        .eq('active', true)
        .in('role', ['barber', 'owner', 'manager'])
        .order('display_name'),
      admin
        .from('staff_services')
        .select('staff_id, service_id, custom_price, custom_duration_minutes, active'),
      getActiveSubscription(admin, customer.id),
    ]);

  // Servicos cobertos pelo plano (vazio = todos)
  let coveredServiceIds: string[] = [];
  if (sub) {
    const { data: planServices } = await admin
      .from('subscription_plan_services')
      .select('service_id')
      .eq('plan_id', sub.plan.id);
    coveredServiceIds = (planServices ?? []).map((p) => p.service_id as string);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">
          Agendamento online
        </p>
        <h1
          className="text-2xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Agendar horário
        </h1>
        <p className="text-xs text-fg-muted mt-1">
          Escolha o serviço, o barbeiro e o melhor horário em tempo real.
        </p>
      </div>

      <BookingWizard
        services={(services ?? []).map((s) => ({
          id: s.id as string,
          name: s.name as string,
          description: (s.description as string | null) ?? null,
          category: (s.category as string | null) ?? 'Outros',
          base_price: Number(s.base_price ?? 0),
          base_duration_minutes: Number(s.base_duration_minutes ?? 30),
        }))}
        staff={(staff ?? []).map((s) => ({
          id: s.id as string,
          display_name: s.display_name as string,
        }))}
        staffServices={(staffServices ?? []).map((ss) => ({
          staff_id: ss.staff_id as string,
          service_id: ss.service_id as string,
          custom_price: ss.custom_price != null ? Number(ss.custom_price) : null,
          custom_duration_minutes:
            ss.custom_duration_minutes != null
              ? Number(ss.custom_duration_minutes)
              : null,
          active: ss.active !== false,
        }))}
        days={buildDays()}
        subscription={
          sub
            ? {
                planName: sub.plan.name,
                allowedDays: sub.plan.allowed_days,
                usesLeft: sub.usesLeft,
                includedUses: sub.plan.included_uses,
                isExpired: sub.isExpired,
                coveredServiceIds,
              }
            : null
        }
      />
    </div>
  );
}
