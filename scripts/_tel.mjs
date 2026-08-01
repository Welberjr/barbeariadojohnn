import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('customers').select('full_name, phone').not('phone','is',null).limit(2000);

const formatos = {};
for (const c of data) {
  const d = c.phone.replace(/\D/g,'');
  const semDdi = d.replace(/^55/,'');
  const chave = `${d.startsWith('55') ? 'com 55' : 'sem 55'} + ${semDdi.length} digitos`;
  formatos[chave] = (formatos[chave] ?? 0) + 1;
}
console.log('COMO OS TELEFONES ESTAO GRAVADOS:');
for (const [k,v] of Object.entries(formatos).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(26)} ${v}`);

// celular antigo = 10 digitos comecando com 6..9 no 3o digito
const antigos = data.filter(c => { const s = c.phone.replace(/\D/g,'').replace(/^55/,''); return s.length === 10 && /^[1-9]{2}[6-9]/.test(s); });
console.log(`\ncelulares SEM o nono digito: ${antigos.length}`);
for (const c of antigos.slice(0,6)) console.log(`   ${c.full_name} | ${c.phone}`);

const { data: alef } = await db.from('customers').select('full_name, phone, total_appointments, loyalty_points').ilike('full_name','%alef%').limit(3);
console.log('\nprocurando o Alef:', alef.map(a=>`${a.full_name} | ${a.phone} | ${a.total_appointments} visitas`).join(' / ') || 'nao achei');
