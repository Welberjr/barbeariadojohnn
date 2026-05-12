import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ServiceForm } from '../_components/service-form';
import { ServiceStaffManager } from '../_components/service-staff-manager';

export const metadata = {
  title: 'Editar serviço',
};

interface EditServicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!service) {
    notFound();
  }

  // Profissionais já vinculados a este serviço
  const { data: associations } = await supabase
    .from('staff_services')
    .select(
      `
      staff_id,
      custom_price,
      custom_duration_minutes,
      custom_commission_percent,
      active,
      staff:staff (
        id,
        display_name,
        role
      )
    `
    )
    .eq('service_id', id);

  // Todos os profissionais ativos
  const { data: allStaff } = await supabase
    .from('staff')
    .select('id, display_name, role')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentAssociations = (associations ?? []).map((a: any) => ({
    staff_id: a.staff_id,
    display_name: a.staff?.display_name ?? '?',
    role: a.staff?.role ?? '?',
    custom_price: a.custom_price != null ? Number(a.custom_price) : null,
    custom_duration_minutes: a.custom_duration_minutes,
    custom_commission_percent:
      a.custom_commission_percent != null
        ? Number(a.custom_commission_percent)
        : null,
    active: a.active,
  }));

  return (
    <div className="space-y-6">
      <ServiceForm
        serviceId={service.id}
        defaultValues={{
          name: service.name,
          description: service.description ?? '',
          category: service.category ?? '',
          base_price: Number(service.base_price),
          base_duration_minutes: service.base_duration_minutes,
          base_commission_percent: Number(service.base_commission_percent),
          show_on_public_menu: service.show_on_public_menu,
          display_order: service.display_order,
          active: service.active,
        }}
      />

      <div className="max-w-3xl">
        <ServiceStaffManager
          serviceId={service.id}
          basePrice={Number(service.base_price)}
          baseDuration={service.base_duration_minutes}
          baseCommission={Number(service.base_commission_percent)}
          currentAssociations={currentAssociations}
          availableStaff={allStaff ?? []}
        />
      </div>
    </div>
  );
}
