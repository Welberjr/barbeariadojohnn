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

  const unidades: RetratoDaUnidade[] = [];

  for (const loja of minhas) {
    const [{ data: comandas }, { count: clientes }, { count: equipe }] = await Promise.all([
      admin
        .from('comandas')
        .select('id, total')
        .eq('barbershop_id', loja.id)
        .eq('status', 'closed')
        .gte('closed_at', inicio)
        .lte('closed_at', fim),
      admin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', loja.id)
        .eq('active', true),
      admin
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', loja.id)
        .eq('active', true),
    ]);

    const ids = (comandas ?? []).map((c) => c.id as string);

    // Credito da casa nao e faturamento: o dinheiro entrou antes, fora do
    // caixa. A mesma regra do financeiro de cada loja vale aqui.
    let credito = 0;
    let comissoes = 0;
    if (ids.length > 0) {
      const [{ data: usos }, { data: itens }] = await Promise.all([
        admin.from('customer_credit_uses').select('amount').in('comanda_id', ids),
        admin.from('comanda_items').select('commission_value').in('comanda_id', ids),
      ]);
      credito = (usos ?? []).reduce((s, u) => s + Number(u.amount ?? 0), 0);
      comissoes = (itens ?? []).reduce((s, i) => s + Number(i.commission_value ?? 0), 0);
    }

    const faturamento =
      (comandas ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0) - credito;
    const atendimentos = (comandas ?? []).length;

    unidades.push({
      id: loja.id,
      nome: loja.nome,
      cidade: loja.cidade,
      faturamento,
      atendimentos,
      ticket: atendimentos > 0 ? faturamento / atendimentos : 0,
      clientes: clientes ?? 0,
      equipe: equipe ?? 0,
      comissoes,
      fatiaDaRede: 0,
    });
  }

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
