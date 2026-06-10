import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { BillForm } from '../_components/bill-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Editar conta a pagar',
};

interface EditBillPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBillPage({ params }: EditBillPageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: bill } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!bill) notFound();

  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('display_order')
    .order('name');

  return (
    <BillForm
      billId={bill.id}
      categories={categories ?? []}
      isPaid={bill.status === 'paid'}
      isRecurring={bill.is_recurring ?? false}
      defaultValues={{
        description: bill.description ?? '',
        amount: Number(bill.amount ?? 0),
        due_date: bill.due_date,
        category_id: bill.category_id ?? '',
        supplier: bill.supplier ?? '',
        notes: bill.notes ?? '',
        is_recurring: bill.is_recurring ?? false,
        recurrence_type: bill.recurrence_type ?? 'monthly',
        recurrence_day: bill.recurrence_day ?? null,
        status: bill.status ?? 'pending',
      }}
    />
  );
}
