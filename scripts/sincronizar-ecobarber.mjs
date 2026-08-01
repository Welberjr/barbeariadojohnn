/**
 * SINCRONIZA O ECOBARBER COM O NOSSO SISTEMA, SOZINHO
 *
 * Entra no sistema antigo, baixa tudo, traz o que mudou e conta o que fez.
 * Serve para a ponte entre os dois mundos: enquanto o Johnn ainda atende no
 * EcoBarber, o nosso sistema acompanha o movimento dele sem ninguem precisar
 * lembrar de exportar nada.
 *
 * Uso:
 *   node scripts/sincronizar-ecobarber.mjs
 *   node scripts/sincronizar-ecobarber.mjs --so-baixar   (baixa e nao importa)
 *
 * Precisa destas linhas no .env.local, que fica so nesta maquina:
 *   ECOBARBER_URL, ECOBARBER_ANON_KEY, ECOBARBER_EMAIL, ECOBARBER_SENHA
 *
 * Pode rodar quantas vezes quiser: a importacao so traz o que ainda nao esta
 * la, entao repetir nunca duplica nada.
 *
 * O arquivo baixado fica em backups/ecobarber/, que o git ignora. Guardar as
 * copias importa: se algum dia a conta do sistema antigo for fechada, elas sao
 * a unica prova do que existia.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const { ECOBARBER_URL, ECOBARBER_ANON_KEY, ECOBARBER_EMAIL, ECOBARBER_SENHA } = env;

if (!ECOBARBER_URL || !ECOBARBER_ANON_KEY || !ECOBARBER_EMAIL || !ECOBARBER_SENHA) {
  console.error('faltam as linhas do ECOBARBER no .env.local');
  process.exit(1);
}

const TABELAS = [
  'barbearias',
  'profiles',
  'user_roles',
  'clientes',
  'servicos',
  'produtos',
  'atendimentos',
  'transacoes',
  'comandas',
  'planos_assinatura',
  'assinaturas_cliente',
  'pagamentos_assinatura_cliente',
];

/** Se estas vierem vazias, algo deu errado: nao existe barbearia sem cliente. */
const NAO_PODEM_VIR_VAZIAS = ['clientes', 'atendimentos', 'comandas'];

const agora = () =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

console.log(`\n[${agora()}] sincronizando com o EcoBarber`);

// ------------------------------------------------------------------
// 1. Entrar
// ------------------------------------------------------------------
const login = await fetch(`${ECOBARBER_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ECOBARBER_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ECOBARBER_EMAIL, password: ECOBARBER_SENHA }),
});

const sessao = await login.json();

if (!sessao.access_token) {
  console.error('  não consegui entrar no EcoBarber:', JSON.stringify(sessao).slice(0, 160));
  console.error('  se a senha mudou, atualize ECOBARBER_SENHA no .env.local');
  process.exit(1);
}

const cabecalhos = {
  apikey: ECOBARBER_ANON_KEY,
  Authorization: `Bearer ${sessao.access_token}`,
};

// ------------------------------------------------------------------
// 2. Baixar
// ------------------------------------------------------------------
const dados = {};
const problemas = [];

for (const tabela of TABELAS) {
  const linhas = [];
  let falhou = false;

  // De mil em mil: sem isso a tabela grande volta cortada e ninguem percebe
  for (let de = 0; ; de += 1000) {
    const resposta = await fetch(
      `${ECOBARBER_URL}/rest/v1/${tabela}?select=*&limit=1000&offset=${de}`,
      { headers: cabecalhos }
    );

    if (!resposta.ok) {
      problemas.push(`${tabela}: ${resposta.status} ${(await resposta.text()).slice(0, 100)}`);
      falhou = true;
      break;
    }

    const bloco = await resposta.json();
    linhas.push(...bloco);
    if (bloco.length < 1000) break;
  }

  if (!falhou && !linhas.length && NAO_PODEM_VIR_VAZIAS.includes(tabela)) {
    problemas.push(`${tabela}: veio vazia, e essa tabela nunca deveria estar vazia`);
  }

  dados[tabela] = linhas;
}

// Arquivo vazio e pior que arquivo nenhum: parece que deu certo e entra sem
// trazer nada. Na duvida, para aqui e nao encosta no nosso banco.
if (problemas.length) {
  console.error('  a leitura falhou, não vou importar nada:');
  for (const p of problemas) console.error('   • ' + p);
  process.exit(1);
}

const total = Object.values(dados).reduce((s, l) => s + l.length, 0);
console.log(
  `  baixado: ${total} registros ` +
    `(${dados.clientes.length} clientes, ${dados.atendimentos.length} atendimentos, ${dados.comandas.length} comandas)`
);

// ------------------------------------------------------------------
// 3. Guardar a cópia
// ------------------------------------------------------------------
const pasta = 'backups/ecobarber';
if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true });

const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const arquivo = `${pasta}/ecobarber-${dia}.json`;
writeFileSync(arquivo, JSON.stringify(dados));
console.log(`  cópia guardada em ${arquivo}`);

if (process.argv.includes('--so-baixar')) {
  console.log('  --so-baixar: parando aqui, sem importar');
  process.exit(0);
}

// ------------------------------------------------------------------
// 4. Trazer o que mudou
// ------------------------------------------------------------------
console.log('');
try {
  const saida = execFileSync(
    process.execPath,
    ['scripts/migrar-ecobarber.mjs', arquivo, '--atualizar'],
    { encoding: 'utf8' }
  );

  // Mostra so o resumo do que entrou, que e o que interessa no dia a dia
  const linhas = saida.split('\n');
  const inicio = linhas.findIndex((l) => l.includes('O QUE ENTROU AGORA'));

  if (inicio >= 0) {
    const resumo = linhas.slice(inicio + 1).filter((l) => l.trim().startsWith('+'));
    if (resumo.length) {
      console.log('  entrou agora:');
      for (const l of resumo) console.log('   ' + l.trim());
    } else {
      console.log('  nada novo: o nosso sistema já estava em dia');
    }
  } else {
    console.log(saida);
  }
} catch (erro) {
  console.error('  a importação falhou:', erro.message.slice(0, 300));
  process.exit(1);
}

console.log(`\n[${agora()}] pronto\n`);
