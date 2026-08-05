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
import { lojaAtual } from '@/lib/loja';
import { getActiveSubscription, isDayAllowed, formatAllowedDays } from '@/lib/subscriptions';
import { creditosDoCliente } from '@/lib/creditos-db';
import {
  quantoOCreditoCobre,
  saldoDisponivel,
  comoGastar,
} from '@/lib/credito-cliente';
import {
  calcularFechamento,
  normalizarMetodo,
  JANELA_CORRECAO_MINUTOS,
  type MetodoPagamento,
} from '@/lib/painel/comanda-calculo';
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

  // O cliente vem da tela, então precisa ser conferido: tem que ser desta
  // barbearia e estar ativo. Sem isso, um id qualquer viraria comanda.
  const { data: cliente } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('barbershop_id', (await lojaAtual()))
    .eq('active', true)
    .maybeSingle();

  if (!cliente) return { ok: false, error: 'Cliente não encontrado.' };

  // Evita o mesmo barbeiro abrir duas contas para o mesmo cliente.
  // Dois profissionais diferentes podem ter comanda aberta para o mesmo
  // cliente, que é o caso real de corte com um e barba com outro.
  const { data: jaAberta } = await admin
    .from('comandas')
    .select('id')
    .eq('barbershop_id', (await lojaAtual()))
    .eq('customer_id', customerId)
    .eq('staff_id', acesso.staff.staffId)
    .eq('status', 'open')
    .maybeSingle();

  if (jaAberta) return { ok: true, comandaId: jaAberta.id as string };

  const { data: criada, error } = await admin
    .from('comandas')
    .insert({
      barbershop_id: (await lojaAtual()),
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

  // Escopo e situação conferidos: serviço inativo ou de fora não entra em
  // comanda só porque alguém conhece o identificador dele.
  const { data: servico } = await admin
    .from('services')
    .select('name, base_price')
    .eq('id', dados.serviceId)
    .eq('barbershop_id', (await lojaAtual()))
    .eq('active', true)
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
        barbershop_id: (await lojaAtual()),
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
      p_barbershop_id: (await lojaAtual()),
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
    barbershop_id: (await lojaAtual()),
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
    .eq('barbershop_id', (await lojaAtual()))
    .eq('active', true)
    .maybeSingle();

  if (!produto) return { ok: false, error: 'Produto não encontrado.' };

  // A baixa acontece antes do item e dentro de um UPDATE condicional: dois
  // lancamentos ao mesmo tempo nao vendem a mesma ultima unidade.
  const { error: erroEstoque } = await admin.rpc('painel_baixar_estoque', {
    p_product_id: dados.productId,
    p_barbershop_id: (await lojaAtual()),
    p_quantidade: quantidade,
  });

  if (erroEstoque) {
    const estoque = Number(produto.stock_current ?? 0);
    return {
      ok: false,
      error: estoque > 0 ? `Só restam ${estoque} no estoque.` : 'Produto sem estoque.',
    };
  }

  const preco = Number(produto.sale_price ?? 0);
  const total = preco * quantidade;
  const percentual = Number(produto.default_commission_percent ?? 0);

  const { error } = await admin.from('comanda_items').insert({
    barbershop_id: (await lojaAtual()),
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

  if (error) {
    // Item nao entrou: devolve o que foi baixado, senao some do estoque
    await admin.rpc('painel_baixar_estoque', {
      p_product_id: dados.productId,
      p_barbershop_id: (await lojaAtual()),
      p_quantidade: -quantidade,
    });
    return { ok: false, error: error.message };
  }

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
  /** Como o cliente paga o que o crédito não cobre (produto e gorjeta) */
  metodoDoResto?: string;
}) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const dono = await minhaComandaAberta(dados.comandaId, acesso.staff);
  if (!dono.ok) return { ok: false, error: dono.error };

  const admin = createAdminClient();
  const { comanda } = dono;

  const { data: itens } = await admin
    .from('comanda_items')
    .select('id, staff_id, total_price, item_type')
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
    .eq('id', (await lojaAtual()))
    .maybeSingle();

  const metodo = normalizarMetodo(dados.metodo);
  const subtotal = itens.reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  // Crédito da casa: paga serviço, não paga produto nem gorjeta. O plano de
  // quais créditos usar sai daqui e vai inteiro para a transação de
  // fechamento, para não existir baixa de saldo sem comanda fechada.
  let planoDeCredito: Array<{ credit_id: string; amount: number }> = [];
  let creditoUsado = 0;
  let metodoDoResto: MetodoPagamento | null = null;

  if (metodo === 'store_credit') {
    if (!comanda.customer_id) {
      return { ok: false, error: 'Comanda sem cliente não pode ser paga com crédito.' };
    }

    const valorServicos = itens
      .filter((i) => i.item_type === 'service')
      .reduce((s, i) => s + Number(i.total_price ?? 0), 0);

    if (valorServicos <= 0) {
      return {
        ok: false,
        error: 'O crédito paga só serviço. Esta comanda não tem serviço nenhum.',
      };
    }

    const creditos = await creditosDoCliente(comanda.customer_id as string);
    creditoUsado = quantoOCreditoCobre({
      valorServicos,
      subtotal,
      desconto: 0,
      saldo: saldoDisponivel(creditos),
    });

    if (creditoUsado <= 0) {
      return { ok: false, error: 'Este cliente não tem crédito disponível para usar hoje.' };
    }

    planoDeCredito = comoGastar(creditos, creditoUsado).map((p) => ({
      credit_id: p.creditoId,
      amount: p.valor,
    }));

    const totalComGorjeta = subtotal + Math.max(0, Number(dados.gorjeta) || 0);
    if (totalComGorjeta - creditoUsado > 0.009) {
      // Sem escolha explícita não dá para adivinhar: normalizarMetodo cairia em
      // dinheiro e o caixa registraria uma entrada que ninguém conferiu.
      if (!dados.metodoDoResto || dados.metodoDoResto === 'store_credit') {
        return {
          ok: false,
          error: `O crédito cobre R$ ${creditoUsado.toFixed(2).replace('.', ',')}. Escolha como o cliente paga o restante.`,
        };
      }
      metodoDoResto = normalizarMetodo(dados.metodoDoResto);
    }
  }

  // A taxa de cartão incide sobre o que passa na maquininha
  const conta = calcularFechamento({
    subtotal,
    metodo: metodoDoResto ?? metodo,
    gorjeta: dados.gorjeta,
    taxaCreditoPercent: Number(taxas?.credit_fee_percent ?? 0),
    taxaDebitoPercent: Number(taxas?.debit_fee_percent ?? 0),
    baseDaTaxa: creditoUsado > 0 ? subtotal + Math.max(0, Number(dados.gorjeta) || 0) - creditoUsado : undefined,
  });

  // Fechar comanda, gravar pagamento, concluir o atendimento e somar os
  // totais do cliente acontecem juntos, numa transação só. Antes disso era
  // uma chamada atrás da outra: falha no meio deixava comanda fechada sem
  // pagamento, que é o pior estado possível para o caixa.
  const { data: customerId, error: erroFechar } = await admin.rpc(
    'painel_fechar_comanda',
    {
      p_comanda_id: dados.comandaId,
      p_staff_id: acesso.staff.staffId,
      p_closed_by: acesso.staff.profileId,
      p_metodo: metodo,
      p_subtotal: subtotal,
      p_total: conta.total,
      p_taxa_percent: conta.taxaPercent,
      p_taxa_valor: conta.taxaValor,
      p_liquido: conta.liquido,
      // Os dois parametros do credito so vao quando ha credito envolvido.
      // Mandar sempre faria todo fechamento do painel depender da versao nova
      // da funcao no banco: enquanto o SQL nao rodasse, nenhum barbeiro
      // conseguiria fechar comanda nenhuma. Assim, sem o SQL, so o pagamento
      // com credito falha, e com mensagem.
      ...(creditoUsado > 0
        ? { p_creditos: planoDeCredito, p_metodo_resto: metodoDoResto }
        : {}),
    }
  );

  if (erroFechar) {
    const msg = erroFechar.message ?? '';
    if (/JA_FECHADA/.test(msg)) return { ok: false, error: 'Esta comanda já foi fechada.' };
    if (/NAO_E_SUA/.test(msg)) return { ok: false, error: 'Esta comanda não é sua.' };
    if (/CREDITO_MAIOR_QUE_TOTAL|FALTA_METODO_DO_RESTO/.test(msg)) {
      return { ok: false, error: 'Confira o pagamento com crédito e tente de novo.' };
    }
    // Banco ainda sem a versao nova da funcao: o resto do painel continua
    // funcionando, so o pagamento com credito precisa esperar o SQL.
    if (/Could not find the function|schema cache/i.test(msg)) {
      return {
        ok: false,
        error: 'Pagamento com crédito ainda não está liberado aqui. Feche pela gestão.',
      };
    }
    return { ok: false, error: msg || 'Não foi possível fechar a comanda.' };
  }

  // Pontos de fidelidade ficam fora da transação de propósito: a conta já
  // está fechada e correta, e uma falha aqui não pode desfazer o caixa.
  if (customerId) {
    await awardPointsForComanda({
      comandaId: dados.comandaId,
      customerId: customerId as string,
      amount: conta.total,
    });
  }

  revalidatePath('/painel');
  revalidatePath('/painel/comandas');
  revalidatePath('/painel/agenda');
  return { ok: true, total: conta.total };
}

// ------------------------------------------------------------------
// Cancelamento de comanda aberta
// ------------------------------------------------------------------

/**
 * Cancela uma comanda que ainda esta aberta.
 *
 * Caso real do dia a dia: o cliente sentou, a comanda foi aberta e ele
 * precisou ir embora. Sem isto o barbeiro fica com uma comanda aberta pendurada
 * ou e obrigado a lancar e cobrar alguma coisa que nao aconteceu, que e pior.
 *
 * Comanda aberta ainda nao virou dinheiro: nao ha pagamento, nao ha comissao
 * fechada, nao ha ponto de fidelidade. Cancelar aqui nao mexe no caixa. O que
 * existe de efeito e o estoque dos produtos ja lancados e o uso de assinatura
 * ja debitado, e os dois sao devolvidos.
 *
 * Nada e apagado: a comanda fica gravada como cancelada, com o motivo e a hora,
 * para a gestao enxergar depois quem abre e desiste demais.
 */
export async function cancelarMinhaComanda(comandaId: string, motivo: string) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const dono = await minhaComandaAberta(comandaId, acesso.staff);
  if (!dono.ok) return { ok: false, error: dono.error };

  const admin = createAdminClient();

  const { data: itens } = await admin
    .from('comanda_items')
    .select('id, item_type, product_id, quantity, staff_id, subscription_usage_id')
    .eq('comanda_id', comandaId);

  // Item de outro profissional nao se apaga por aqui, do mesmo jeito que a
  // comanda com item de terceiro nao fecha por aqui.
  const deOutro = (itens ?? []).some(
    (i) => i.staff_id && i.staff_id !== acesso.staff.staffId
  );
  if (deOutro) {
    return {
      ok: false,
      error:
        'Esta comanda tem item de outro profissional. Peça para a gestão cancelar.',
    };
  }

  for (const item of itens ?? []) {
    // Produto volta para a prateleira
    if (item.item_type === 'product' && item.product_id) {
      await admin.rpc('painel_baixar_estoque', {
        p_product_id: item.product_id,
        p_barbershop_id: (await lojaAtual()),
        p_quantidade: -Number(item.quantity ?? 0),
      });
    }

    // Uso de assinatura volta para o saldo do cliente
    if (item.subscription_usage_id) {
      await admin
        .from('subscription_usages')
        .delete()
        .eq('id', item.subscription_usage_id)
        .is('settled_payout_id', null);
    }
  }

  if ((itens ?? []).length > 0) {
    await admin.from('comanda_items').delete().eq('comanda_id', comandaId);
  }

  // O status so muda se a comanda ainda estiver aberta. Dois cliques em rede
  // ruim, ou fechar numa aba e cancelar na outra, param aqui.
  const { data: cancelada, error } = await admin
    .from('comandas')
    .update({
      status: 'cancelled',
      subtotal: 0,
      total: 0,
      net_total: 0,
      reversed_at: new Date().toISOString(),
      reversed_by: acesso.staff.profileId,
      reversal_reason: motivo.trim() || 'Cancelada pelo profissional',
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId)
    .eq('staff_id', acesso.staff.staffId)
    .eq('status', 'open')
    .select('id, appointment_id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!cancelada) {
    return { ok: false, error: 'Esta comanda mudou enquanto você olhava.' };
  }

  // O atendimento volta a ficar sem comanda, para o barbeiro poder abrir outra
  // se o cliente voltar mais tarde.
  if (cancelada.appointment_id) {
    await admin
      .from('appointments')
      .update({ comanda_id: null })
      .eq('id', cancelada.appointment_id)
      .eq('staff_id', acesso.staff.staffId);
  }

  revalidatePath('/painel');
  revalidatePath('/painel/comandas');
  revalidatePath('/painel/agenda');
  return { ok: true };
}

// ------------------------------------------------------------------
// Correcao da propria comanda
// ------------------------------------------------------------------

/**
 * Reabre a comanda para correcao, dentro da janela.
 *
 * Errar no fechamento acontece: cliente pagou de outro jeito, faltou um
 * produto, lancou no cliente errado. Dentro de uma hora o proprio barbeiro
 * resolve. Depois disso, so a gestao, por estorno, para nao existir movimento
 * mudando de valor no dia seguinte sem ninguem saber.
 */
export async function reabrirMinhaComanda(comandaId: string) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const admin = createAdminClient();

  const { error } = await admin.rpc('reabrir_comanda', {
    p_comanda_id: comandaId,
    p_staff_id: acesso.staff.staffId,
    p_ator: acesso.staff.profileId,
    p_janela_minutos: JANELA_CORRECAO_MINUTOS,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/FORA_DA_JANELA/.test(msg)) {
      return {
        ok: false,
        error:
          'Passou de 1 hora desde o fechamento. Peça para a gestão estornar esta comanda.',
      };
    }
    if (/NAO_E_SUA/.test(msg)) return { ok: false, error: 'Esta comanda não é sua.' };
    if (/NAO_ESTA_FECHADA/.test(msg)) {
      return { ok: false, error: 'Esta comanda não está fechada.' };
    }
    if (/NAO_ENCONTRADA/.test(msg)) return { ok: false, error: 'Comanda não encontrada.' };
    return { ok: false, error: msg || 'Não foi possível reabrir a comanda.' };
  }

  revalidatePath('/painel');
  revalidatePath('/painel/comandas');
  revalidatePath(`/painel/comandas/${comandaId}`);
  return { ok: true };
}
