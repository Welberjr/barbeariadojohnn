import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ServiceForm } from '../_components/service-form';

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

  return (
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
  );
}
