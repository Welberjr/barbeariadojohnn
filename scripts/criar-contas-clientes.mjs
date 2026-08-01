/**
 * CRIA A CONTA DE ACESSO DE TODOS OS CLIENTES
 *
 * A barbearia tem centenas de clientes com historico, pontos e assinatura, e
 * nenhum deles tinha login. Em vez de esperar cada um se cadastrar, a conta ja
 * nasce pronta: o Johnn passa o telefone e a senha, o cliente entra e troca a
 * senha na primeira vez.
 *
 * Login e o telefone. Como o Supabase so entende e-mail, cada conta recebe um
 * e-mail interno derivado do telefone; quem tem e-mail de verdade no cadastro
 * mantem o dele. O cliente nunca ve isso: ele digita o telefone e pronto.
 *
 * A senha entregue e igual para todos, e por isso a conta fica marcada para
 * trocar no primeiro acesso. Enquanto nao trocar, ela e de quem souber o
 * telefone: e a troca que faz a conta virar do cliente.
 *
 * Uso:
 *   node scripts/criar-contas-clientes.mjs --conferir   (nao muda nada)
 *   node scripts/criar-contas-clientes.mjs --criar
 *   node scripts/criar-contas-clientes.mjs --criar --senha 123456
 *
 * Pode rodar de novo quando entrarem clientes novos: quem ja tem conta e pulado.
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

const BARBEARIA = '11111111-1111-1111-1111-111111111111';
const DOMINIO_INTERNO = 'cliente.barbeariadojohnn.app';

const argumentos = process.argv.slice(2);
const criar = argumentos.includes('--criar');
const senhaPadrao = argumentos.includes('--senha')
  ? argumentos[argumentos.indexOf('--senha') + 1]
  : '123456';

if (!criar && !argumentos.includes('--conferir')) {
  console.error('uso: node scripts/criar-contas-clientes.mjs --conferir | --criar [--senha 123456]');
  process.exit(1);
}

/** Mesma regra do sistema: sem codigo do pais e com o nono digito. */
function normalizarTelefone(valor) {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  if (d.length === 10 && /^[1-9]{2}[6-9]/.test(d)) return `${d.slice(0, 2)}9${d.slice(2)}`;
  return d;
}

// ------------------------------------------------------------------
// 1. Quem entra e quem fica de fora
// ------------------------------------------------------------------
const clientes = [];
for (let de = 0; ; de += 1000) {
  const { data } = await admin
    .from('customers')
    .select('id, full_name, phone, email, auth_user_id, active')
    .eq('barbershop_id', BARBEARIA)
    .eq('active', true)
    .order('full_name')
    .range(de, de + 999);

  clientes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const jaTemConta = [];
const semTelefoneUtil = [];
const porTelefone = new Map();

for (const c of clientes) {
  if (c.auth_user_id) {
    jaTemConta.push(c);
    continue;
  }

  const tel = normalizarTelefone(c.phone);
  if (!tel) {
    semTelefoneUtil.push(c);
    continue;
  }

  porTelefone.set(tel, [...(porTelefone.get(tel) ?? []), c]);
}

const repetidos = [...porTelefone.entries()].filter(([, lista]) => lista.length > 1);
const prontos = [...porTelefone.entries()]
  .filter(([, lista]) => lista.length === 1)
  .map(([tel, lista]) => ({ tel, cliente: lista[0] }));

console.log('\nCLIENTES ATIVOS:', clientes.length);
console.log('  já têm conta:            ', jaTemConta.length);
console.log('  vão receber conta agora: ', prontos.length);
console.log('  telefone que não entendo:', semTelefoneUtil.length);
console.log('  telefone repetido:       ', repetidos.reduce((s, [, l]) => s + l.length, 0));

if (semTelefoneUtil.length) {
  console.log('\nSEM TELEFONE UTILIZÁVEL (ficam de fora, cadastre à mão se precisar):');
  for (const c of semTelefoneUtil) console.log(`   ${c.full_name} | "${c.phone ?? ''}"`);
}

if (repetidos.length) {
  console.log('\nTELEFONE REPETIDO (ficam de fora: o sistema não escolhe por você):');
  for (const [tel, lista] of repetidos) {
    console.log(`   ${tel}: ${lista.map((c) => c.full_name).join('  /  ')}`);
  }
  console.log('   Junte as fichas duplicadas ou corrija o telefone, e rode de novo.');
}

if (!criar) {
  console.log('\n--conferir: nada foi criado. Rode com --criar para valer.\n');
  process.exit(0);
}

// ------------------------------------------------------------------
// 2. Criar as contas
// ------------------------------------------------------------------
console.log(`\ncriando ${prontos.length} contas com a senha "${senhaPadrao}"...\n`);

let criadas = 0;
let falhas = 0;

for (const { tel, cliente } of prontos) {
  // E-mail de verdade quando existe; senao um interno, derivado do telefone.
  // O cliente entra pelo telefone de qualquer jeito: isto e so o que o Supabase
  // exige para identificar a conta.
  const email = cliente.email?.includes('@')
    ? cliente.email.trim().toLowerCase()
    : `${tel}@${DOMINIO_INTERNO}`;

  const { data: conta, error } = await admin.auth.admin.createUser({
    email,
    password: senhaPadrao,
    email_confirm: true,
    user_metadata: {
      role: 'customer',
      full_name: cliente.full_name,
      // Enquanto for a senha que a barbearia entregou, o painel cobra a troca
      must_change_password: true,
    },
  });

  if (error || !conta?.user) {
    falhas++;
    console.log(`   FALHOU  ${cliente.full_name} (${email}): ${error?.message ?? 'sem conta'}`);
    continue;
  }

  const { error: erroLigar } = await admin
    .from('customers')
    .update({ auth_user_id: conta.user.id, email })
    .eq('id', cliente.id)
    .is('auth_user_id', null);

  if (erroLigar) {
    // Conta sem ficha nao abre nada: desfaz para nao deixar login orfao
    await admin.auth.admin.deleteUser(conta.user.id);
    falhas++;
    console.log(`   FALHOU  ${cliente.full_name}: ${erroLigar.message}`);
    continue;
  }

  criadas++;
  if (criadas % 50 === 0) console.log(`   ${criadas} contas...`);
}

console.log(`\ncriadas: ${criadas} | falhas: ${falhas}`);
console.log(`\nO que o Johnn passa para cada cliente:`);
console.log(`   endereço: ${env.NEXT_PUBLIC_APP_URL ?? 'https://barbearia-do-johnn.vercel.app'}/cliente/login`);
console.log(`   login: o telefone dele`);
console.log(`   senha: ${senhaPadrao} (o sistema pede para trocar na primeira entrada)\n`);
