import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { CustomerForm } from '../_components/customer-form';
import { ConvidarCliente } from '../_components/convidar-clientes';
import { linkDoConvite, mensagemDoConvite } from '@/lib/convite-cliente';

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
  const supabase = createAdminClient();

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
    .eq('atende_clientes', true)
    .order('display_name');

  // O convite so faz sentido para quem ainda nao tem conta
  let convite: { link: string; mensagem: string } | null = null;

  if (!customer.auth_user_id) {
    const cabecalhos = await headers();
    const host = cabecalhos.get('host') ?? 'barbearia-do-johnn.vercel.app';
    const protocolo = host.startsWith('localhost') ? 'http' : 'https';
    const base = `${protocolo}://${host}`;

    const { data: barbearia } = await supabase
      .from('barbershops')
      .select('name')
      .eq('id', customer.barbershop_id)
      .maybeSingle();

    const link = linkDoConvite(customer.id as string, base);
    convite = {
      link,
      mensagem: mensagemDoConvite({
        nomeCliente: customer.full_name as string,
        nomeBarbearia: (barbearia?.name as string) ?? 'Barbearia do Johnn',
        link,
      }),
    };
  }

  return (
    <div className="space-y-6">
      {convite && (
        <ConvidarCliente
          clienteId={customer.id}
          nome={customer.full_name}
          telefone={customer.phone ?? null}
          link={convite.link}
          mensagem={convite.mensagem}
        />
      )}

    <CustomerForm
      customerId={customer.id}
      barbers={barbers ?? []}
      hasAccess={Boolean(customer.auth_user_id)}
      accessEmail={customer.email ?? null}
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
        photo_url: customer.photo_url ?? null,
      }}
    />
    </div>
  );
}
