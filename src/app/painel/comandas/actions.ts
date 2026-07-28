'use server';

/**
 * Comanda do barbeiro.
 *
 * Acoes proprias e curtas, nao as do admin: as do admin foram escritas
 * supondo poder total e recebem identificadores do formulario. Aqui todo
 * caminho comeca por minhaComandaAberta(), que so devolve comanda aberta cujo
 * dono e o profissional da sessao.
 *
 * O que o painel NAO faz de proposito: desconto (nao existe teto por
 * profissional no modelo), reabrir comanda fechada e apagar comanda. Isso
 * continua no admin.
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { exigirModulo, type SessionStaff } from '@/lib/staff-auth';
import { BARBERSHOP_ID } from '@/lib/painel/dados';
import { getActiveSubscription, isDayAllowed, formatAllowedDays } from '@/lib/subscriptions';
import { calcularFechamento, normalizarMetodo } from '@/lib/painel/comanda-calculo';
import { awardPointsForComanda } from '@/lib/loyalty';
import { notifyCustomer } from '@/lib/notifications';

/** Guarda de dono. Toda acao passa por aqui antes de tocar no banco. */
async function minhaComandaAberta(comandaId: string, staff: SessionStaff) {
  const admin = createAdminClient();

  const { data: comanda } = await admin
    .from('comandas')
    .select('id, customer_id, appointment_id, status, subtotal, staff_id')
    .eq('id', comandaId)
    .eq('staff_id', staff.staffId)
    .maybeSingle();

  if (!comanda) return { ok: false as const, error: 'Esta comanda não é sua.' };
  if (comanda.status !== 'open') {
    return { ok: false as const, error: 'Esta comanda já está fechada.' };
  }

  return { ok: true as const, comanda };
}

async function recalcularTotal(comandaId: string) {
  const admin = createAdminClient();
  const { data: itens } = await admin
    .from('comanda_items')
    .select('total_price')
    .eq('comanda_id', comandaId);

  const subtotal = (itens ?? []).reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  await admin
    .from('comandas')
    .update({ subtotal, total: subtotal, net_total: subtotal })
    .eq('id', comandaId);
}

// ------------------------------------------------------------------
// Abertura
// ------------------------------------------------------------------

export async function abrirMinhaComanda(dados: {
  customerId?: string;
  appointmentId?: string;
}) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const admin = createAdminClient();
  let customerId = dados.customerId ?? null;

  if (dados.appointmentId) {
    const { data: agendamento } = await admin
      .from('appointments')
      .select('id, customer_id, comanda_id, staff_id')
      .eq('id', dados.appointmentId)
      .eq('staff_id', acesso.staff.staffId)
      .maybeSingle();

    if (!agendamento) return { ok: false, error: 'Este atendimento não é seu.' };
    if (agendamento.comanda_id) {
      return { ok: true, comandaId: agendamento.comanda_id as string };
    }
    customerId = agendamento.customer_id as string;
  }

  if (!customerId) return { ok: false, error: 'Escolha o cliente da comanda.' };

  // Uma comanda aberta por cliente evita duas contas no mesmo atendimento
  const { data: jaAberta } = await admin
    .from('comandas')
    .select('id')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('customer_id', customerId)
    .eq('staff_id', acesso.staff.staffId)
    .eq('status', 'open')
    .maybeSingle();

  if (jaAberta) return { ok: true, comandaId: jaAberta.id as string };

  const { data: criada, error } = await admin
    .from('comandas')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: customerId,
      staff_id: acesso.staff.staffId,
      appointment_id: dados.appointmentId ?? null,
      status: 'open',
      subtotal: 0,
      total: 0,
      net_total: 0,
      opened_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  if (dados.appointmentId) {
    await admin
      .from('appointments')
      .update({ comanda_id: criada.id })
      .eq('id', dados.appointmentId)
      .eq('staff_id', acesso.staff.staffId);
  }

  revalidatePath('/painel/comandas');
  return { ok: true, comandaId: criada.id as string };
}

// ------------------------------------------------------------------
// Itens
// ------------------------------------------------------------------

export async function lancarServico(dados: {
  comandaId: string;
  serviceId: string;
  usarAssinatura: boolean;
}) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const dono = await minhaComandaAberta(dados.comandaId, acesso.staff);
  if (!dono.ok) return { ok: false, error: dono.error };

  const admin = createAdminClient();
  const { comanda } = dono;

  const { data: servico } = await admin
    .from('services')
    .select('name, base_price')
    .eq('id', dados.serviceId)
    .maybeSingle();

  if (!servico) return { ok: false, error: 'Serviço não encontrado.' };

  const preco = Number(servico.base_price ?? 0);

  // -------- Coberto pela assinatura --------
  if (dados.usarAssinatura) {
    if (!comanda.customer_id) {
      return { ok: false, error: 'Comanda sem cliente vinculado.' };
    }

    const sub = await getActiveSubscription(admin, comanda.customer_id as string);
    if (!sub) return { ok: false, error: 'Este cliente não tem assinatura ativa.' };
    if (sub.isExpired) {
      return {
        ok: false,
        error: 'A assinatura está vencida. O cliente precisa pagar no caixa antes de usar.',
      };
    }
    if (!isDayAllowed(new Date(), sub.plan.allowed_days)) {
      return {
        ok: false,
        error: `O plano dele cobre ${formatAllowedDays(sub.plan.allowed_days).toLowerCase()}. Hoje cobra avulso.`,
      };
    }

    const { data: servicosDoPlano } = await admin
      .from('subscription_plan_services')
      .select('service_id')
      .eq('plan_id', sub.plan.id);

    if (servicosDoPlano && servicosDoPlano.length > 0) {
      const incluso = servicosDoPlano.some((p) => p.service_id === dados.serviceId);
      if (!incluso) return { ok: false, error: 'Este serviço não está incluso no plano.' };
    }

    const { data: item, error: erroItem } = await admin
      .from('comanda_items')
      .insert({
        barbershop_id: BARBERSHOP_ID,
        comanda_id: dados.comandaId,
        item_type: 'service',
        service_id: dados.serviceId,
        name: `${servico.name} (Assinatura)`,
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        staff_id: acesso.staff.staffId,
        commission_percent: 0,
        commission_value: 0,
        subscription_id: sub.id,
      })
      .select('id')
      .single();

    if (erroItem || !item) {
      return { ok: false, error: erroItem?.message ?? 'Erro ao lançar o serviço.' };
    }

    // A contagem do saldo acontece dentro da funcao, com a assinatura travada:
    // dois barbeiros em abas diferentes nao gastam o mesmo ultimo uso.
    const { data: usageId, error: erroUso } = await admin.rpc('claim_subscription_use', {
      p_subscription_id: sub.id,
      p_included_uses: sub.plan.included_uses,
      p_barbershop_id: BARBERSHOP_ID,
      p_staff_id: acesso.staff.staffId,
      p_service_id: dados.serviceId,
      p_comanda_id: dados.comandaId,
      p_comanda_item_id: item.id,
      p_value_saved: preco,
      p_period_start: sub.current_period_start,
      p_period_end: sub.current_period_end,
    });

    if (erroUso || !usageId) {
      // Sem uso registrado, o item nao pode ficar de pe
      await admin.from('comanda_items').delete().eq('id', item.id);

      const semSaldo = /SEM_SALDO/.test(erroUso?.message ?? '');
      return {
        ok: false,
        error: semSaldo
          ? 'A assinatura ficou sem usos neste ciclo. Cobre como avulso.'
          : erroUso?.message ?? 'Erro ao registrar o uso da assinatura.',
      };
    }

    await admin
      .from('comanda_items')
      .update({ subscription_usage_id: usageId })
      .eq('id', item.id);

    await recalcularTotal(dados.comandaId);

    const usadosAgora = sub.usedInCycle + 1;
    await notifyCustomer({
      customerId: comanda.customer_id as string,
      type: 'assinatura_uso',
      title: `Assinatura: uso ${usadosAgora} de ${sub.plan.included_uses}`,
      body: `Seu atendimento de hoje (${servico.name}) foi coberto pela assinatura. Você usou ${usadosAgora} de ${sub.plan.included_uses} atendimentos deste ciclo.`,
      metadata: { comanda_id: dados.comandaId, subscription_id: sub.id },
    });

    revalidatePath('/painel/comandas');
    return { ok: true, coberto: true };
  }

  // -------- Avulso --------
  const percentual = acesso.staff.commissionPercent;
  const comissao = (preco * percentual) / 100;

  const { error } = await admin.from('comanda_items').insert({
    barbershop_id: BARBERSHOP_ID,
    comanda_id: dados.comandaId,
    item_type: 'service',
    service_id: dados.serviceId,
    name: servico.name,
    quantity: 1,
    unit_price: preco,
    total_price: preco,
    staff_id: acesso.staff.staffId,
    commission_percent: percentual,
    commission_value: comissao,
  });

  if (error) return { ok: false, error: error.message };

  await recalcularTotal(dados.comandaId);
  revalidatePath('/painel/comandas');
  return { ok: true };
}

export async function lancarProduto(dados: {
  comandaId: string;
  productId: string;
  quantidade: number;
}) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const dono = await minhaComandaAberta(dados.comandaId, acesso.staff);
  if (!dono.ok) return { ok: false, error: dono.error };

  const quantidade = Math.max(1, Math.floor(Number(dados.quantidade) || 1));
  const admin = createAdminClient();

  const { data: produto } = await admin
    .from('products')
    .select('name, sale_price, stock_current, default_commission_percent')
    .eq('id', dados.productId)
    .maybeSingle();

  if (!produto) return { ok: false, error: 'Produto não encontrado.' };

  const estoque = Number(produto.stock_current ?? 0);
  if (estoque < quantidade) {
    return {
      ok: false,
      error: estoque > 0 ? `Só restam ${estoque} no estoque.` : 'Produto sem estoque.',
    };
  }

  const preco = Number(produto.sale_price ?? 0);
  const total = preco * quantidade;
  const percentual = Number(produto.default_commission_percent ?? 0);

  const { error } = await admin.from('comanda_items').insert({
    barbershop_id: BARBERSHOP_ID,
    comanda_id: dados.comandaId,
    item_type: 'product',
    product_id: dados.productId,
    name: produto.name,
    quantity: quantidade,
    unit_price: preco,
    total_price: total,
    staff_id: acesso.staff.staffId,
    commission_percent: percentual,
    commission_value: (total * percentual) / 100,
  });

  if (error) return { ok: false, error: error.message };

  await admin
    .from('products')
    .update({ stock_current: estoque - quantidade })
    .eq('id', dados.productId);

  await recalcularTotal(dados.comandaId);
  revalidatePath('/painel/comandas');
  return { ok: true };
}

export async function removerItem(comandaId: string, itemId: string) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const dono = await minhaComandaAberta(comandaId, acesso.staff);
  if (!dono.ok) return { ok: false, error: dono.error };

  const admin = createAdminClient();

  // O item precisa ser dele E desta comanda
  const { data: item } = await admin
    .from('comanda_items')
    .select('id, item_type, product_id, quantity, subscription_usage_id')
    .eq('id', itemId)
    .eq('comanda_id', comandaId)
    .eq('staff_id', acesso.staff.staffId)
    .maybeSingle();

  if (!item) return { ok: false, error: 'Este item não é seu.' };

  if (item.item_type === 'product' && item.product_id) {
    const { data: produto } = await admin
      .from('products')
      .select('stock_current')
      .eq('id', item.product_id)
      .maybeSingle();

    await admin
      .from('products')
      .update({
        stock_current: Number(produto?.stock_current ?? 0) + Number(item.quantity ?? 0),
      })
      .eq('id', item.product_id);
  }

  if (item.subscription_usage_id) {
    // Uso ja acertado no fechamento do potinho nao se estorna por aqui
    await admin
      .from('subscription_usages')
      .delete()
      .eq('id', item.subscription_usage_id)
      .is('settled_payout_id', null);
  }

  const { error } = await admin.from('comanda_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: error.message };

  await recalcularTotal(comandaId);
  revalidatePath('/painel/comandas');
  return { ok: true };
}

// ------------------------------------------------------------------
// Fechamento
// ------------------------------------------------------------------

export async function fecharMinhaComanda(dados: {
  comandaId: string;
  metodo: string;
  gorjeta?: number;
}) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const dono = await minhaComandaAberta(dados.comandaId, acesso.staff);
  if (!dono.ok) return { ok: false, error: dono.error };

  const admin = createAdminClient();
  const { comanda } = dono;

  const { data: itens } = await admin
    .from('comanda_items')
    .select('id, staff_id, total_price')
    .eq('comanda_id', dados.comandaId);

  if (!itens || itens.length === 0) {
    return { ok: false, error: 'Lance ao menos um item antes de fechar.' };
  }

  // Comanda com item de outro profissional mexe na comissao de terceiro.
  // O barbeiro nao fecha esse caso: quem fecha e a gestao.
  const deOutro = itens.some((i) => i.staff_id && i.staff_id !== acesso.staff.staffId);
  if (deOutro) {
    return {
      ok: false,
      error:
        'Esta comanda tem item de outro profissional. Peça para a gestão fechar, para a comissão sair certa.',
    };
  }

  const { data: taxas } = await admin
    .from('barbershops')
    .select('credit_fee_percent, debit_fee_percent')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const metodo = normalizarMetodo(dados.metodo);
  const subtotal = itens.reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  const conta = calcularFechamento({
    subtotal,
    metodo,
    gorjeta: dados.gorjeta,
    taxaCreditoPercent: Number(taxas?.credit_fee_percent ?? 0),
    taxaDebitoPercent: Number(taxas?.debit_fee_percent ?? 0),
  });

  // Só fecha se ainda estiver aberta: o segundo clique não fecha de novo
  const { data: fechada, error: erroFechar } = await admin
    .from('comandas')
    .update({
      status: 'closed',
      discount_type: 'percentage',
      discount_value: 0,
      subtotal,
      total: conta.total,
      card_fee_total: conta.taxaValor,
      net_total: conta.liquido,
      closed_at: new Date().toISOString(),
      closed_by: acesso.staff.profileId,
    })
    .eq('id', dados.comandaId)
    .eq('staff_id', acesso.staff.staffId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (erroFechar) return { ok: false, error: erroFechar.message };
  if (!fechada) return { ok: false, error: 'Esta comanda já foi fechada.' };

  const { error: erroPagamento } = await admin.from('comanda_payments').insert({
    barbershop_id: BARBERSHOP_ID,
    comanda_id: dados.comandaId,
    method: metodo,
    amount: conta.total,
    installments: 1,
    fee_percent: conta.taxaPercent,
    fee_value: conta.taxaValor,
    net_amount: conta.liquido,
  });

  if (erroPagamento) return { ok: false, error: erroPagamento.message };

  if (comanda.appointment_id) {
    await admin
      .from('appointments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        comanda_id: dados.comandaId,
      })
      .eq('id', comanda.appointment_id)
      .eq('staff_id', acesso.staff.staffId);
  }

  if (comanda.customer_id) {
    const { data: cliente } = await admin
      .from('customers')
      .select('total_appointments, total_spent')
      .eq('id', comanda.customer_id)
      .maybeSingle();

    await Promise.all([
      cliente
        ? admin
            .from('customers')
            .update({
              total_appointments: Number(cliente.total_appointments ?? 0) + 1,
              total_spent: Number(cliente.total_spent ?? 0) + conta.total,
            })
            .eq('id', comanda.customer_id)
        : Promise.resolve(),
      awardPointsForComanda({
        comandaId: dados.comandaId,
        customerId: comanda.customer_id as string,
        amount: conta.total,
      }),
    ]);
  }

  revalidatePath('/painel');
  revalidatePath('/painel/comandas');
  revalidatePath('/painel/agenda');
  return { ok: true, total: conta.total };
}
