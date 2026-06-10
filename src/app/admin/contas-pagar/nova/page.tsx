import { createAdminClient } from '@/lib/supabase/admin';
import { BillForm } from '../_components/bill-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Nova conta a pagar',
};

export default async function NovaContaPage() {
  const supabase = createAdminClient();

  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('display_order')
    .order('name');

  return <BillForm categories={categories ?? []} />;
}
