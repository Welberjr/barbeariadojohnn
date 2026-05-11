import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CustomerForm } from '../_components/customer-form';

export const metadata = {
  title: 'Editar cliente',
};

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  // Buscar barbeiros ativos
  const { data: barbers } = await supabase
    .from('staff')
    .select('id, display_name')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  return (
    <CustomerForm
      customerId={customer.id}
      barbers={barbers ?? []}
      defaultValues={{
        full_name: customer.full_name,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        cpf: customer.cpf ?? '',
        birth_date: customer.birth_date ?? '',
        notes: customer.notes ?? '',
        allergies: customer.allergies ?? '',
        preferred_barber_id: customer.preferred_barber_id ?? '',
        accepts_marketing: customer.accepts_marketing,
        active: customer.active,
      }}
    />
  );
}
