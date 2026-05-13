'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface ProductFormData {
  name: string;
  brand?: string | null;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category_id?: string | null;
  photo_url?: string | null;
  cost_price: number;
  sale_price: number;
  default_commission_percent: number;
  stock_current: number;
  stock_minimum: number;
  is_sellable: boolean;
  active: boolean;
}

function nullIfEmpty(v?: string | null) {
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createProduct(data: ProductFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('products').insert({
    barbershop_id: BARBERSHOP_ID,
    name: data.name,
    brand: nullIfEmpty(data.brand),
    description: nullIfEmpty(data.description),
    sku: nullIfEmpty(data.sku),
    barcode: nullIfEmpty(data.barcode),
    category_id: data.category_id || null,
    photo_url: nullIfEmpty(data.photo_url),
    cost_price: data.cost_price,
    sale_price: data.sale_price,
    default_commission_percent: data.default_commission_percent,
    stock_current: data.stock_current,
    stock_minimum: data.stock_minimum,
    is_sellable: data.is_sellable,
    active: data.active,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/produtos');
  return { ok: true };
}

export async function updateProduct(productId: string, data: ProductFormData) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('products')
    .update({
      name: data.name,
      brand: nullIfEmpty(data.brand),
      description: nullIfEmpty(data.description),
      sku: nullIfEmpty(data.sku),
      barcode: nullIfEmpty(data.barcode),
      category_id: data.category_id || null,
      photo_url: nullIfEmpty(data.photo_url),
      cost_price: data.cost_price,
      sale_price: data.sale_price,
      default_commission_percent: data.default_commission_percent,
      stock_current: data.stock_current,
      stock_minimum: data.stock_minimum,
      is_sellable: data.is_sellable,
      active: data.active,
    })
    .eq('id', productId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/produtos');
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true };
}

export async function deleteProduct(productId: string) {
  const admin = createAdminClient();

  // Soft delete: desativa
  const { error } = await admin
    .from('products')
    .update({ active: false })
    .eq('id', productId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/produtos');
  return { ok: true };
}

/**
 * Ajusta estoque manualmente (entrada / saída / ajuste).
 */
export async function adjustStock(
  productId: string,
  delta: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _reason?: string
) {
  const admin = createAdminClient();

  // Pega estoque atual
  const { data: prod } = await admin
    .from('products')
    .select('stock_current')
    .eq('id', productId)
    .maybeSingle();

  if (!prod) return { ok: false, error: 'Produto não encontrado' };

  const newStock = Math.max(0, Number(prod.stock_current ?? 0) + delta);

  const { error } = await admin
    .from('products')
    .update({ stock_current: newStock })
    .eq('id', productId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/produtos');
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true, new_stock: newStock };
}
