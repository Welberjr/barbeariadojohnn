import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PlanForm } from '../../_components/plan-form';

export const metadata = {
  title: 'Editar plano',
};

interface EditPlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlanPage({ params }: EditPlanPageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: plan } = await admin
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
        period: plan.period ?? 'monthly',
        allowed_days: (plan.allowed_days ?? [1, 2, 3, 4, 5, 6]) as number[],
        included_uses: Number(plan.included_uses ?? 4),
        barber_share_percent: Number(plan.barber_share_percent ?? 50),
        accumulate_unused: plan.accumulate_unused ?? false,
        show_on_public_menu: plan.show_on_public_menu ?? true,
        active: plan.active ?? true,
        display_order: plan.display_order ?? 0,
      }}
    />
  );
}
