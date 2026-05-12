import { createClient } from '@/lib/supabase/server';
import { Clock, CalendarOff, Plus } from 'lucide-react';
import { BusinessHoursForm } from './_components/business-hours-form';
import { DaysOffList } from './_components/days-off-list';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Disponibilidade',
};

const DEFAULT_HOURS = {
  monday: { open: '09:00', close: '20:00', closed: false },
  tuesday: { open: '09:00', close: '20:00', closed: false },
  wednesday: { open: '09:00', close: '20:00', closed: false },
  thursday: { open: '09:00', close: '20:00', closed: false },
  friday: { open: '09:00', close: '20:00', closed: false },
  saturday: { open: '09:00', close: '20:00', closed: false },
  sunday: { open: '09:00', close: '13:00', closed: true },
};

export default async function DisponibilidadePage() {
  const supabase = await createClient();

  // Buscar configuração de horários da barbearia
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('business_hours')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  // Buscar folgas futuras (próximos 90 dias)
  const today = new Date().toISOString().split('T')[0];

  const { data: daysOff } = await supabase
    .from('days_off')
    .select(
      `
      id,
      staff_id,
      start_date,
      end_date,
      reason,
      type,
      staff:staff (
        display_name
      )
    `
    )
    .gte('end_date', today)
    .order('start_date', { ascending: true });

  // Buscar todos profissionais ativos
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, role')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  const businessHours = (barbershop?.business_hours as typeof DEFAULT_HOURS) ?? DEFAULT_HOURS;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ============= HEADER ============= */}
      <div>
        <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold mb-1">
          Operação
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Disponibilidade
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Configure os horários de funcionamento e as folgas/bloqueios de cada profissional.
        </p>
      </div>

      {/* ============= HORÁRIOS DE FUNCIONAMENTO ============= */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Horários de Funcionamento
          </h2>
        </div>
        <p className="text-xs text-fg-muted mb-5">
          Define os horários em que a barbearia atende. Profissionais podem ter horários customizados nas folgas.
        </p>

        <BusinessHoursForm initialHours={businessHours} />
      </section>

      {/* ============= FOLGAS / BLOQUEIOS ============= */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-gold" />
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Folgas e Bloqueios
            </h2>
          </div>
          <a
            href="#nova-folga"
            className="btn-gold-outline text-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova folga</span>
          </a>
        </div>
        <p className="text-xs text-fg-muted mb-5">
          Folgas, férias e feriados que bloqueiam agendamentos. Pode ser para um profissional específico ou para a barbearia toda.
        </p>

        <DaysOffList
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          daysOff={(daysOff ?? []) as any}
          availableStaff={staff ?? []}
        />
      </section>
    </div>
  );
}
