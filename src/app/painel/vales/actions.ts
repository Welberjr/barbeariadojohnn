'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { exigirModulo } from '@/lib/staff-auth';
import { BARBERSHOP_ID } from '@/lib/painel/dados';

const VALOR_MAXIMO = 5000;

/**
 * Pedido de vale do barbeiro.
 *
 * O pedido entra pendente e quem decide e a gestao. O banco tem indice unico
 * parcial garantindo um pendente por profissional, entao duas abas abertas nao
 * viram dois pedidos: a segunda gravacao esbarra no indice.
 */
export async function pedirVale(dados: { valor: number; motivo: string }) {
  const acesso = await exigirModulo('vales_pedir');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, error: 'Informe um valor maior que zero.' };
  }
  if (valor > VALOR_MAXIMO) {
    return { ok: false, error: 'Valor muito alto para pedir pelo painel. Fale com a gestão.' };
  }

  const motivo = (dados.motivo ?? '').trim();
  if (motivo.length < 3) {
    return { ok: false, error: 'Escreva o motivo do vale.' };
  }
  if (motivo.length > 300) {
    return { ok: false, error: 'Motivo muito longo. Resuma em até 300 caracteres.' };
  }

  const admin = createAdminClient();

  const { error } = await admin.from('allowances').insert({
    barbershop_id: BARBERSHOP_ID,
    staff_id: acesso.staff.staffId,
    amount: Number(valor.toFixed(2)),
    reason: motivo,
    status: 'pending',
    requested_at: new Date().toISOString(),
    requested_by: acesso.staff.profileId,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'Você já tem um pedido de vale aguardando resposta. Espere a gestão responder.',
      };
    }
    return { ok: false, error: error.message };
  }

  // Avisa a gestão pelo sino do admin
  await admin.from('notifications').insert({
    barbershop_id: BARBERSHOP_ID,
    staff_id: acesso.staff.staffId,
    type: 'vale_pedido',
    title: `Pedido de vale de ${acesso.staff.displayName}`,
    body: `${acesso.staff.displayName} pediu um vale de R$ ${valor.toFixed(2).replace('.', ',')}. Motivo: ${motivo}`,
    metadata: { valor, motivo, staff_id: acesso.staff.staffId },
  });

  revalidatePath('/painel/vales');
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

/** Cancela o proprio pedido enquanto a gestao nao respondeu. */
export async function cancelarMeuPedidoDeVale(valeId: string) {
  const acesso = await exigirModulo('vales_pedir');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const admin = createAdminClient();

  const { error } = await admin
    .from('allowances')
    .delete()
    .eq('id', valeId)
    .eq('staff_id', acesso.staff.staffId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/vales');
  return { ok: true };
}
