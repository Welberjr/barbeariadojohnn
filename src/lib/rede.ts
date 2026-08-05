/**
 * A rede vista de cima.
 *
 * Sem esta conta, ter duas lojas significa abrir uma, anotar, abrir a outra e
 * comparar de cabeca. O dono precisa da soma e da comparacao na mesma tela.
 *
 * So entram as unidades onde a pessoa tem gestao. Gerente de uma loja nao ve o
 * faturamento da outra nem por aqui.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { lojasDoUsuario } from '@/lib/loja';

export interface RetratoDaUnidade {
  id: string;
  nome: string;
  cidade: string | null;
  faturamento: number;
  atendimentos: number;
  ticket: number;
  clientes: number;
  equipe: number;
  comissoes: number;
  /** Quanto esta unidade representa do faturamento da rede, em porcento */
  fatiaDaRede: number;
}

export interface RetratoDaRede {
  unidades: RetratoDaUnidade[];
  faturamento: number;
  atendimentos: number;
  ticket: number;
  clientes: number;
  equipe: number;
  comissoes: number;
  de: string;
  ate: string;
}

/**
 * O periodo padrao e o mes corrente, que e como o dono pensa: "como estamos
 * este mes". Datas no formato AAAA-MM-DD, no fuso da barbearia.
 */
export async function retratoDaRede(opts: {
  userId: string;
  de?: string;
  ate?: string;
}): Promise<RetratoDaRede> {
  const admin = createAdminClient();

  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;

  const de = opts.de ?? primeiroDoMes;
  const ate = opts.ate ?? hoje;
  const inicio = `${de}T00:00:00.000-03:00`;
  const fim = `${ate}T23:59:59.999-03:00`;

  const minhas = (await lojasDoUsuario(opts.userId)).filter((l) => l.podeGerir);
  const idsDasLojas = minhas.map((l) => l.id);

  // Uma conta por loja, preenchida pelas consultas agrupadas logo abaixo.
  const contas = new Map<
    string,
    { total: number; atendimentos: number; clientes: number; equipe: number; credito: number; comissoes: number }
  >();
  for (const id of idsDasLojas) {
    contas.set(id, { total: 0, atendimentos: 0, clientes: 0, equipe: 0, credito: 0, comissoes: 0 });
  }

  if (idsDasLojas.length > 0) {
    // Primeira rodada: uma consulta por pergunta para a rede INTEIRA, em vez
    // de tres por loja. A separacao por unidade acontece aqui em JS.
    const [{ data: comandas }, { data: clienteRows }, { data: equipeRows }] = await Promise.all([
      admin
        .from('comandas')
        .select('id, total, barbershop_id')
        .in('barbershop_id', idsDasLojas)
        .eq('status', 'closed')
        .gte('closed_at', inicio)
        .lte('closed_at', fim),
      admin
        .from('customers')
        .select('barbershop_id')
        .in('barbershop_id', idsDasLojas)
        .eq('active', true),
      admin
        .from('staff')
        .select('barbershop_id')
        .in('barbershop_id', idsDasLojas)
        .eq('active', true),
    ]);

    for (const r of clienteRows ?? []) {
      const conta = contas.get(r.barbershop_id as string);
      if (conta) conta.clientes += 1;
    }
    for (const r of equipeRows ?? []) {
      const conta = contas.get(r.barbershop_id as string);
      if (conta) conta.equipe += 1;
    }

    const lojaDaComanda = new Map<string, string>();
    for (const c of comandas ?? []) {
      lojaDaComanda.set(c.id as string, c.barbershop_id as string);
      const conta = contas.get(c.barbershop_id as string);
      if (conta) {
        conta.total += Number(c.total ?? 0);
        conta.atendimentos += 1;
      }
    }

    // Segunda rodada: creditos e comissoes dependem dos ids das comandas, mas
    // tambem vem da rede inteira de uma vez.
    //
    // Credito da casa nao e faturamento: o dinheiro entrou antes, fora do
    // caixa. A mesma regra do financeiro de cada loja vale aqui.
    const idsComandas = Array.from(lojaDaComanda.keys());
    if (idsComandas.length > 0) {
      const [{ data: usos }, { data: itens }] = await Promise.all([
        admin.from('customer_credit_uses').select('comanda_id, amount').in('comanda_id', idsComandas),
        admin.from('comanda_items').select('comanda_id, commission_value').in('comanda_id', idsComandas),
      ]);
      for (const u of usos ?? []) {
        const conta = contas.get(lojaDaComanda.get(u.comanda_id as string) ?? '');
        if (conta) conta.credito += Number(u.amount ?? 0);
      }
      for (const i of itens ?? []) {
        const conta = contas.get(lojaDaComanda.get(i.comanda_id as string) ?? '');
        if (conta) conta.comissoes += Number(i.commission_value ?? 0);
      }
    }
  }

  const unidades: RetratoDaUnidade[] = minhas.map((loja) => {
    const conta = contas.get(loja.id)!;
    const faturamento = conta.total - conta.credito;
    return {
      id: loja.id,
      nome: loja.nome,
      cidade: loja.cidade,
      faturamento,
      atendimentos: conta.atendimentos,
      ticket: conta.atendimentos > 0 ? faturamento / conta.atendimentos : 0,
      clientes: conta.clientes,
      equipe: conta.equipe,
      comissoes: conta.comissoes,
      fatiaDaRede: 0,
    };
  });

  const faturamento = unidades.reduce((s, u) => s + u.faturamento, 0);
  const atendimentos = unidades.reduce((s, u) => s + u.atendimentos, 0);

  for (const u of unidades) {
    u.fatiaDaRede = faturamento > 0 ? (u.faturamento / faturamento) * 100 : 0;
  }

  unidades.sort((a, b) => b.faturamento - a.faturamento);

  return {
    unidades,
    faturamento,
    atendimentos,
    ticket: atendimentos > 0 ? faturamento / atendimentos : 0,
    clientes: unidades.reduce((s, u) => s + u.clientes, 0),
    equipe: unidades.reduce((s, u) => s + u.equipe, 0),
    comissoes: unidades.reduce((s, u) => s + u.comissoes, 0),
    de,
    ate,
  };
}
