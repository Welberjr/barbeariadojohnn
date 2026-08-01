/**
 * JUNTA FICHAS REPETIDAS DO MESMO CLIENTE
 *
 * A mesma pessoa vira duas fichas por motivo banal: cadastrou com o telefone
 * digitado errado, ou a recepcao nao achou o cadastro e fez outro. O estrago
 * aparece depois: o historico fica partido em dois, os pontos nao somam e a
 * pessoa some das listas de quem gasta mais.
 *
 * Este script traz tudo para uma ficha so e apaga as outras. Nada de historico
 * se perde: comanda, agendamento, assinatura, pontos e aviso mudam de dono, e
 * os totais sao recontados a partir do que sobrou.
 *
 * Uso:
 *   node scripts/unificar-clientes.mjs --conferir <idQueFica> <idQueSai> [...]
 *   node scripts/unificar-clientes.mjs --unificar <idQueFica> <idQueSai> [...]
 *
 * Rode --conferir antes. Ele mostra o que vai acontecer sem tocar em nada.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const argumentos = process.argv.slice(2);
const unificar = argumentos.includes('--unificar');
const ids = argumentos.filter((a) => !a.startsWith('--'));

if (ids.length < 2 || (!unificar && !argumentos.includes('--conferir'))) {
  console.error(
    'uso: node scripts/unificar-clientes.mjs --conferir|--unificar <idQueFica> <idQueSai> [...]'
  );
  process.exit(1);
}

const [idQueFica, ...idsQueSaem] = ids;

/** Tudo que aponta para um cliente. Deixar uma de fora e perder historico. */
const TABELAS_COM_CLIENTE = [
  'comandas',
  'appointments',
  'subscriptions',
  'subscription_usages',
  'subscription_payments',
  'notifications',
  'loyalty_points_events',
  'loyalty_transactions',
  'transactions',
];

/**
 * O login desta ficha e de alguem que trabalha na barbearia?
 *
 * Isso muda tudo. Uma das fichas do Welber estava ligada ao login de gestao
 * dele: apagar aquela conta junto com a ficha teria tirado o acesso dele ao
 * administrativo do sistema, na vespera de entrar no ar. Login de quem trabalha
 * na casa nunca e apagado; ele passa para a ficha que fica.
 */
async function loginDaEquipe(authUserId) {
  if (!authUserId) return null;

  const { data } = await admin
    .from('staff')
    .select('id, display_name, can_manage')
    .eq('profile_id', authUserId)
    .maybeSingle();

  return data ?? null;
}

async function retrato(id) {
  const { data: ficha } = await admin.from('customers').select('*').eq('id', id).maybeSingle();
  if (!ficha) return null;

  const contagens = {};
  for (const tabela of TABELAS_COM_CLIENTE) {
    const { count } = await admin
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id);
    contagens[tabela] = count ?? 0;
  }

  const equipe = await loginDaEquipe(ficha.auth_user_id);

  return { ficha, contagens, equipe };
}

const fica = await retrato(idQueFica);
if (!fica) {
  console.error('não achei a ficha que deve ficar:', idQueFica);
  process.exit(1);
}

console.log('\nFICA:');
console.log(`   ${fica.ficha.full_name} | ${fica.ficha.phone} | ${fica.ficha.email ?? 'sem e-mail'}`);
console.log(
  `   ${fica.ficha.total_appointments} visitas · R$ ${fica.ficha.total_spent} · ${fica.ficha.loyalty_points ?? 0} pontos`
);

const saem = [];
for (const id of idsQueSaem) {
  const r = await retrato(id);
  if (!r) {
    console.error('não achei a ficha:', id);
    process.exit(1);
  }
  saem.push({ id, ...r });

  console.log(`\nSAI (o que ela tem vai para a de cima):`);
  console.log(`   ${r.ficha.full_name} | ${r.ficha.phone} | ${r.ficha.email ?? 'sem e-mail'}`);
  console.log(
    `   ${r.ficha.total_appointments} visitas · R$ ${r.ficha.total_spent} · ${r.ficha.loyalty_points ?? 0} pontos`
  );
  const movendo = Object.entries(r.contagens).filter(([, n]) => n > 0);
  if (movendo.length) {
    console.log('   move: ' + movendo.map(([t, n]) => `${n} ${t}`).join(', '));
  } else {
    console.log('   move: nada, a ficha está vazia');
  }
  if (r.equipe) {
    console.log(
      `   ATENÇÃO: o login desta ficha é de ${r.equipe.display_name}, que trabalha na barbearia` +
        (r.equipe.can_manage ? ' e tem acesso de gestão' : '')
    );
    console.log('   esse login NÃO será apagado: ele passa para a ficha que fica');
  } else if (r.ficha.auth_user_id) {
    console.log('   tem login de cliente, que será apagado junto');
  }
}

if (!unificar) {
  console.log('\n--conferir: nada foi alterado. Rode com --unificar para valer.\n');
  process.exit(0);
}

// ------------------------------------------------------------------
// Mover tudo
// ------------------------------------------------------------------
console.log('\nunificando...\n');

for (const { id, ficha, contagens, equipe } of saem) {
  for (const tabela of TABELAS_COM_CLIENTE) {
    if (!contagens[tabela]) continue;

    const { error } = await admin
      .from(tabela)
      .update({ customer_id: idQueFica })
      .eq('customer_id', id);

    if (error) {
      console.error(`   ERRO movendo ${tabela}: ${error.message}`);
      process.exit(1);
    }
    console.log(`   ${contagens[tabela]} ${tabela} movidos`);
  }

  // Os pontos ficam numa tabela com uma linha por cliente: a linha da ficha que
  // sai nao pode ser movida por cima da que fica, entao e apagada depois de o
  // saldo ser somado no fim.
  await admin.from('loyalty_points').delete().eq('customer_id', id);

  if (equipe && ficha.auth_user_id) {
    // Login de quem trabalha na casa e o acesso dela ao sistema: nunca some.
    // Ele passa a ser o login da ficha que fica, para a pessoa continuar
    // entrando com o mesmo e-mail dos dois lados do balcao.
    const { data: fichaQueFica } = await admin
      .from('customers')
      .select('auth_user_id, email')
      .eq('id', idQueFica)
      .maybeSingle();

    // O login que estava na ficha que fica era so de cliente: esse sim sai
    if (fichaQueFica?.auth_user_id && fichaQueFica.auth_user_id !== ficha.auth_user_id) {
      const eraDaEquipe = await loginDaEquipe(fichaQueFica.auth_user_id);
      if (!eraDaEquipe) {
        await admin.auth.admin.deleteUser(fichaQueFica.auth_user_id).catch(() => {});
        console.log('   login de cliente da ficha que fica apagado');
      }
    }

    // Solta o vinculo antes de mover, porque so uma ficha pode ter cada login
    await admin.from('customers').update({ auth_user_id: null }).eq('id', id);
    await admin
      .from('customers')
      .update({ auth_user_id: ficha.auth_user_id, email: ficha.email })
      .eq('id', idQueFica);

    console.log(`   login de ${equipe.display_name} preservado e movido para a ficha que fica`);
  } else if (ficha.auth_user_id) {
    await admin.auth.admin.deleteUser(ficha.auth_user_id).catch(() => {});
    console.log('   login de cliente apagado');
  }

  const { error: erroApagar } = await admin.from('customers').delete().eq('id', id);
  if (erroApagar) {
    console.error(`   ERRO apagando a ficha: ${erroApagar.message}`);
    process.exit(1);
  }
  console.log(`   ficha "${ficha.full_name}" apagada\n`);
}

// ------------------------------------------------------------------
// Recontar os totais a partir do que sobrou
// ------------------------------------------------------------------
const { data: comandas } = await admin
  .from('comandas')
  .select('total, closed_at')
  .eq('customer_id', idQueFica)
  .eq('status', 'closed');

const visitas = (comandas ?? []).length;
const gasto = (comandas ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0);
const ultima = (comandas ?? [])
  .map((c) => c.closed_at)
  .filter(Boolean)
  .sort()
  .pop();

const { data: eventos } = await admin
  .from('loyalty_points_events')
  .select('points')
  .eq('customer_id', idQueFica);

const pontos = (eventos ?? []).reduce((s, e) => s + Number(e.points ?? 0), 0);

await admin
  .from('customers')
  .update({
    total_appointments: visitas,
    total_spent: gasto,
    last_visit_at: ultima ?? null,
    loyalty_points: pontos,
  })
  .eq('id', idQueFica);

await admin
  .from('loyalty_points')
  .update({ balance: pontos, updated_at: new Date().toISOString() })
  .eq('customer_id', idQueFica);

console.log('TOTAIS RECONTADOS:');
console.log(`   ${visitas} visitas · R$ ${gasto.toFixed(2)} · ${pontos} pontos`);
console.log(`   última visita: ${ultima?.slice(0, 10) ?? 'nenhuma'}\n`);
