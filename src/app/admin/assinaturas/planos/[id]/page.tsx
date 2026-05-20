import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlanForm } from '../../_components/plan-form';

export const metadata = {
  title: 'Editar plano',
};

interface EditPlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlanPage({ params }: EditPlanPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!plan) notFound();

  return (
    <PlanForm
      planId={plan.id}
      defaultValues={{
        name: plan.name,
        description: plan.description ?? '',
        price: Number(plan.price ?? 0),
        billing_cycle: plan.billing_cycle ?? 'monthly',
        includes_count: Number(plan.includes_count ?? 0),
        discount_percent_on_extras: Number(
          plan.discount_percent_on_extras ?? 0
        ),
        active: plan.active ?? true,
        display_order: plan.display_order ?? 0,
      }}
    />
  );
}
