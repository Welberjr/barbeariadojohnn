import { createAdminClient } from '@/lib/supabase/admin';
import { SHOP_TIME_ZONE } from '@/lib/utils';
import { AgendaView } from './_components/agenda-view';

import { lojaAtual } from '@/lib/loja';
export const metadata = {
  title: 'Agenda',
};

interface AgendaPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const { date: dateParam } = await searchParams;
  const supabase = createAdminClient();

  // Data do dia que está sendo visualizada (default = hoje)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date());
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '')
    ? (dateParam as string)
    : today;

  // Início e fim do dia (UTC ajustado pra timezone de Brasília -3h)
  const dayStart = `${dateStr}T00:00:00.000-03:00`;
  const dayEnd = `${dateStr}T23:59:59.999-03:00`;

  // Nenhuma destas consultas depende da outra: todas de uma vez, a aba abre
  // no tempo da mais lenta em vez da soma das seis.
  const [
    { data: staff },
    { data: appointmentsRaw },
    { data: barbershop },
    { data: daysOff },
    { data: customers },
    { data: services },
  ] = await Promise.all([
    // Profissionais ativos
    supabase
      .from('staff')
      .select('id, display_name, role, profile_id')
      .eq('barbershop_id', await lojaAtual())
      .eq('active', true)
      .in('role', ['barber', 'owner', 'manager'])
    .eq('atende_clientes', true)
      .order('display_name'),
    // Appointments do dia (SEM service_id direto — usa appointment_services)
    supabase
      .from('appointments')
      .select(
        `
      id,
      customer_id,
      staff_id,
      start_at,
      end_at,
      status,
      notes,
      customers:customers ( full_name, phone )
    `
      )
      .eq('barbershop_id', (await lojaAtual()))
      .gte('start_at', dayStart)
      .lte('start_at', dayEnd)
      .order('start_at'),
    // Barbershop pra pegar horários de funcionamento
    supabase
      .from('barbershops')
      .select('business_hours')
      .eq('id', (await lojaAtual()))
      .maybeSingle(),
    // Folgas do dia
    supabase
      .from('days_off')
      .select('staff_id, start_date, end_date, reason, type')
      .eq('barbershop_id', (await lojaAtual()))
      .lte('start_date', dateStr)
      .gte('end_date', dateStr),
    // Clientes pra dropdown de criar agendamento
    supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('active', true)
      .order('full_name')
      .limit(500),
    // Serviços pra dropdown
    supabase
      .from('services')
      .select('id, name, base_price, base_duration_minutes, category')
      .eq('barbershop_id', await lojaAtual())
      .eq('active', true)
      .order('display_order'),
  ]);

  // Buscar appointment_services correspondentes (pode ter 1 ou + serviços por appointment)
  const apptIds = (appointmentsRaw ?? []).map((a) => a.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const servicesByAppointment: Record<string, any> = {};

  if (apptIds.length > 0) {
    const { data: apptServices } = await supabase
      .from('appointment_services')
      .select(
        `
        appointment_id,
        service_id,
        price,
        duration_minutes,
        services:services ( name, base_price, base_duration_minutes )
      `
      )
      .in('appointment_id', apptIds);

    for (const as of apptServices ?? []) {
      const aid = as.appointment_id as string;
      // Pega o primeiro serviço de cada appointment (UI atual mostra 1 serviço)
      if (!servicesByAppointment[aid]) {
        servicesByAppointment[aid] = {
          service_id: as.service_id,
          services: as.services,
        };
      }
    }
  }

  // Anexa service_id e services nas appointments (compatibilidade com AgendaView)
  const appointments = (appointmentsRaw ?? []).map((a) => ({
    ...a,
    service_id: servicesByAppointment[a.id]?.service_id ?? null,
    services: servicesByAppointment[a.id]?.services ?? null,
  }));

  return (
    <AgendaView
      selectedDate={dateStr}
      staff={staff ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appointments={appointments as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      businessHours={(barbershop?.business_hours ?? null) as any}
      daysOff={daysOff ?? []}
      customers={customers ?? []}
      services={services ?? []}
    />
  );
}
