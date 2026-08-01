/**
 * EXPORTA OS DADOS DO ECOBARBER
 *
 * Roda no navegador, no console, com o EcoBarber aberto e logado. Baixa um
 * arquivo .json com tudo, que depois entra no nosso sistema pelo
 * migrar-ecobarber.mjs.
 *
 * ANTES DE RODAR: preencha a CHAVE_PUBLICA logo abaixo. Como pegar, uma vez so:
 *
 *   1. Com o EcoBarber aberto, aperte F12 e va na aba Rede (Network)
 *   2. Clique em qualquer menu do sistema (Clientes, por exemplo)
 *   3. Na lista, clique numa linha que tenha "supabase.co"
 *   4. Procure "apikey" nos cabecalhos da requisicao e copie o valor inteiro
 *      (comeca com eyJ e e bem comprido)
 *
 * Essa chave e publica: ela vai em toda requisicao que o site ja faz, e sozinha
 * nao abre nada. Quem da acesso de verdade e a sua sessao, que fica no seu
 * navegador e nao sai daqui.
 *
 * DEPOIS:
 *   1. Cole este arquivo inteiro no Console e aperte Enter
 *   2. Espere o aviso verde de pronto: o arquivo cai na pasta de downloads
 *
 * Pode rodar quantas vezes quiser. A importacao do nosso lado so traz o que
 * ainda nao esta la, entao exportar de novo nunca duplica nada.
 */
(async () => {
  // ----------------------------------------------------------------
  // COLE A CHAVE AQUI (entre as aspas)
  // ----------------------------------------------------------------
  const CHAVE_PUBLICA = '';

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

  // Tabelas que, se vierem vazias, significam que deu errado. As outras podem
  // estar vazias de verdade, entao nao servem de prova.
  const NAO_PODEM_VIR_VAZIAS = ['clientes', 'atendimentos', 'comandas'];

  const erro = (msg) => console.error('%c' + msg, 'color:#dc2626;font-size:14px;font-weight:bold');

  if (!CHAVE_PUBLICA) {
    erro('Falta a chave. Leia as instruções no topo deste script e preencha CHAVE_PUBLICA.');
    return;
  }

  // O endereco do banco sai do nome da sessao guardada pelo proprio site:
  // sb-<projeto>-auth-token
  const chaveSessao = Object.keys(localStorage).find(
    (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
  );

  if (!chaveSessao) {
    erro('Não achei a sessão. Entre na conta do EcoBarber e rode de novo.');
    return;
  }

  const projeto = chaveSessao.replace(/^sb-/, '').replace(/-auth-token$/, '');
  const URL_BASE = `https://${projeto}.supabase.co`;

  let token;
  try {
    const bruto = localStorage.getItem(chaveSessao);
    const limpo = bruto.startsWith('base64-') ? atob(bruto.slice(7)) : bruto;
    token = JSON.parse(limpo).access_token;
  } catch {
    erro('A sessão está num formato que não reconheci. Saia e entre de novo no EcoBarber.');
    return;
  }

  const cabecalhos = { apikey: CHAVE_PUBLICA, Authorization: `Bearer ${token}` };
  const dados = {};
  const problemas = [];

  console.log(`Lendo de ${URL_BASE}...`);

  for (const tabela of TABELAS) {
    const linhas = [];
    let falhou = false;

    // Vem de mil em mil: sem isso, tabela grande volta cortada e ninguem percebe
    for (let de = 0; ; de += 1000) {
      const resposta = await fetch(
        `${URL_BASE}/rest/v1/${tabela}?select=*&limit=1000&offset=${de}`,
        { headers: cabecalhos }
      );

      if (!resposta.ok) {
        const detalhe = await resposta.text();
        problemas.push(`${tabela}: ${resposta.status} ${detalhe.slice(0, 120)}`);
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
    console.log(`${tabela}: ${linhas.length}`);
  }

  // Arquivo vazio e pior que arquivo nenhum: parece que deu certo, entra no
  // sistema sem trazer nada e so aparece la na frente. Se houve qualquer
  // problema, nao baixa e explica o que aconteceu.
  if (problemas.length) {
    erro('NÃO baixei o arquivo, porque a leitura falhou:');
    for (const p of problemas) console.error('   • ' + p);
    erro('Confira se a CHAVE_PUBLICA está certa e se você continua logado, e rode de novo.');
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const arquivo = new Blob([JSON.stringify(dados)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = `ecobarber-export-${hoje}.json`;
  link.click();

  const total = Object.values(dados).reduce((s, l) => s + l.length, 0);
  console.log(
    `%cPronto: ${total} registros em ecobarber-export-${hoje}.json, na sua pasta de downloads.`,
    'color:#16a34a;font-size:14px;font-weight:bold'
  );
})();
