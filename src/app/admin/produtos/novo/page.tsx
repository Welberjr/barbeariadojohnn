import { createAdminClient } from '@/lib/supabase/admin';
import { ProductForm } from '../_components/produto-form';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Novo produto',
};

export default async function NovoProdutoPage() {
  const supabase = createAdminClient();

  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('name');

  return <ProductForm categories={categories ?? []} />;
}
