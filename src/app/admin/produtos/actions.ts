'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';

import { lojaAtual } from '@/lib/loja';
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
  const admin = await createManagerClient();

  const { error } = await admin.from('products').insert({
    barbershop_id: (await lojaAtual()),
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

export async function duplicateProductAction(productId: string) {
  const admin = await createManagerClient();

  const { data: original, error: errFetch } = await admin
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('barbershop_id', (await lojaAtual()))
    .single();

  if (errFetch || !original) {
    return { ok: false as const, error: errFetch?.message ?? 'Produto não encontrado' };
  }

  const { data: copy, error: errInsert } = await admin
    .from('products')
    .insert({
      barbershop_id: (await lojaAtual()),
      category_id: original.category_id,
      name: `${original.name} (cópia)`,
      brand: original.brand,
      description: original.description,
      sku: null,
      barcode: null,
      photo_url: original.photo_url,
      cost_price: original.cost_price,
      sale_price: original.sale_price,
      default_commission_percent: original.default_commission_percent,
      stock_current: 0,
      stock_minimum: original.stock_minimum,
      is_sellable: original.is_sellable,
      active: original.active,
    })
    .select('id')
    .single();

  if (errInsert || !copy) {
    return { ok: false as const, error: errInsert?.message ?? 'Erro ao duplicar' };
  }

  revalidatePath('/admin/produtos');
  return { ok: true as const, id: copy.id as string };
}

export async function updateProduct(productId: string, data: ProductFormData) {
  const admin = await createManagerClient();

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
  const admin = await createManagerClient();

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
 * Registra venda avulsa de produto (sem comanda). Debita estoque e cria transação.
 */
export async function registerSale(productId: string, quantity: number) {
  const admin = await createManagerClient();

  const { data: prod } = await admin
    .from('products')
    .select('name, stock_current, sale_price, cost_price, is_sellable')
    .eq('id', productId)
    .maybeSingle();

  if (!prod) return { ok: false as const, error: 'Produto não encontrado' };
  if (!prod.is_sellable) return { ok: false as const, error: 'Produto não disponível para venda' };
  if (Number(prod.stock_current) < quantity)
    return { ok: false as const, error: `Estoque insuficiente (${prod.stock_current} em estoque)` };

  const newStock = Number(prod.stock_current) - quantity;
  const totalValue = Number(prod.sale_price) * quantity;
  const totalCost = Number(prod.cost_price ?? 0) * quantity;

  // Registra a transacao guardando tambem o custo (cost_amount) para DRE/lucro.
  // Se a coluna cost_amount ainda nao existir no banco, insere sem ela.
  const txPayload = {
    barbershop_id: (await lojaAtual()),
    type: 'product',
    amount: totalValue,
    cost_amount: totalCost,
    description: `Venda avulsa: ${prod.name} (${quantity}x)`,
    category: 'Produtos',
    occurred_at: new Date().toISOString(),
  };
  let { error: errTx } = await admin.from('transactions').insert(txPayload);
  if (errTx && String(errTx.message ?? '').includes('cost_amount')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cost_amount: _omit, ...legacyPayload } = txPayload;
    const retry = await admin.from('transactions').insert(legacyPayload);
    errTx = retry.error;
  }
  if (errTx) return { ok: false as const, error: errTx.message };

  const { error: errStock } = await admin
    .from('products')
    .update({ stock_current: newStock })
    .eq('id', productId);

  if (errStock) return { ok: false as const, error: errStock.message };

  revalidatePath('/admin/produtos');
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin/dre');
  return { ok: true as const, new_stock: newStock };
}

/**
 * Desativa produto (soft delete) - usado pela tabela de produtos.
 */
export async function deactivateProductAction(productId: string) {
  const admin = await createManagerClient();
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
  const admin = await createManagerClient();

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

// =============================================================================
// FOTO DO PRODUTO (Supabase Storage, bucket publico product-photos)
// =============================================================================

const TIPOS_FOTO_ACEITOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Sobe a foto do produto e devolve a URL publica.
 * A foto aparece na lista de produtos, na comanda e na loja do cliente, entao
 * vale a pena o barbeiro conseguir tirar do celular na hora do cadastro.
 */
export async function uploadProductPhoto(formData: FormData) {
  const file = formData.get('photo');
  if (!file || !(file instanceof File)) {
    return { ok: false as const, error: 'Nenhum arquivo enviado' };
  }

  const ext = TIPOS_FOTO_ACEITOS[file.type];
  if (!ext) {
    return { ok: false as const, error: 'Formato inválido. Use JPG, PNG ou WEBP.' };
  }
  if (file.size > MAX_FOTO_BYTES) {
    return { ok: false as const, error: 'Imagem muito grande. O limite é 5MB.' };
  }

  const admin = await createManagerClient();
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error } = await admin.storage
    .from('product-photos')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) return { ok: false as const, error: error.message };

  const { data: pub } = admin.storage.from('product-photos').getPublicUrl(path);
  return { ok: true as const, url: pub.publicUrl };
}
