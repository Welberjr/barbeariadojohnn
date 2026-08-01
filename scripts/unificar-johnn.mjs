/**
 * Junta os dois cadastros do Johnn num login so.
 *
 * O Johnn entrou no sistema por dois caminhos. Pelo EcoBarber veio o barbeiro
 * "Johnn Alvez" (barberjohnn404@gmail.com), com os 708 atendimentos e as 501
 * comandas do historico. Do dia em que montamos o sistema veio o dono
 * "Jonathan William" (jonathanjones.508@gmail.com), sem atendimento nenhum,
 * que e o login que ele de fato usa.
 *
 * Duas colunas na agenda para a mesma pessoa, e duas senhas para decorar.
 *
 * O que este script faz: o cadastro do barbeiro (o que tem o trabalho) passa a
 * responder pelo login do dono e ganha o acesso de gestao. O cadastro de dono,
 * que nao tem nada pendurado, sai. A ficha de cliente dele aponta para o mesmo
 * login. No fim, um e-mail so abre as tres portas: agenda, gestao e conta de
 * cliente.
 *
 * Nada de historico e apagado: nenhum atendimento, comanda ou comissao muda de
 * dono, porque o cadastro que fica e justamente o que ja era dono deles.
 *
 * Rodar com: node scripts/unificar-johnn.mjs
 * Para so conferir, sem gravar: node scripts/unificar-johnn.mjs --simular
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const SIMULAR = process.argv.includes('--simular');

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const EMAIL_QUE_SAI = 'barberjohnn404@gmail.com';
const EMAIL_QUE_FICA = 'jonathanjones.508@gmail.com';

function passo(texto) {
  console.log(`\n${SIMULAR ? '[simulacao] ' : ''}${texto}`);
}

// ------------------------------------------------------------------
// 1. Achar as duas pontas
// ------------------------------------------------------------------
const { data: perfis } = await s
  .from('profiles')
  .select('id, email, full_name, phone')
  .in('email', [EMAIL_QUE_SAI, EMAIL_QUE_FICA]);

const perfilQueSai = (perfis ?? []).find((p) => p.email === EMAIL_QUE_SAI);
const perfilQueFica = (perfis ?? []).find((p) => p.email === EMAIL_QUE_FICA);

if (!perfilQueSai || !perfilQueFica) {
  console.log('Nao achei os dois perfis. Talvez a juncao ja tenha sido feita.');
  process.exit(1);
}

const { data: cadastros } = await s
  .from('staff')
  .select('id, display_name, role, can_manage, permissions, atende_clientes, profile_id, active')
  .in('profile_id', [perfilQueSai.id, perfilQueFica.id]);

const barbeiro = (cadastros ?? []).find((c) => c.profile_id === perfilQueSai.id);
const dono = (cadastros ?? []).find((c) => c.profile_id === perfilQueFica.id);

if (!barbeiro || !dono) {
  console.log('Nao achei os dois cadastros de equipe. Nada foi alterado.');
  process.exit(1);
}

console.log(`Cadastro que fica : ${barbeiro.display_name} (${barbeiro.id})`);
console.log(`Cadastro que sai  : ${dono.display_name} (${dono.id})`);

// ------------------------------------------------------------------
// 2. Trava de seguranca: o cadastro que sai nao pode ter trabalho
// ------------------------------------------------------------------
for (const tabela of ['appointments', 'comandas', 'comanda_items', 'staff_payouts']) {
  const { count } = await s
    .from(tabela)
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', dono.id);
  if ((count ?? 0) > 0) {
    console.log(`\nPAREI: o cadastro que sairia tem ${count} linha(s) em ${tabela}.`);
    console.log('Apagar ele levaria historico junto. Nada foi alterado.');
    process.exit(1);
  }
}
console.log('Confirmado: o cadastro que sai nao tem atendimento, comanda nem acerto.');

// ------------------------------------------------------------------
// 3. O cadastro do barbeiro assume o login e o acesso de gestao
// ------------------------------------------------------------------
passo(
  `"${barbeiro.display_name}" passa a entrar por ${EMAIL_QUE_FICA}, como dono, com acesso de gestao e continuando na agenda.`
);

if (!SIMULAR) {
  // Um cadastro de equipe nao existe sem login (profile_id e obrigatorio), e
  // dois cadastros nao dividem o mesmo login. Entao o cadastro de dono sai
  // primeiro, e so depois o do barbeiro assume o lugar dele.
  //
  // Se o segundo passo falhar, o cadastro de dono volta exatamente como
  // estava: ninguem pode terminar esta troca sem acesso a gestao.
  const { data: copiaDoDono } = await s
    .from('staff')
    .select('*')
    .eq('id', dono.id)
    .maybeSingle();

  const { error: erroApagar } = await s.from('staff').delete().eq('id', dono.id);
  if (erroApagar) {
    console.log('erro ao remover o cadastro de dono:', erroApagar.message);
    process.exit(1);
  }

  const { error: erroAssumir } = await s
    .from('staff')
    .update({
      profile_id: perfilQueFica.id,
      role: dono.role,
      can_manage: dono.can_manage,
      permissions: dono.permissions,
      atende_clientes: true,
    })
    .eq('id', barbeiro.id);

  if (erroAssumir) {
    console.log('erro ao passar o login para o cadastro do barbeiro:', erroAssumir.message);
    if (copiaDoDono) {
      const { error: erroVoltar } = await s.from('staff').insert(copiaDoDono);
      console.log(
        erroVoltar
          ? `ATENCAO: nao consegui devolver o cadastro de dono. Restaure pelo backup. ${erroVoltar.message}`
          : 'Cadastro de dono devolvido como estava. Nada mudou.'
      );
    }
    process.exit(1);
  }
}

// ------------------------------------------------------------------
// 4. A ficha de cliente dele aponta para o mesmo login
// ------------------------------------------------------------------
// A ficha de cliente dele tem um login proprio, criado pelo script que abriu
// conta para os 408 clientes da barbearia. Aquele e-mail e so um apelido do
// telefone; quem ja tem e-mail de verdade nao precisa de um segundo.
const telefone = (perfilQueFica.phone ?? perfilQueSai.phone ?? '').replace(/\D/g, '');
const finalDoTelefone = telefone.slice(-8);

let ficha = null;
if (finalDoTelefone.length === 8) {
  const { data: candidatas } = await s
    .from('customers')
    .select('id, full_name, phone, email, auth_user_id')
    .ilike('phone', `%${finalDoTelefone}`);
  // Uma so: mais de uma seria chute, e chute aqui liga a conta de uma pessoa
  // na ficha de outra.
  if ((candidatas ?? []).length === 1) ficha = candidatas[0];
  else if ((candidatas ?? []).length > 1) {
    console.log(
      `\nAviso: ${candidatas.length} fichas com esse telefone. Nao mexi em nenhuma, para nao chutar.`
    );
  }
}

const loginsParaApagar = [perfilQueSai.id];

if (ficha) {
  passo(
    `A ficha de cliente "${ficha.full_name}" passa a abrir por ${EMAIL_QUE_FICA}, no lugar de ${ficha.email ?? 'nenhum e-mail'}.`
  );
  if (ficha.auth_user_id && ficha.auth_user_id !== perfilQueFica.id) {
    loginsParaApagar.push(ficha.auth_user_id);
  }
  if (!SIMULAR) {
    // O e-mail da ficha precisa ser o mesmo do login: e por ele que a entrada
    // por telefone descobre com qual conta autenticar.
    const { error } = await s
      .from('customers')
      .update({ auth_user_id: perfilQueFica.id, email: EMAIL_QUE_FICA })
      .eq('id', ficha.id);
    if (error) console.log('aviso: nao consegui ligar a ficha:', error.message);
  }
} else {
  console.log('\nNao achei ficha de cliente com o telefone dele.');
}

// ------------------------------------------------------------------
// 5. O login que sobrou nao serve mais para nada
// ------------------------------------------------------------------
for (const loginId of loginsParaApagar) {
  const { data: auth } = await s.auth.admin.getUserById(loginId);
  const email = auth?.user?.email ?? loginId;

  // Ultima conferencia antes de apagar: ninguem pode estar pendurado nele.
  const { count: aindaNaEquipe } = await s
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', loginId);
  const { count: aindaCliente } = await s
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('auth_user_id', loginId);

  if ((aindaNaEquipe ?? 0) > 0 || (aindaCliente ?? 0) > 0) {
    console.log(`\nNao apaguei ${email}: ainda tem cadastro ligado nele.`);
    continue;
  }

  passo(`O login ${email} deixa de existir.`);
  if (!SIMULAR) {
    const { error } = await s.auth.admin.deleteUser(loginId);
    if (error) {
      console.log('aviso: nao consegui apagar:', error.message);
      console.log('Ele ja nao da acesso a nada, mas convem apagar pelo painel do Supabase.');
    }
  }
}

// ------------------------------------------------------------------
// 6. Como ficou
// ------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
const { data: equipe } = await s
  .from('staff')
  .select('display_name, role, active, atende_clientes, can_manage, profile_id')
  .order('display_name');

for (const p of equipe ?? []) {
  const { data: perfil } = p.profile_id
    ? await s.from('profiles').select('email').eq('id', p.profile_id).maybeSingle()
    : { data: null };
  console.log(
    p.display_name.padEnd(12),
    p.role.padEnd(8),
    p.active ? 'ativo  ' : 'inativo',
    p.atende_clientes === false ? 'fora da agenda' : 'na agenda     ',
    p.can_manage ? 'gestao' : '      ',
    perfil?.email ?? 'sem login'
  );
}
