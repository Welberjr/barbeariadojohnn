import { createAdminClient } from '@/lib/supabase/admin';
import { ProductForm } from '../_components/produto-form';

import { lojaAtual } from '@/lib/loja';
export const metadata = {
  title: 'Novo produto',
};

export default async function NovoProdutoPage() {
  const supabase = createAdminClient();

  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('barbershop_id', (await lojaAtual()))
    .order('name');

  return <ProductForm categories={categories ?? []} />;
}
