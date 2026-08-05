/**
 * Estoque sem corrida.
 *
 * O jeito antigo lia o estoque, somava em JavaScript e gravava o resultado:
 * duas vendas ao mesmo tempo liam o mesmo numero e uma sobrescrevia a outra.
 * Aqui a conta acontece dentro do banco (RPC ajustar_estoque, criada pela
 * migracao admin-fechar-comanda-atomico.sql), numa instrucao so.
 *
 * Enquanto a migracao nao estiver aplicada, cai no jeito antigo, que funciona
 * mas tem a janela de corrida. Assim o deploy nao depende da ordem.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { lojaAtual } from '@/lib/loja';

export async function ajustarEstoque(
  productId: string,
  delta: number
): Promise<{ ok: true; estoque: number } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const barbershopId = await lojaAtual();

  const rpc = await admin.rpc('ajustar_estoque', {
    p_product_id: productId,
    p_barbershop_id: barbershopId,
    p_delta: Math.trunc(delta),
  });

  if (!rpc.error) return { ok: true, estoque: Number(rpc.data ?? 0) };

  const msg = rpc.error.message ?? '';
  if (/PRODUTO_NAO_ENCONTRADO/.test(msg)) {
    return { ok: false, error: 'Produto não encontrado nesta unidade.' };
  }

  const rpcAindaNaoExiste =
    rpc.error.code === 'PGRST202' ||
    (/ajustar_estoque/i.test(msg) && /(find|exist|schema cache)/i.test(msg));
  if (!rpcAindaNaoExiste) return { ok: false, error: msg };

  // Caminho antigo, para o banco que ainda nao tem a RPC
  const { data: produto } = await admin
    .from('products')
    .select('stock_current')
    .eq('id', productId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();
  if (!produto) return { ok: false, error: 'Produto não encontrado nesta unidade.' };

  const novo = Math.max(0, Number(produto.stock_current ?? 0) + Math.trunc(delta));
  const { error } = await admin
    .from('products')
    .update({ stock_current: novo })
    .eq('id', productId)
    .eq('barbershop_id', barbershopId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, estoque: novo };
}
