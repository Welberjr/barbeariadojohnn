import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const LOJA='11111111-1111-1111-1111-111111111111';
const EMAIL='teste-portas@barbeariadojohnn.invalido', SENHA='teste-portas-2026', MARCA='TESTE-PORTAS-APAGAR';
async function apagar(){
  const {data:l}=await s.auth.admin.listUsers({perPage:1000});
  const u=l.users.find(x=>x.email===EMAIL);
  if(u){
    await s.from('push_subscriptions').delete().eq('user_id',u.id);
    const {data:f}=await s.from('customers').select('id').eq('auth_user_id',u.id);
    for(const x of f??[]){await s.from('appointments').delete().eq('customer_id',x.id);await s.from('notifications').delete().eq('customer_id',x.id);}
    await s.from('customers').delete().eq('auth_user_id',u.id);
    await s.from('staff').delete().eq('profile_id',u.id);
    await s.from('profiles').delete().eq('id',u.id);
    await s.auth.admin.deleteUser(u.id);
  }
  await s.from('customers').delete().eq('full_name',MARCA);
  console.log('apagado');
}
if(process.argv[2]==='apagar'){await apagar();process.exit(0);}
await apagar();
const {data:c,error}=await s.auth.admin.createUser({email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{full_name:'Teste Portas'}});
if(error){console.log(error.message);process.exit(1);}
const uid=c.user.id;
await s.from('profiles').upsert({id:uid,full_name:'Teste Portas',email:EMAIL});
await s.from('staff').insert({barbershop_id:LOJA,profile_id:uid,display_name:MARCA,role:'owner',active:true,can_manage:true,atende_clientes:true,default_commission_percent:0,permissions:{}});
await s.from('customers').insert({barbershop_id:LOJA,auth_user_id:uid,full_name:MARCA,phone:'5561000000001',active:true});
console.log('criado');
