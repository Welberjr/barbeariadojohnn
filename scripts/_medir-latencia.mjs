/**
 * Mede onde o tempo se gasta em uma acao do sistema.
 * Temporario, para diagnostico de performance.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function cronometrar(nome, fn, repeticoes = 5) {
  const tempos = [];
  for (let i = 0; i < repeticoes; i++) {
    const t0 = performance.now();
    await fn();
    tempos.push(performance.now() - t0);
  }
  tempos.sort((a, b) => a - b);
  const mediana = Math.round(tempos[Math.floor(tempos.length / 2)]);
  console.log(`${nome.padEnd(46)} ${String(mediana).padStart(5)} ms  (min ${Math.round(tempos[0])}, max ${Math.round(tempos[tempos.length - 1])})`);
  return mediana;
}

// Sessao real de usuario, como o servidor recebe
const userClient = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: login } = await userClient.auth.signInWithPassword({
  email: 'teste.barbeiro@barbeariadojohnn.local',
  password: 'TesteBarbeiro2026',
});

if (!login?.session) {
  console.error('nao consegui logar com o usuario de teste');
  process.exit(1);
}

const token = login.session.access_token;
const comToken = createClient(URL, ANON, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});

console.log('\n== O QUE A GUARDA DE ACESSO CUSTA EM CADA ACAO ==');
const tAuth = await cronometrar('auth.getUser (valida o token no servidor)', () => comToken.auth.getUser());
const tStaff = await cronometrar('consulta staff', () =>
  admin.from('staff').select('id, profile_id, display_name, role, active, fired_at, can_manage, permissions, must_change_password, default_commission_percent').eq('profile_id', login.user.id).eq('active', true).is('fired_at', null).maybeSingle()
);
const tProfile = await cronometrar('consulta profiles', () =>
  admin.from('profiles').select('full_name, email').eq('id', login.user.id).maybeSingle()
);
const tJuntas = await cronometrar('staff + profiles em paralelo', async () => {
  await Promise.all([
    admin.from('staff').select('id, can_manage, permissions').eq('profile_id', login.user.id).maybeSingle(),
    admin.from('profiles').select('full_name, email').eq('id', login.user.id).maybeSingle(),
  ]);
});
const tJoin = await cronometrar('staff com profiles em UMA consulta', () =>
  admin.from('staff').select('id, can_manage, permissions, profiles:profiles!staff_profile_id_fkey(full_name, email)').eq('profile_id', login.user.id).maybeSingle()
);

console.log('\n== O QUE A ACAO EM SI CUSTA ==');
const { data: appt } = await admin.from('appointments').select('id, status').eq('staff_id', 'f63c2439-5a79-4a31-bc7e-0cc4a296210b').limit(1).maybeSingle();
if (appt) {
  await cronometrar('UPDATE de status do agendamento', () =>
    admin.from('appointments').update({ status: appt.status }).eq('id', appt.id)
  );
}

console.log('\n== RESUMO ==');
console.log(`guarda hoje (auth + staff + profiles em paralelo): ~${tAuth + tJuntas} ms`);
console.log(`guarda com uma consulta so:                        ~${tAuth + tJoin} ms`);
console.log(`economia por acao:                                 ~${tJuntas - tJoin} ms`);
console.log(`(consultas isoladas: staff ${tStaff} ms, profiles ${tProfile} ms)`);

process.exit(0);
