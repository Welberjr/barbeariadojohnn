/**
 * Prepara dois profissionais de teste para conferir o painel do barbeiro.
 *
 * Cria (ou reaproveita) dois logins com permissoes diferentes, para dar para
 * abrir os dois lado a lado e ver na pratica que um nao enxerga o outro:
 *
 *   teste.barbeiro@barbeariadojohnn.local   senha: TesteBarbeiro2026
 *     financeiro, vales, pedir vale, operar agenda, comanda e clientes
 *
 *   teste.novato@barbeariadojohnn.local     senha: TesteNovato2026
 *     nada alem da agenda em leitura
 *
 * Uso: node scripts/preparar-teste-painel.mjs
 * Para remover depois: node scripts/preparar-teste-painel.mjs --remover
 *
 * Roda apenas contra o banco configurado no .env.local.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const remover = process.argv.includes('--remover');

const PERFIS = [
  {
    email: 'teste.barbeiro@barbeariadojohnn.local',
    senha: 'TesteBarbeiro2026',
    nome: 'Teste Barbeiro Completo',
    apelido: 'Teste Completo',
    permissions: {
      financeiro: true,
      vales_ver: true,
      vales_pedir: true,
      agenda_operar: true,
      comanda: true,
      clientes: true,
    },
  },
  {
    email: 'teste.novato@barbeariadojohnn.local',
    senha: 'TesteNovato2026',
    nome: 'Teste Barbeiro Novato',
    apelido: 'Teste Novato',
    permissions: {},
  },
];

async function acharUsuario(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  return data?.users?.find((u) => u.email === email) ?? null;
}

for (const perfil of PERFIS) {
  const existente = await acharUsuario(perfil.email);

  if (remover) {
    if (existente) {
      await admin.from('staff').delete().eq('profile_id', existente.id);
      await admin.from('profiles').delete().eq('id', existente.id);
      await admin.auth.admin.deleteUser(existente.id);
      console.log(`removido: ${perfil.email}`);
    }
    continue;
  }

  let userId = existente?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: perfil.email,
      password: perfil.senha,
      email_confirm: true,
      user_metadata: { full_name: perfil.nome },
    });
    if (error) {
      console.error(`falhou ao criar ${perfil.email}:`, error.message);
      continue;
    }
    userId = data.user.id;
  } else {
    await admin.auth.admin.updateUserById(userId, { password: perfil.senha });
  }

  await admin
    .from('profiles')
    .upsert({ id: userId, full_name: perfil.nome, email: perfil.email });

  const { data: staffExistente } = await admin
    .from('staff')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();

  const dados = {
    barbershop_id: BARBERSHOP_ID,
    profile_id: userId,
    display_name: perfil.apelido,
    role: 'barber',
    default_commission_percent: 40,
    active: true,
    fired_at: null,
    can_manage: false,
    permissions: perfil.permissions,
    must_change_password: false,
  };

  if (staffExistente) {
    await admin.from('staff').update(dados).eq('id', staffExistente.id);
  } else {
    await admin.from('staff').insert(dados);
  }

  console.log(`pronto: ${perfil.email}  senha: ${perfil.senha}`);
}

console.log(remover ? 'limpeza concluida' : 'profissionais de teste prontos');
