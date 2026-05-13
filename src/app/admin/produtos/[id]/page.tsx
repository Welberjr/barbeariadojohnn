import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductForm } from '../_components/produto-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Editar produto',
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!product) notFound();

  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('name');

  return (
    <ProductForm
      productId={product.id}
      categories={categories ?? []}
      defaultValues={{
        name: product.name,
        brand: product.brand ?? '',
        description: product.description ?? '',
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        category_id: product.category_id ?? '',
        photo_url: product.photo_url ?? '',
        cost_price: Number(product.cost_price ?? 0),
        sale_price: Number(product.sale_price ?? 0),
        default_commission_percent: Number(
          product.default_commission_percent ?? 10
        ),
        stock_current: Number(product.stock_current ?? 0),
        stock_minimum: Number(product.stock_minimum ?? 5),
        is_sellable: product.is_sellable ?? true,
        active: product.active ?? true,
      }}
    />
  );
}
