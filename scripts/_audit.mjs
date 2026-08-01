import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

// cria um cliente de teste, como qualquer pessoa faria no aplicativo
const email = `auditoria.${Date.now()}@teste.local`;
const senha = 'SenhaDeTeste!2026';
const { data: novo, error: e1 } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { role: 'customer' } });
if (e1) { console.error('nao criei o usuario:', e1.message); process.exit(1); }
console.log('usuario de teste criado:', email);

// loga como ele, igual ao aplicativo faz
const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: senha }),
});
const { access_token: token } = await r.json();
console.log('logou:', !!token, '\n');

console.log('O QUE ESSE CLIENTE CONSEGUE LER DIRETO DO BANCO:');
for (const t of ['customers','comandas','comanda_items','staff','transactions','appointments','subscriptions','allowances','profiles','products','services','barbershops','notifications','commission_payouts']) {
  const resp = await fetch(`${URL}/rest/v1/${t}?select=*&limit=3`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  const corpo = await resp.text();
  let n; try { const d = JSON.parse(corpo); n = Array.isArray(d) ? d.length : corpo.slice(0,60); } catch { n = corpo.slice(0,60); }
  const alerta = (typeof n === 'number' && n > 0) ? '  <<< LE!' : '';
  console.log(`  ${t.padEnd(20)} ${String(n).padStart(3)}${alerta}`);
}

await admin.auth.admin.deleteUser(novo.user.id);
console.log('\nusuario de teste apagado');
