/**
 * MIGRACAO DO ECOBARBER PARA O NOSSO SISTEMA
 *
 * Le o arquivo exportado do sistema antigo e traz tudo: barbearia, equipe,
 * clientes, servicos, produtos, agenda, comandas, assinaturas e financeiro.
 *
 * Como usar:
 *   node scripts/migrar-ecobarber.mjs <arquivo.json> --limpar
 *   node scripts/migrar-ecobarber.mjs <arquivo.json> --importar
 *   node scripts/migrar-ecobarber.mjs <arquivo.json> --atualizar
 *   node scripts/migrar-ecobarber.mjs <arquivo.json> --conferir
 *
 * O --atualizar e para o dia a dia ate a virada: o Johnn continua atendendo no
 * sistema antigo, voce exporta de novo e roda, e entra so o que e novo. Pode
 * rodar quantas vezes quiser, que nao duplica nada.
 *
 * Faz backup antes de limpar. Nada roda por acidente: cada fase e explicita.
 *
 * DECISOES DE MAPEAMENTO (pensadas com o Welber em 31/07/2026):
 *
 *  - Os 108 servicos do sistema antigo sao 27 servicos repetidos, um por
 *    barbeiro. Aqui viram 27 servicos da barbearia, e a ligacao com o
 *    profissional acontece no item da comanda, como no nosso modelo.
 *
 *  - Cada comanda deles tem um atendimento e um servico. O item da nossa
 *    comanda nasce desse atendimento, com a comissao REAL que o sistema
 *    antigo registrou na transacao, e nao recalculada por percentual de hoje.
 *
 *  - Receita de atendimento entra como comanda, nao como lancamento avulso.
 *    Se entrasse nos dois lugares, o faturamento apareceria em dobro.
 *    Lancamento avulso e so o que nao tem atendimento: despesa, venda de
 *    produto sem comanda, gorjeta.
 *
 *  - Os identificadores originais sao preservados, entao da para conferir
 *    qualquer registro contra o sistema antigo depois.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BARBEARIA = '11111111-1111-1111-1111-111111111111';
const arquivo = process.argv[2];
const fase = process.argv.find((a) => a.startsWith('--'))?.replace('--', '');

if (!arquivo || !fase) {
  console.error('uso: node scripts/migrar-ecobarber.mjs <arquivo.json> --limpar|--importar|--conferir');
  process.exit(1);
}

const eco = JSON.parse(readFileSync(arquivo, 'utf8'));
const log = (...a) => console.log(...a);

// ------------------------------------------------------------------
// Apoio
// ------------------------------------------------------------------

const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Data + hora do sistema antigo viram um instante no fuso da barbearia. */
function instante(data, hora) {
  if (!data) return null;
  const h = (hora ?? '00:00:00').slice(0, 8);
  return `${data}T${h}-03:00`;
}

const STATUS_ATENDIMENTO = {
  concluido: 'completed',
  cancelado: 'cancelled',
  agendado: 'scheduled',
  confirmado: 'confirmed',
  em_andamento: 'in_progress',
};

const STATUS_ASSINATURA = {
  ativa: 'active',
  atrasada: 'past_due',
  cancelada: 'cancelled',
};

const FORMA_PAGAMENTO = {
  pix: 'pix',
  dinheiro: 'cash',
  cartao_debito: 'debit',
  cartao_credito: 'credit',
};

/** Insere em blocos: mil linhas de uma vez estoura o limite da API. */
/**
 * Quando ligado, so entra no banco o que ainda nao esta la.
 *
 * E o que faz a atualizacao do dia a dia ser possivel: o Johnn continua
 * atendendo no sistema antigo enquanto a virada nao acontece, e a gente traz o
 * que mudou sem duplicar o que ja veio. O reconhecimento e pelo identificador
 * original do sistema antigo, que a importacao preserva desde o comeco.
 */
let SOMENTE_NOVOS = false;

/** Ids que ja existem na tabela, para nao inserir duas vezes o mesmo registro. */
async function idsExistentes(tabela) {
  const existentes = new Set();
  for (let de = 0; ; de += 1000) {
    const { data } = await admin.from(tabela).select('id').range(de, de + 999);
    for (const linha of data ?? []) existentes.add(linha.id);
    if (!data || data.length < 1000) break;
  }
  return existentes;
}

async function inserir(tabela, linhas, tamanho = 500) {
  if (!linhas.length) return { ok: 0, pulados: 0, erro: null };

  let pulados = 0;
  let paraInserir = linhas;

  if (SOMENTE_NOVOS && linhas[0]?.id) {
    const jaTem = await idsExistentes(tabela);
    paraInserir = linhas.filter((l) => !jaTem.has(l.id));
    pulados = linhas.length - paraInserir.length;
  }

  let ok = 0;
  for (let i = 0; i < paraInserir.length; i += tamanho) {
    const bloco = paraInserir.slice(i, i + tamanho);
    const { error } = await admin.from(tabela).insert(bloco);
    if (error) {
      console.error(`  ERRO em ${tabela} (bloco ${i}):`, error.message);
      return { ok, pulados, erro: error.message };
    }
    ok += bloco.length;
  }
  return { ok, pulados, erro: null };
}

// ------------------------------------------------------------------
// FASE 1: LIMPAR
// ------------------------------------------------------------------

async function limpar() {
  log('LIMPANDO os dados de demonstracao\n');

  // Ordem importa: filho antes do pai
  const ordem = [
    'subscription_payout_items',
    'subscription_payouts',
    'subscription_payments',
    'subscription_usages',
    'subscriptions',
    'subscription_plan_services',
    'subscription_plans',
    'loyalty_points_events',
    'loyalty_transactions',
    'loyalty_points',
    'comanda_payments',
    'comanda_items',
    'comandas',
    'appointment_services',
    'appointments',
    'allowances',
    'commission_payouts',
    'transactions',
    'bills',
    'notifications',
    'days_off',
    'goals',
    'staff_access_log',
    'products',
    'services',
    'customers',
  ];

  for (const tabela of ordem) {
    const { error, count } = await admin
      .from(tabela)
      .delete({ count: 'exact' })
      .not('id', 'is', null);
    log(`  ${String(count ?? 0).padStart(5)}  ${tabela}${error ? '  ERRO: ' + error.message : ''}`);
  }

  // Equipe: apaga o staff de demonstracao, preservando quem tem gestao
  const { data: gestores } = await admin
    .from('staff')
    .select('id, profile_id, display_name')
    .eq('can_manage', true);

  const idsGestores = (gestores ?? []).map((g) => g.id);
  const { count: staffApagado } = await admin
    .from('staff')
    .delete({ count: 'exact' })
    .not('id', 'in', `(${idsGestores.join(',')})`);

  log(`  ${String(staffApagado ?? 0).padStart(5)}  staff (mantidos ${idsGestores.length} com acesso de gestao)`);
  log('\nlimpeza concluida');
}

// ------------------------------------------------------------------
// FASE 2: IMPORTAR
// ------------------------------------------------------------------

async function importar() {
  log('IMPORTANDO os dados reais\n');

  const b = eco.barbearias[0];

  // ---- Barbearia: configuracao ----
  const diasFechados = b.dias_semana_fechados ?? [];
  await admin
    .from('barbershops')
    .update({
      name: b.nome,
      address_street: b.endereco,
      debit_fee_percent: num(b.taxa_debito),
      credit_fee_percent: num(b.taxa_credito),
    })
    .eq('id', BARBEARIA);
  log(`  barbearia: ${b.nome} | taxas ${b.taxa_debito}% debito e ${b.taxa_credito}% credito`);

  // ---- Equipe ----
  const mapaStaff = new Map(); // id antigo -> staff_id novo
  let equipe = 0;

  for (const p of eco.profiles) {
    const email = (p.email ?? '').trim().toLowerCase();
    if (!email) continue;

    // Reaproveita o login se ja existir, senao cria
    const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 });
    let user = lista?.users?.find((u) => u.email === email);

    if (!user) {
      const { data: novo } = await admin.auth.admin.createUser({
        email,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: p.nome_completo },
      });
      user = novo?.user;
    }
    if (!user) continue;

    await admin.from('profiles').upsert({
      id: user.id,
      full_name: p.nome_completo,
      email,
      phone: p.telefone ?? null,
    });

    const { data: staffExistente } = await admin
      .from('staff')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();

    const dados = {
      barbershop_id: BARBEARIA,
      profile_id: user.id,
      display_name: p.nome_completo.split(' ')[0],
      role: p.is_admin ? 'owner' : 'barber',
      default_commission_percent: num(p.comissao_default_servico),
      active: p.is_active !== false,
      fired_at: p.is_active === false ? new Date().toISOString() : null,
      can_manage: p.is_admin === true,
      permissions: p.is_admin
        ? {}
        : { financeiro: true, vales_ver: true, vales_pedir: true },
    };

    let staffId;
    if (staffExistente) {
      await admin.from('staff').update(dados).eq('id', staffExistente.id);
      staffId = staffExistente.id;
    } else {
      const { data: criado } = await admin.from('staff').insert(dados).select('id').single();
      staffId = criado?.id;
    }

    if (staffId) {
      mapaStaff.set(p.id, staffId);
      equipe++;
    }
  }
  log(`  equipe: ${equipe} profissionais`);

  // ---- Clientes ----
  const clientes = eco.clientes.map((c) => ({
    id: c.id,
    barbershop_id: BARBEARIA,
    full_name: (c.nome ?? 'Cliente').trim(),
    phone: c.telefone ?? null,
    email: c.email ?? null,
    active: true,
    created_at: c.created_at,
  }));
  const rc = await inserir('customers', clientes);
  log(`  clientes: ${rc.ok}`);

  // ---- Servicos: 108 copias viram 27 ----
  const porChave = new Map();
  const mapaServico = new Map(); // id antigo -> id novo

  for (const s of eco.servicos) {
    const chave = `${s.nome.trim().toLowerCase()}|${num(s.preco)}`;
    if (!porChave.has(chave)) {
      porChave.set(chave, {
        id: s.id, // o primeiro vira o oficial
        barbershop_id: BARBEARIA,
        name: s.nome.trim(),
        base_price: num(s.preco),
        base_duration_minutes: num(s.duracao) || 30,
        active: s.ativo !== false,
        show_on_public_menu: true,
        created_at: s.created_at,
      });
    }
    mapaServico.set(s.id, porChave.get(chave).id);
  }
  const rs = await inserir('services', [...porChave.values()]);
  log(`  servicos: ${rs.ok} (de ${eco.servicos.length} registros repetidos por barbeiro)`);

  // ---- Produtos ----
  const produtos = (eco.produtos ?? []).map((p) => ({
    id: p.id,
    barbershop_id: BARBEARIA,
    name: p.nome,
    brand: p.marca || null,
    description: p.descricao || null,
    sale_price: num(p.preco),
    cost_price: num(p.custo),
    stock_current: num(p.estoque),
    stock_minimum: num(p.estoque_minimo),
    default_commission_percent: 10,
    is_sellable: true,
    active: p.ativo !== false,
    created_at: p.created_at,
  }));
  const rp = await inserir('products', produtos);
  log(`  produtos: ${rp.ok}`);

  // ---- Planos de assinatura ----
  const planos = (eco.planos_assinatura ?? []).map((p) => ({
    id: p.id,
    barbershop_id: BARBEARIA,
    name: p.nome,
    price: num(p.valor_mensal),
    period: 'monthly',
    included_uses: num(p.frequencia_mensal) || 4,
    barber_share_percent: num(p.comissao_percentual_assinatura),
    allowed_days: [1, 2, 3, 4, 5, 6],
    accumulate_unused: false,
    show_on_public_menu: true,
    active: p.ativo !== false,
    leftover_destination: 'barbearia',
    created_at: p.created_at,
  }));
  const rpl = await inserir('subscription_plans', planos);
  log(`  planos de assinatura: ${rpl.ok}`);

  // ---- Assinaturas ----
  const hoje = new Date();
  const assinaturas = (eco.assinaturas_cliente ?? [])
    .filter((a) => a.cliente_id && a.plano_id)
    .map((a) => {
      const plano = eco.planos_assinatura.find((p) => p.id === a.plano_id);
      const inicio = a.data_inicio ? new Date(a.data_inicio + 'T12:00:00') : new Date(a.created_at);
      const dia = num(a.dia_vencimento) || inicio.getDate();

      // Ciclo corrente ancorado no dia de vencimento
      let fim = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
      if (fim < hoje) fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
      const comeco = new Date(fim);
      comeco.setMonth(comeco.getMonth() - 1);

      return {
        id: a.id,
        barbershop_id: BARBEARIA,
        customer_id: a.cliente_id,
        plan_id: a.plano_id,
        status: STATUS_ASSINATURA[a.status] ?? 'cancelled',
        started_at: inicio.toISOString(),
        current_period_start: comeco.toISOString(),
        current_period_end: fim.toISOString(),
        next_billing_at: fim.toISOString(),
        current_price: num(plano?.valor_mensal),
        cancelled_at: a.status === 'cancelada' ? a.updated_at : null,
        notes: a.observacoes ?? null,
        created_at: a.created_at,
      };
    });
  const ra = await inserir('subscriptions', assinaturas);
  log(`  assinaturas: ${ra.ok} (${assinaturas.filter((x) => x.status === 'active').length} ativas)`);

  // ---- Agenda ----
  const atendimentosValidos = eco.atendimentos.filter(
    (a) => a.cliente_id && mapaStaff.has(a.user_id)
  );

  const agendamentos = [];
  const servicosDoAgendamento = [];

  // O servico do agendamento nasce com identificador proprio e nao se reconhece
  // sozinho. Quem responde por ele e o agendamento: agendamento que ja esta no
  // banco ja trouxe o servico dele junto. Sem esta trava, uma atualizacao punha
  // o mesmo servico de novo em cada um dos 1.619 atendimentos.
  const agendamentosJaImportados = SOMENTE_NOVOS
    ? await idsExistentes('appointments')
    : new Set();

  for (const a of atendimentosValidos) {
    if (agendamentosJaImportados.has(a.id)) continue;

    const inicio = instante(a.data_atendimento, a.hora_inicio);
    const fim = instante(a.data_atendimento, a.hora_fim) ?? inicio;
    if (!inicio) continue;

    const status = STATUS_ATENDIMENTO[a.status] ?? 'scheduled';

    agendamentos.push({
      id: a.id,
      barbershop_id: BARBEARIA,
      customer_id: a.cliente_id,
      staff_id: mapaStaff.get(a.user_id),
      start_at: inicio,
      end_at: fim,
      status,
      notes: a.observacoes ?? null,
      source: a.origem === 'bot' ? 'whatsapp' : 'manual',
      completed_at: status === 'completed' ? inicio : null,
      cancelled_at: status === 'cancelled' ? a.updated_at : null,
      created_at: a.created_at,
    });

    const servicoNovo = mapaServico.get(a.servico_id);
    if (servicoNovo) {
      servicosDoAgendamento.push({
        barbershop_id: BARBEARIA,
        appointment_id: a.id,
        service_id: servicoNovo,
        price: num(a.valor),
        duration_minutes: 30,
        commission_percent: 0,
      });
    }
  }

  const rag = await inserir('appointments', agendamentos, 300);
  log(`  agendamentos: ${rag.ok}`);
  const rags = await inserir('appointment_services', servicosDoAgendamento, 300);
  log(`  servicos dos agendamentos: ${rags.ok}`);

  await importarMovimento(mapaStaff, mapaServico, assinaturas.map((a) => a.id));
  log('\nimportacao concluida');
}

/**
 * Movimento: comandas, itens, pagamentos, usos de assinatura e lancamentos.
 * Recebe os mapas quando vem da importacao completa e os reconstroi a partir
 * do banco quando roda sozinha.
 */
async function importarMovimento(mapaStaffEntrada, mapaServicoEntrada, idsAssinaturasEntrada, incluirLancamentos = true) {
  let mapaStaff = mapaStaffEntrada;
  let mapaServico = mapaServicoEntrada;
  let idsAssinaturasArr = idsAssinaturasEntrada;

  if (!mapaStaff) {
    // Refaz o vinculo pelo e-mail, que e o que os dois sistemas tem em comum
    mapaStaff = new Map();
    const { data: staffs } = await admin
      .from('staff')
      .select('id, profile:profiles!staff_profile_id_fkey ( email )');

    for (const p of eco.profiles) {
      const email = (p.email ?? '').trim().toLowerCase();
      const achado = (staffs ?? []).find((s) => s.profile?.email === email);
      if (achado) mapaStaff.set(p.id, achado.id);
    }

    mapaServico = new Map();
    const { data: servicos } = await admin.from('services').select('id, name, base_price');
    for (const s of eco.servicos) {
      const igual = (servicos ?? []).find(
        (n) => n.name === s.nome.trim() && Number(n.base_price) === num(s.preco)
      );
      if (igual) mapaServico.set(s.id, igual.id);
    }

    const { data: assinaturas } = await admin.from('subscriptions').select('id');
    idsAssinaturasArr = (assinaturas ?? []).map((a) => a.id);

    log(`  vinculos: ${mapaStaff.size} profissionais, ${mapaServico.size} servicos`);
  }

  // ---- Comandas, itens e pagamentos ----
  // A comissao real vem da transacao do atendimento, nao de percentual atual
  const comissaoPorAtendimento = new Map();
  for (const t of eco.transacoes) {
    if (t.atendimento_id && t.comissao_valor) {
      comissaoPorAtendimento.set(t.atendimento_id, {
        valor: num(t.comissao_valor),
        percentual: num(t.comissao_percentual),
      });
    }
  }

  const atendimentoPorId = new Map(eco.atendimentos.map((a) => [a.id, a]));
  const mapaStaffMov = mapaStaff;
  const mapaServicoMov = mapaServico;
  const idsAgendamentosImportados = new Set(
    (await admin.from('appointments').select('id')).data?.map((a) => a.id) ?? []
  );

  const comandas = [];
  const itens = [];
  const pagamentos = [];
  const usosAssinatura = [];

  // Os itens e os pagamentos nascem com identificador proprio, entao nao dao
  // para reconhecer sozinhos. Quem responde por eles e a comanda: comanda que ja
  // esta no banco ja trouxe os itens dela junto, e e pulada inteira.
  const comandasJaImportadas = SOMENTE_NOVOS
    ? await idsExistentes('comandas')
    : new Set();

  for (const c of eco.comandas) {
    if (comandasJaImportadas.has(c.id)) continue;

    const at = atendimentoPorId.get(c.atendimento_id);
    const staffId = mapaStaff.get(c.profissional_id) ?? (at ? mapaStaff.get(at.user_id) : null);
    if (!staffId || !c.cliente_id) continue;

    const fechada = c.fechada_em ?? c.created_at;
    const total = num(c.total_final);
    const taxa = num(c.taxa_cartao_valor);

    comandas.push({
      id: c.id,
      barbershop_id: BARBEARIA,
      customer_id: c.cliente_id,
      staff_id: staffId,
      appointment_id: idsAgendamentosImportados.has(c.atendimento_id) ? c.atendimento_id : null,
      status: 'closed',
      subtotal: num(c.subtotal),
      // O sistema antigo grava "percentual" em portugues; o nosso enum e em
      // ingles. Só uma comanda em 1.239 tem desconto, mas passar direto
      // derrubava a importacao inteira.
      discount_type: c.desconto_tipo === 'valor' ? 'fixed' : 'percentage',
      discount_value: num(c.desconto_percentual),
      total,
      card_fee_total: taxa,
      net_total: num(c.valor_liquido) || total - taxa,
      notes: c.observacoes ?? null,
      opened_at: c.created_at,
      closed_at: fechada,
      created_at: c.created_at,
    });

    // Item: o servico do atendimento, com a comissao real do sistema antigo
    if (at) {
      const servicoNovo = mapaServico.get(at.servico_id);
      const servicoAntigo = eco.servicos.find((s) => s.id === at.servico_id);
      const comissao = comissaoPorAtendimento.get(at.id);
      const cobertoPorAssinatura = at.tipo_atendimento === 'assinatura';

      itens.push({
        id: randomUUID(),
        barbershop_id: BARBEARIA,
        comanda_id: c.id,
        item_type: 'service',
        service_id: servicoNovo ?? null,
        name: (servicoAntigo?.nome ?? 'Serviço') + (cobertoPorAssinatura ? ' (Assinatura)' : ''),
        quantity: 1,
        unit_price: num(c.subtotal),
        total_price: num(c.subtotal),
        staff_id: staffId,
        commission_percent: comissao?.percentual ?? 0,
        commission_value: comissao?.valor ?? 0,
        created_at: c.created_at,
      });

      if (cobertoPorAssinatura && at.assinatura_id) {
        usosAssinatura.push({
          barbershop_id: BARBEARIA,
          subscription_id: at.assinatura_id,
          staff_id: staffId,
          service_id: servicoNovo ?? null,
          comanda_id: c.id,
          value_saved: num(at.valor),
          used_at: fechada,
          period_start: fechada,
          period_end: fechada,
        });
      }
    }

    // Pagamentos: uma linha por forma usada, o que cobre a comanda mista
    const formas = [
      ['pix', num(c.pagamento_pix)],
      ['cash', num(c.pagamento_dinheiro)],
      ['debit', num(c.pagamento_debito)],
      ['credit', num(c.pagamento_credito)],
    ].filter(([, v]) => v > 0);

    const usadas = formas.length
      ? formas
      : [[FORMA_PAGAMENTO[c.forma_pagamento] ?? 'cash', total]];

    for (const [metodo, valor] of usadas) {
      const proporcao = total > 0 ? valor / total : 1;
      pagamentos.push({
        barbershop_id: BARBEARIA,
        comanda_id: c.id,
        method: metodo,
        amount: valor,
        installments: 1,
        fee_percent: num(c.taxa_cartao_percentual),
        fee_value: Math.round(taxa * proporcao * 100) / 100,
        net_amount: Math.round((valor - taxa * proporcao) * 100) / 100,
        created_at: fechada,
      });
    }
  }

  const rcom = await inserir('comandas', comandas, 300);
  log(`  comandas: ${rcom.ok}`);
  const rit = await inserir('comanda_items', itens, 300);
  log(`  itens de comanda: ${rit.ok}`);
  const rpg = await inserir('comanda_payments', pagamentos, 300);
  log(`  pagamentos: ${rpg.ok}`);

  // Usos de assinatura: so das assinaturas que existem
  const idsAssinaturas = new Set(idsAssinaturasArr ?? []);
  const usosValidos = usosAssinatura.filter((u) => idsAssinaturas.has(u.subscription_id));
  const rus = await inserir('subscription_usages', usosValidos, 300);
  log(`  usos de assinatura: ${rus.ok}`);

  // ---- Financeiro avulso ----
  // Receita de atendimento ja esta na comanda. Aqui entra so o resto.
  const idsComandas = new Set(comandas.map((c) => c.id));
  const lancamentos = [];

  for (const t of eco.transacoes) {
    const temComanda = t.atendimento_id && eco.comandas.some((c) => c.atendimento_id === t.atendimento_id);
    if (temComanda) continue; // seria faturamento em dobro

    const ehDespesa = t.tipo === 'despesa';
    const ehProduto = /produto/i.test(t.categoria ?? '');

    lancamentos.push({
      // O identificador do sistema antigo vira o nosso. Sem isto, rodar a
      // importacao duas vezes lancava o mesmo dinheiro de novo: foi assim que o
      // financeiro apareceu com 1002 lancamentos onde deviam existir 501.
      id: t.id,
      barbershop_id: BARBEARIA,
      type: ehDespesa ? 'expense' : ehProduto ? 'product' : 'other',
      amount: Math.abs(num(t.valor)),
      description: t.descricao ?? t.categoria ?? 'Lançamento',
      category: t.categoria ?? 'Outros',
      staff_id: mapaStaff.get(t.user_id) ?? null,
      customer_id: t.cliente_id ?? null,
      occurred_at: instante(t.data_transacao, '12:00:00'),
      created_at: t.created_at,
    });
  }
  if (incluirLancamentos) {
    // Os lancamentos que ja estao no banco entraram antes de o script guardar o
    // identificador de origem, entao eles tem id sorteado pelo banco e o filtro
    // por id nao os reconheceria: rodar a atualizacao lancaria o mesmo dinheiro
    // outra vez. Aqui a comparacao e pelo conteudo, que e o que de fato diz se
    // aquele lancamento ja existe.
    let novos = lancamentos;
    if (SOMENTE_NOVOS) {
      const assinatura = (t) =>
        [t.type, Number(t.amount).toFixed(2), (t.description ?? '').trim(), String(t.occurred_at).slice(0, 10)].join('|');

      const jaExistem = new Set();
      for (let de = 0; ; de += 1000) {
        const { data } = await admin
          .from('transactions')
          .select('type, amount, description, occurred_at')
          .range(de, de + 999);
        for (const t of data ?? []) jaExistem.add(assinatura(t));
        if (!data || data.length < 1000) break;
      }

      novos = lancamentos.filter((t) => !jaExistem.has(assinatura(t)));
      log(`  lancamentos ja existentes, pulados: ${lancamentos.length - novos.length}`);
    }

    const rtx = await inserir('transactions', novos, 300);
    log(`  lancamentos avulsos: ${rtx.ok} (receita de atendimento fica na comanda)`);
  } else {
    log('  lancamentos avulsos: pulados nesta fase');
  }

  // ---- Estatisticas do cliente ----
  const porCliente = new Map();
  for (const c of comandas) {
    const atual = porCliente.get(c.customer_id) ?? { visitas: 0, gasto: 0, ultima: null };
    atual.visitas += 1;
    atual.gasto += c.total;
    if (!atual.ultima || c.closed_at > atual.ultima) atual.ultima = c.closed_at;
    porCliente.set(c.customer_id, atual);
  }

  let atualizados = 0;
  for (const [id, v] of porCliente) {
    await admin
      .from('customers')
      .update({
        total_appointments: v.visitas,
        total_spent: Math.round(v.gasto * 100) / 100,
        last_visit_at: v.ultima,
      })
      .eq('id', id);
    atualizados++;
  }
  log(`  estatisticas atualizadas em ${atualizados} clientes`);

  log('\nimportacao concluida');
}

// ------------------------------------------------------------------
// FASE 3: CONFERIR
// ------------------------------------------------------------------

async function conferir() {
  log('CONFERINDO contra o sistema antigo\n');

  const conta = async (tabela, filtro) => {
    let q = admin.from(tabela).select('id', { count: 'exact', head: true });
    if (filtro) q = filtro(q);
    const { count } = await q;
    return count ?? 0;
  };

  const linhas = [
    ['clientes', eco.clientes.length, await conta('customers')],
    ['servicos (unicos)', new Set(eco.servicos.map((s) => `${s.nome.trim().toLowerCase()}|${num(s.preco)}`)).size, await conta('services')],
    ['produtos', (eco.produtos ?? []).length, await conta('products')],
    ['planos', (eco.planos_assinatura ?? []).length, await conta('subscription_plans')],
    ['assinaturas', (eco.assinaturas_cliente ?? []).length, await conta('subscriptions')],
    ['comandas', eco.comandas.length, await conta('comandas')],
  ];

  log('  o que                    antigo    novo');
  for (const [nome, antes, agora] of linhas) {
    const sinal = antes === agora ? 'ok' : `diferenca de ${Math.abs(antes - agora)}`;
    log(`  ${nome.padEnd(22)} ${String(antes).padStart(6)}  ${String(agora).padStart(6)}   ${sinal}`);
  }

  // Faturamento por mes, que e o numero que o Johnn conhece de cor
  const antigoPorMes = {};
  for (const c of eco.comandas) {
    const mes = (c.fechada_em ?? c.created_at ?? '').slice(0, 7);
    if (mes) antigoPorMes[mes] = (antigoPorMes[mes] ?? 0) + num(c.total_final);
  }

  // Pagina de mil em mil: a consulta simples devolve no maximo 1000 linhas,
  // e com 1.239 comandas a conferencia acusava diferenca que nao existia.
  const nossas = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await admin
      .from('comandas')
      .select('total, closed_at')
      .eq('status', 'closed')
      .range(de, de + 999);
    nossas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const novoPorMes = {};
  for (const c of nossas) {
    const mes = (c.closed_at ?? '').slice(0, 7);
    if (mes) novoPorMes[mes] = (novoPorMes[mes] ?? 0) + num(c.total);
  }

  log('\n  faturamento por mes');
  for (const mes of Object.keys(antigoPorMes).sort()) {
    const a = antigoPorMes[mes];
    const n = novoPorMes[mes] ?? 0;
    const dif = Math.abs(a - n);
    log(
      `  ${mes}  antigo R$ ${a.toFixed(2).padStart(10)}   novo R$ ${n.toFixed(2).padStart(10)}   ${dif < 0.5 ? 'ok' : 'DIFERENCA de R$ ' + dif.toFixed(2)}`
    );
  }
}

// ------------------------------------------------------------------

/**
 * Refaz so o movimento (comanda, item, pagamento e uso de assinatura).
 * Existe para o caso de a importacao passar do cadastro e parar no meio:
 * rodar tudo de novo duplicaria cliente e servico.
 */
async function refazerMovimento() {
  log('REFAZENDO o movimento (comandas, itens, pagamentos e usos)\n');

  for (const tabela of ['comanda_payments', 'comanda_items', 'subscription_usages', 'comandas']) {
    const { count } = await admin.from(tabela).delete({ count: 'exact' }).not('id', 'is', null);
    log(`  limpou ${count ?? 0} de ${tabela}`);
  }

  log('');
  await importarMovimento();
}

/**
 * Traz so o que mudou no sistema antigo desde a ultima vez.
 *
 * Roda a mesma importacao de sempre, com a trava de "so o que ainda nao existe"
 * ligada. E a mesma lógica, e nao uma segunda versao dela: codigo de importacao
 * duplicado envelhece torto, e a hora de descobrir e sempre a pior.
 */
async function atualizar() {
  SOMENTE_NOVOS = true;

  log('ATUALIZANDO com o que mudou no sistema antigo\n');
  log('Nada do que ja esta aqui e tocado: so entra registro novo.\n');

  const antes = await contagens();
  await importar();
  const depois = await contagens();

  log('\nO QUE ENTROU AGORA');
  for (const [tabela, quantidade] of Object.entries(depois)) {
    const diferenca = quantidade - (antes[tabela] ?? 0);
    if (diferenca > 0) log(`  +${String(diferenca).padStart(5)}  ${tabela}`);
  }
  log('\nConfira com --conferir antes de considerar fechado.');
}

/** Fotografia do tamanho de cada tabela, para dizer o que a atualizacao trouxe. */
async function contagens() {
  const tabelas = [
    'customers',
    'services',
    'products',
    'appointments',
    'comandas',
    'comanda_items',
    'comanda_payments',
    'transactions',
    'subscriptions',
    'subscription_usages',
  ];

  const resultado = {};
  for (const tabela of tabelas) {
    const { count } = await admin.from(tabela).select('id', { count: 'exact', head: true });
    resultado[tabela] = count ?? 0;
  }
  return resultado;
}

if (fase === 'limpar') await limpar();
else if (fase === 'importar') await importar();
else if (fase === 'atualizar') await atualizar();
else if (fase === 'movimento') await refazerMovimento();
else if (fase === 'conferir') await conferir();
else console.error('fase desconhecida');

process.exit(0);
