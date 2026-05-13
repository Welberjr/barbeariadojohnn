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

  // 1. Comanda + relações
  const { data: comandaRaw } = await supabase
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

  if (!comandaRaw) notFound();

  // 2. Itens da comanda (tabela unificada comanda_items)
  const { data: comandaItems } = await supabase
    .from('comanda_items')
    .select(
      `
      id,
      item_type,
      service_id,
      product_id,
      name,
      quantity,
      unit_price,
      total_price,
      staff_id,
      services:services ( name, base_duration_minutes ),
      products:products ( name ),
      staff:staff ( display_name )
    `
    )
    .eq('comanda_id', id)
    .order('created_at');

  // 3. Separar em services e products para manter compatibilidade com o ComandaDetail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (comandaItems ?? []) as any[];

  const comandaServices = items
    .filter((i) => i.item_type === 'service')
    .map((i) => ({
      id: i.id,
      service_id: i.service_id,
      staff_id: i.staff_id,
      unit_price: i.unit_price,
      quantity: i.quantity,
      subtotal: i.total_price, // mapeia total_price -> subtotal pro client
      services: i.services,
      staff: i.staff,
    }));

  const comandaProducts = items
    .filter((i) => i.item_type === 'product')
    .map((i) => ({
      id: i.id,
      product_id: i.product_id,
      unit_price: i.unit_price,
      quantity: i.quantity,
      subtotal: i.total_price,
      products: i.products,
    }));

  // 4. Buscar pagamento (se existir, comanda fechada)
  const { data: payments } = await supabase
    .from('comanda_payments')
    .select('method')
    .eq('comanda_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  const paymentMethod = payments?.[0]?.method ?? null;

  // 5. Montar objeto comanda compatível com a interface do ComandaDetail
  const subtotalNum = Number(comandaRaw.subtotal ?? 0);
  const totalNum = Number(comandaRaw.total ?? 0);
  const serviceTotal = comandaServices.reduce(
    (s, i) => s + Number(i.subtotal),
    0
  );
  const productTotal = comandaProducts.reduce(
    (s, i) => s + Number(i.subtotal),
    0
  );

  const comanda = {
    ...comandaRaw,
    payment_method: paymentMethod,
    service_total: serviceTotal,
    product_total: productTotal,
    discount: Math.max(0, subtotalNum - totalNum),
    tip: 0,
  };

  // 6. Catálogos auxiliares
  const { data: services } = await supabase
    .from('services')
    .select('id, name, base_price, base_duration_minutes, category')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('display_order');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, category')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('name');

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
        comandaServices={comandaServices as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comandaProducts={comandaProducts as any}
        services={services ?? []}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products={(products ?? []) as any}
        staff={staff ?? []}
      />
    </div>
  );
}
