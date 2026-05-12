import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ComandaDetail } from '../_components/comanda-detail';

interface ComandaPageProps {
  params: Promise<{ id: string }>;
}

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export default async function ComandaPage({ params }: ComandaPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: comanda } = await supabase
    .from('comandas')
    .select(
      `
      *,
      customers:customers ( id, full_name, phone ),
      staff:staff ( id, display_name )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!comanda) notFound();

  // Itens
  const { data: comandaServices } = await supabase
    .from('comanda_services')
    .select(
      `
      id,
      service_id,
      staff_id,
      unit_price,
      quantity,
      subtotal,
      services:services ( name, base_duration_minutes ),
      staff:staff ( display_name )
    `
    )
    .eq('comanda_id', id)
    .order('created_at');

  const { data: comandaProducts } = await supabase
    .from('comanda_products')
    .select(
      `
      id,
      product_id,
      unit_price,
      quantity,
      subtotal,
      products:products ( name )
    `
    )
    .eq('comanda_id', id)
    .order('created_at');

  // Serviços disponíveis
  const { data: services } = await supabase
    .from('services')
    .select('id, name, base_price, base_duration_minutes, category')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('display_order');

  // Produtos disponíveis
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, category')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('name');

  // Profissionais
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  return (
    <div className="space-y-4">
      <Link
        href="/admin/comandas"
        className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-gold transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        <span>Voltar para comandas</span>
      </Link>

      <ComandaDetail
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comanda={comanda as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comandaServices={(comandaServices ?? []) as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comandaProducts={(comandaProducts ?? []) as any}
        services={services ?? []}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products={(products ?? []) as any}
        staff={staff ?? []}
      />
    </div>
  );
}
