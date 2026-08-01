import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const email = `auditoria.${Date.now()}@teste.local`, senha = 'SenhaDeTeste!2026';
const { data: novo } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { role: 'customer' } });
const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method:'POST', headers:{apikey:ANON,'Content-Type':'application/json'}, body: JSON.stringify({ email, password: senha }) });
const { access_token: token } = await r.json();
const ler = (t, q='') => fetch(`${URL}/rest/v1/${t}?select=*${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).then(x=>x.json());

console.log('ATE ONDE VAI O ESTRAGO (usuario recem-criado, sem nenhum vinculo):\n');
const cli = await ler('customers','&limit=1000');
console.log(`  clientes visiveis: ${cli.length} de 412`);
if (cli[0]) console.log(`  exemplo: ${cli[0].full_name} | ${cli[0].phone} | gastou R$ ${cli[0].total_spent}`);

const com = await ler('comandas','&limit=2000');
const fat = com.reduce((s,c)=>s+Number(c.total||0),0);
console.log(`\n  comandas visiveis: ${com.length} | faturamento exposto: R$ ${fat.toFixed(2)}`);

const st = await ler('staff','&limit=100');
console.log(`\n  equipe visivel: ${st.length}`);
if (st[0]) console.log(`  campos: ${Object.keys(st[0]).join(', ')}`);

// escrita: consegue alterar alguma coisa?
const alvo = cli[0];
if (alvo) {
  const w = await fetch(`${URL}/rest/v1/customers?id=eq.${alvo.id}`, {
    method:'PATCH', headers:{apikey:ANON,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'},
    body: JSON.stringify({ notes: 'TESTE DE ESCRITA' }) });
  const res = await w.text();
  console.log(`\n  consegue ESCREVER em cliente alheio? ${w.status} ${res.slice(0,80)}`);
}

await admin.auth.admin.deleteUser(novo.user.id);
console.log('\nusuario de teste apagado');
