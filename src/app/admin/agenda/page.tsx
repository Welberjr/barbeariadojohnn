import { createClient } from '@/lib/supabase/server';
import { AgendaView } from './_components/agenda-view';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Agenda',
};

interface AgendaPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();

  // Data do dia que está sendo visualizada (default = hoje)
  const today = new Date();
  const selectedDate = dateParam
    ? new Date(dateParam + 'T00:00:00')
    : today;
  const dateStr = selectedDate.toISOString().split('T')[0];

  // Início e fim do dia (UTC ajustado pra timezone de Brasília -3h)
  const dayStart = `${dateStr}T00:00:00.000-03:00`;
  const dayEnd = `${dateStr}T23:59:59.999-03:00`;

  // Buscar profissionais ativos
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, role, profile_id')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  // Buscar appointments do dia (SEM service_id direto — usa appointment_services)
  const { data: appointmentsRaw } = await supabase
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
    .eq('barbershop_id', BARBERSHOP_ID)
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd)
    .order('start_at');

  // Buscar appointment_services correspondentes (pode ter 1 ou + serviços por appointment)
  const apptIds = (appointmentsRaw ?? []).map((a) => a.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let servicesByAppointment: Record<string, any> = {};

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

  // Buscar barbershop pra pegar horários de funcionamento
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('business_hours')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  // Buscar folgas do dia
  const { data: daysOff } = await supabase
    .from('days_off')
    .select('staff_id, start_date, end_date, reason, type')
    .eq('barbershop_id', BARBERSHOP_ID)
    .lte('start_date', dateStr)
    .gte('end_date', dateStr);

  // Buscar clientes pra dropdown de criar agendamento
  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, phone')
    .eq('active', true)
    .order('full_name')
    .limit(500);

  // Buscar serviços pra dropdown
  const { data: services } = await supabase
    .from('services')
    .select('id, name, base_price, base_duration_minutes, category')
    .eq('active', true)
    .order('display_order');

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
