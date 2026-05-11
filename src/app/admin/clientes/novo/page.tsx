import { createClient } from '@/lib/supabase/server';
import { CustomerForm } from '../_components/customer-form';

export const metadata = {
  title: 'Novo cliente',
};

export default async function NovoClientePage() {
  const supabase = await createClient();

  // Buscar barbeiros ativos pra dropdown de "profissional preferido"
  const { data: barbers } = await supabase
    .from('staff')
    .select('id, display_name')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  return <CustomerForm barbers={barbers ?? []} />;
}
