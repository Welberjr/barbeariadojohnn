/**
 * Backup completo do banco para arquivos JSON.
 *
 * Roda antes de qualquer limpeza ou migracao. Guarda uma pasta com a data e
 * hora, uma tabela por arquivo, para dar para voltar atras se algo sair
 * errado no meio do caminho.
 *
 * Uso: node scripts/backup-banco.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Tudo o que guarda dado de operacao. A ordem nao importa no backup.
const TABELAS = [
  'barbershops',
  'profiles',
  'staff',
  'customers',
  'services',
  'products',
  'product_categories',
  'appointments',
  'appointment_services',
  'comandas',
  'comanda_items',
  'comanda_payments',
  'transactions',
  'bills',
  'bill_categories',
  'allowances',
  'commission_payouts',
  'subscription_plans',
  'subscription_plan_services',
  'subscriptions',
  'subscription_usages',
  'subscription_payments',
  'subscription_payouts',
  'subscription_payout_items',
  'loyalty_points',
  'loyalty_points_events',
  'loyalty_transactions',
  'loyalty_rewards',
  'notifications',
  'days_off',
  'staff_availability',
  'goals',
  'staff_access_log',
];

const carimbo = process.argv[2] ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const pasta = `backups/${carimbo}`;
mkdirSync(pasta, { recursive: true });

let totalLinhas = 0;
const resumo = [];

for (const tabela of TABELAS) {
  const linhas = [];
  let de = 0;
  const passo = 1000;

  // Pagina de mil em mil: tabela grande nao vem inteira numa consulta so
  for (;;) {
    const { data, error } = await admin.from(tabela).select('*').range(de, de + passo - 1);
    if (error) {
      resumo.push({ tabela, linhas: 'erro', detalhe: error.message });
      break;
    }
    linhas.push(...(data ?? []));
    if (!data || data.length < passo) break;
    de += passo;
  }

  if (!resumo.find((r) => r.tabela === tabela)) {
    writeFileSync(`${pasta}/${tabela}.json`, JSON.stringify(linhas, null, 2), 'utf8');
    resumo.push({ tabela, linhas: linhas.length });
    totalLinhas += linhas.length;
  }
}

writeFileSync(
  `${pasta}/_resumo.json`,
  JSON.stringify({ feitoEm: new Date().toISOString(), totalLinhas, tabelas: resumo }, null, 2),
  'utf8'
);

console.log(`backup em ${pasta}`);
for (const r of resumo) {
  console.log(`  ${String(r.linhas).padStart(6)}  ${r.tabela}${r.detalhe ? '  (' + r.detalhe.slice(0, 60) + ')' : ''}`);
}
console.log(`\ntotal: ${totalLinhas} linhas`);
process.exit(0);
