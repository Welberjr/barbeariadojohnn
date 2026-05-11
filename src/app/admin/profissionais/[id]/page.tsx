import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StaffForm } from '../_components/staff-form';

export const metadata = {
  title: 'Editar profissional',
};

interface EditStaffPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('staff')
    .select(
      `
      id,
      display_name,
      role,
      bio,
      specialties,
      default_commission_percent,
      active,
      profile:profiles (
        full_name,
        email,
        phone
      )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!staff) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = staff.profile as any;

  return (
    <StaffForm
      staffId={staff.id}
      defaultValues={{
        full_name: profile?.full_name ?? '',
        email: profile?.email ?? '',
        phone: profile?.phone ?? '',
        display_name: staff.display_name,
        role: staff.role,
        bio: staff.bio ?? '',
        specialties: staff.specialties ?? [],
        default_commission_percent: Number(staff.default_commission_percent),
        active: staff.active,
      }}
    />
  );
}
