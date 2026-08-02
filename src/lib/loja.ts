/**
 * De qual loja e cada tela.
 *
 * O sistema nasceu com uma loja so, e o identificador dela estava escrito fixo
 * em 59 arquivos. Funcionava, mas nao existia onde criar a segunda: a pergunta
 * "qual loja?" nunca era feita.
 *
 * Agora ela e feita aqui, num lugar so. Enquanto existir uma unidade, esta
 * funcao devolve exatamente o mesmo identificador de antes, e o sistema se
 * comporta igual. Quando o Johnn abrir a segunda, cada pessoa passa a ver a
 * dela sem que nenhuma tela precise ser reescrita de novo.
 *
 * COMO A LOJA E DESCOBERTA, nesta ordem:
 *
 *  1. A escolha da pessoa, guardada num cookie. So vale se ela realmente
 *     trabalhar naquela unidade: cookie e coisa que o navegador manda, e
 *     ninguem entra no caixa da outra loja trocando um valor no aparelho.
 *  2. O cadastro de equipe dela. Quem trabalha em uma unidade so nunca precisa
 *     escolher nada.
 *  3. A ficha de cliente dela, para quem so e cliente.
 *  4. A unica loja ativa, quando nao ha ninguem logado: site publico,
 *     webhook de pagamento, tarefa da madrugada.
 *
 * O banco ja estava pronto para isto: toda tabela de movimento carrega
 * barbershop_id, e a trava de equipe e (barbershop_id, profile_id), ou seja, a
 * mesma pessoa pode ter um cadastro por unidade.
 */
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A primeira loja, a do Johnn.
 *
 * Continua existindo para os caminhos que nao tem pessoa logada nem como
 * perguntar: webhook que chega do Mercado Pago, tarefa que roda de madrugada,
 * site publico. Enquanto houver uma unidade so, e a resposta certa para todos
 * eles. Quando houver mais, cada um desses caminhos precisa dizer de qual loja
 * esta falando, e o lugar de arrumar isso e aqui.
 */
export const LOJA_PRINCIPAL = '11111111-1111-1111-1111-111111111111';

/** Nome do cookie onde fica a unidade escolhida por quem tem mais de uma. */
export const COOKIE_DA_LOJA = 'bj_loja';

export interface Loja {
  id: string;
  nome: string;
  slug: string | null;
  cidade: string | null;
  ativa: boolean;
}

/** Todas as unidades ativas da rede, na ordem do nome. */
export const lojasAtivas = cache(async function lojasAtivas(): Promise<Loja[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('barbershops')
    .select('id, name, slug, address_city, active')
    .eq('active', true)
    .order('name');

  return (data ?? []).map((l) => ({
    id: l.id as string,
    nome: l.name as string,
    slug: (l.slug as string) ?? null,
    cidade: (l.address_city as string) ?? null,
    ativa: l.active !== false,
  }));
});

/**
 * Em quais unidades esta pessoa trabalha.
 *
 * Uma linha por unidade, porque o acesso e por loja: o gerente da unidade B
 * manda na B e nao encosta na A. Quem nao trabalha em lugar nenhum recebe
 * lista vazia, e nao a rede inteira.
 */
export const lojasDoUsuario = cache(async function lojasDoUsuario(
  userId: string
): Promise<Array<Loja & { podeGerir: boolean }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('staff')
    .select('barbershop_id, can_manage, barbershop:barbershops(id, name, slug, address_city, active)')
    .eq('profile_id', userId)
    .eq('active', true)
    .is('fired_at', null);

  const lojas: Array<Loja & { podeGerir: boolean }> = [];
  for (const linha of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rel = linha.barbershop as any;
    const loja = Array.isArray(rel) ? rel[0] : rel;
    if (!loja || loja.active === false) continue;
    lojas.push({
      id: loja.id as string,
      nome: loja.name as string,
      slug: (loja.slug as string) ?? null,
      cidade: (loja.address_city as string) ?? null,
      ativa: true,
      podeGerir: linha.can_manage === true,
    });
  }

  return lojas.sort((a, b) => a.nome.localeCompare(b.nome));
});

/**
 * A loja da tela que esta sendo montada agora.
 *
 * Cacheada por requisicao: uma pagina pode perguntar dez vezes e o banco e
 * consultado uma so.
 */
export const lojaAtual = cache(async function lojaAtual(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return await lojaPadrao();

    const daEquipe = await lojasDoUsuario(user.id);

    if (daEquipe.length > 0) {
      // A escolha so vale se a pessoa realmente trabalhar la
      const escolhida = (await cookies()).get(COOKIE_DA_LOJA)?.value;
      if (escolhida && daEquipe.some((l) => l.id === escolhida)) return escolhida;
      return daEquipe[0].id;
    }

    // So cliente: a loja e a da ficha dele
    const admin = createAdminClient();
    const { data: ficha } = await admin
      .from('customers')
      .select('barbershop_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (ficha?.barbershop_id) return ficha.barbershop_id as string;

    return await lojaPadrao();
  } catch {
    // Nenhuma tela pode quebrar por causa disto: sem resposta, a loja principal
    return LOJA_PRINCIPAL;
  }
});

/**
 * A loja de quem nao esta logado.
 *
 * Enquanto existir uma unidade ativa so, e ela. Com mais de uma, e a principal,
 * e o caminho que chamou precisa ser ensinado a dizer qual quer.
 */
export async function lojaPadrao(): Promise<string> {
  const lojas = await lojasAtivas();
  if (lojas.length === 1) return lojas[0].id;
  return LOJA_PRINCIPAL;
}

/** Dados da loja, para mostrar nome e cidade na tela. */
export async function dadosDaLoja(id: string): Promise<Loja | null> {
  const lojas = await lojasAtivas();
  return lojas.find((l) => l.id === id) ?? null;
}
