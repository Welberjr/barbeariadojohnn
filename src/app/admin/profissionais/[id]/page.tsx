import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { StaffForm } from '../_components/staff-form';
import { StaffAccessCard } from '../_components/staff-access-card';
import { DesligarProfissional } from '../_components/desligar-profissional';
import { parseStaffPermissions } from '@/lib/staff-permissions';
import { lojaAtual } from '@/lib/loja';

export const metadata = {
  title: 'Editar profissional',
};

interface EditStaffPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = await params;
  const supabase = createAdminClient();
  const barbershopId = await lojaAtual();

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
      atende_clientes,
      profile_id,
      can_manage,
      permissions,
      must_change_password,
      profile:profiles (
        full_name,
        email,
        phone
      )
    `
    )
    .eq('id', id)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (!staff) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = staff.profile as any;

  // Último acesso sai do próprio Auth, sem precisar de coluna nova
  let ultimoAcesso: string | null = null;
  if (staff.profile_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(
      staff.profile_id as string
    );
    ultimoAcesso = authUser?.user?.last_sign_in_at ?? null;
  }

  return (
    <div className="space-y-6">
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
          atende_clientes: staff.atende_clientes !== false,
        }}
      />

      <StaffAccessCard
        staffId={staff.id}
        displayName={staff.display_name}
        canManage={staff.can_manage === true}
        permissions={parseStaffPermissions(staff.permissions)}
        mustChangePassword={staff.must_change_password === true}
        ultimoAcesso={ultimoAcesso}
        ativo={staff.active !== false}
      />

      <DesligarProfissional
        staffId={staff.id}
        displayName={staff.display_name}
        ativo={staff.active !== false}
      />
    </div>
  );
}
