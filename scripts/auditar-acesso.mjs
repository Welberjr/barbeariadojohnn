/**
 * O BANCO ESTA FECHADO PARA QUEM VEM DE FORA?
 *
 * Cria um cliente de teste igualzinho a qualquer pessoa que se cadastre no
 * aplicativo, tenta ler o banco por fora da tela com a chave publica do site, e
 * diz o que conseguiu. No fim, apaga o usuario de teste.
 *
 * A chave publica nao e segredo: ela vai no codigo de toda pagina, e qualquer
 * pessoa com o navegador aberto tem acesso a ela. O que precisa proteger os
 * dados e a permissao no banco, e e isso que este teste mede.
 *
 * Uso: node scripts/auditar-acesso.mjs
 *
 * Rode depois de qualquer mexida em permissao, regra de acesso ou tabela nova.
 * Sai com codigo 1 quando encontra vazamento, entao serve em automacao.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_BASE, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Tabelas que ninguem de fora pode ler, e o porque em uma linha. */
const NAO_PODE_VAZAR = {
  customers: 'nome, telefone e quanto cada cliente gastou',
  comandas: 'o faturamento da barbearia',
  comanda_items: 'o que foi vendido em cada atendimento',
  comanda_payments: 'como cada cliente pagou',
  staff: 'a comissao de cada profissional e quem tem gestao',
  transactions: 'todo o movimento de dinheiro',
  appointments: 'a agenda inteira',
  subscriptions: 'quem assina e quanto paga',
  allowances: 'os vales da equipe',
  commission_payouts: 'os pagamentos de comissao',
  notifications: 'os avisos mandados para cada cliente',
  profiles: 'os cadastros de acesso',
  barbershops: 'as taxas de cartao e a configuracao de cada loja da rede',
  loyalty_points: 'o saldo de pontos de cada cliente',
  loyalty_transactions: 'o extrato de pontos de cada cliente',
  push_subscriptions: 'os enderecos de notificacao de cada aparelho',
  whatsapp_messages: 'as conversas de WhatsApp com os clientes',
  whatsapp_sessions: 'as sessoes de atendimento do WhatsApp',
};

const email = `auditoria.${Date.now()}@teste.local`;
const senha = `Auditoria!${Date.now()}`;

const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
  email,
  password: senha,
  email_confirm: true,
  user_metadata: { role: 'customer' },
});

if (erroCriar) {
  console.error('não consegui criar o usuário de teste:', erroCriar.message);
  process.exit(1);
}

const login = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: CHAVE_PUBLICA, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: senha }),
});

const { access_token: token } = await login.json();

console.log('Cliente de teste criado e logado. Tentando ler o banco por fora da tela:\n');

const vazamentos = [];

for (const [tabela, oQueE] of Object.entries(NAO_PODE_VAZAR)) {
  const resposta = await fetch(`${URL_BASE}/rest/v1/${tabela}?select=*&limit=1000`, {
    headers: { apikey: CHAVE_PUBLICA, Authorization: `Bearer ${token}` },
  });

  let quantos = 0;
  try {
    const corpo = await resposta.json();
    quantos = Array.isArray(corpo) ? corpo.length : 0;
  } catch {
    quantos = 0;
  }

  if (quantos > 0) {
    vazamentos.push({ tabela, quantos, oQueE });
    console.log(`  ${tabela.padEnd(20)} ${String(quantos).padStart(5)} linhas   VAZANDO`);
  } else {
    console.log(`  ${tabela.padEnd(20)} ${'-'.padStart(5)}          fechado`);
  }
}

// Escrita e o dano maior: ler expoe, escrever estraga.
const escrita = await fetch(`${URL_BASE}/rest/v1/customers?id=neq.00000000-0000-0000-0000-000000000000`, {
  method: 'PATCH',
  headers: {
    apikey: CHAVE_PUBLICA,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ notes: 'teste de auditoria' }),
});

let alterou = 0;
try {
  const corpo = await escrita.json();
  alterou = Array.isArray(corpo) ? corpo.length : 0;
} catch {
  alterou = 0;
}

console.log(
  `\n  escrever em cliente alheio: ${alterou > 0 ? `CONSEGUIU em ${alterou} linhas` : 'bloqueado'}`
);

// Criar registro tambem e dano: quem insere lixo no cadastro polui relatorio,
// fila e tela. A sonda tenta inserir um cliente fantasma na MESMA tabela do
// PATCH. Fail-closed: so conta como bloqueado quando NENHUMA linha volta.
const { data: lojaExistente } = await admin
  .from('barbershops')
  .select('id')
  .limit(1)
  .maybeSingle();

const insercao = await fetch(`${URL_BASE}/rest/v1/customers`, {
  method: 'POST',
  headers: {
    apikey: CHAVE_PUBLICA,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    barbershop_id: lojaExistente?.id ?? null,
    full_name: 'Cliente fantasma da auditoria',
    active: false,
  }),
});

let inseriu = 0;
let idsInseridos = [];
try {
  const corpo = await insercao.json();
  if (Array.isArray(corpo)) {
    inseriu = corpo.length;
    idsInseridos = corpo.map((l) => l.id).filter(Boolean);
  }
} catch {
  inseriu = 0;
}

// Se a porta estava aberta, o lixo criado pela sonda sai daqui mesmo.
for (const id of idsInseridos) {
  await admin.from('customers').delete().eq('id', id);
}

console.log(
  `  criar cliente fantasma:     ${inseriu > 0 ? `CONSEGUIU criar ${inseriu} linha(s)` : 'bloqueado'}`
);

// Apagar e o pior dos tres: some historico e some dinheiro. A sonda cria uma
// linha sacrificavel com a credencial de servico e tenta apaga-la com a chave
// publica. Fail-closed igual: bloqueado so quando nenhuma linha volta.
const { data: sacrificio } = await admin
  .from('customers')
  .insert({
    barbershop_id: lojaExistente?.id ?? null,
    full_name: 'Cliente sacrificavel da auditoria',
    active: false,
  })
  .select('id')
  .maybeSingle();

let apagou = 0;
if (sacrificio?.id) {
  const remocao = await fetch(`${URL_BASE}/rest/v1/customers?id=eq.${sacrificio.id}`, {
    method: 'DELETE',
    headers: {
      apikey: CHAVE_PUBLICA,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
  });

  try {
    const corpo = await remocao.json();
    apagou = Array.isArray(corpo) ? corpo.length : 0;
  } catch {
    apagou = 0;
  }

  // A linha sacrificavel sai sempre, tenha a sonda conseguido ou nao.
  await admin.from('customers').delete().eq('id', sacrificio.id);
}

console.log(
  `  apagar cliente alheio:      ${apagou > 0 ? `CONSEGUIU apagar ${apagou} linha(s)` : 'bloqueado'}`
);

await admin.auth.admin.deleteUser(criado.user.id);
console.log('\nUsuário de teste apagado.');

if (vazamentos.length || alterou > 0 || inseriu > 0 || apagou > 0) {
  console.log('\n==================== VAZAMENTO ====================');
  for (const v of vazamentos) {
    console.log(`  ${v.tabela}: ${v.quantos} linhas expostas (${v.oQueE})`);
  }
  if (alterou > 0) console.log(`  escrita liberada em customers: ${alterou} linhas alteradas`);
  if (inseriu > 0) console.log(`  criacao liberada em customers: ${inseriu} linha(s) inserida(s)`);
  if (apagou > 0) console.log(`  remocao liberada em customers: ${apagou} linha(s) apagada(s)`);
  console.log('\n  Rode migrations/fechar-banco-para-fora.sql no SQL Editor.');
  process.exit(1);
}

console.log('\nTudo fechado: quem vem de fora não lê, não altera, não cria nem apaga nada.');
