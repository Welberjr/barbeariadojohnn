/**
 * EXPORTA OS DADOS DO ECOBARBER
 *
 * Roda no navegador, no console, com o EcoBarber aberto e logado. Baixa um
 * arquivo .json com tudo, que depois entra aqui pelo migrar-ecobarber.mjs.
 *
 * Como usar:
 *  1. Abra https://dash.ecobarber.com.br e entre na conta
 *  2. Aperte F12 e va na aba Console
 *  3. Cole este arquivo inteiro e aperte Enter
 *  4. Espere o aviso de pronto: o arquivo cai na pasta de downloads
 *
 * Pode rodar quantas vezes quiser. A importacao do nosso lado so traz o que
 * ainda nao esta la, entao exportar de novo nunca duplica nada.
 *
 * Le pela sessao de quem esta logado: nao pede senha e nao guarda credencial
 * em lugar nenhum. Se a pagina nao estiver logada, ele avisa e para.
 */
(async () => {
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

  // Nada aqui e chutado: o endereco e a credencial saem da propria sessao que o
  // aplicativo deles ja deixou guardada no navegador. A chave do armazenamento
  // tem o formato sb-<projeto>-auth-token, e o <projeto> e o endereco do banco.
  const chaveSessao = Object.keys(localStorage).find(
    (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
  );

  if (!chaveSessao) {
    console.error('Não achei a sessão. Entre na conta do EcoBarber e rode de novo.');
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
    console.error('A sessão está num formato que não reconheci. Saia e entre de novo no EcoBarber.');
    return;
  }

  // O proprio token da sessao serve de credencial nos dois cabecalhos, entao
  // nao e preciso ir cacar a chave publica dentro do programa do site.
  const cabecalhos = { apikey: token, Authorization: `Bearer ${token}` };

  console.log(`Lendo de ${URL_BASE} com a sua sessão.`);
  const dados = {};

  for (const tabela of TABELAS) {
    const linhas = [];

    // Vem de mil em mil: sem isso, tabela grande volta cortada e ninguem percebe
    for (let de = 0; ; de += 1000) {
      const resposta = await fetch(
        `${URL_BASE}/rest/v1/${tabela}?select=*&limit=1000&offset=${de}`,
        { headers: cabecalhos }
      );

      if (!resposta.ok) {
        console.warn(`${tabela}: não consegui ler (${resposta.status})`);
        break;
      }

      const bloco = await resposta.json();
      linhas.push(...bloco);
      if (bloco.length < 1000) break;
    }

    dados[tabela] = linhas;
    console.log(`${tabela}: ${linhas.length}`);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const arquivo = new Blob([JSON.stringify(dados)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = `ecobarber-export-${hoje}.json`;
  link.click();

  console.log(`%cPronto. O arquivo ecobarber-export-${hoje}.json foi para os seus downloads.`,
    'color: #16a34a; font-weight: bold');
})();
