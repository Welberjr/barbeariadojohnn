/**
 * Convite para o cliente criar a conta dele.
 *
 * O problema que isto resolve: a barbearia tem 412 clientes com historico,
 * pontos e assinatura, e nenhum deles tem login. Se o cadastro fosse solto, a
 * pessoa criaria uma conta nova e vazia, do lado da ficha que ja existe, e o
 * historico dela ficaria orfao.
 *
 * A saida obvia seria ligar pelo telefone digitado. So que ai qualquer um que
 * saiba o telefone de um cliente entra na ficha dele, ve o historico e usa a
 * assinatura que a pessoa paga. Telefone nao e segredo.
 *
 * Entao o vinculo so acontece por convite: a barbearia gera o link daquele
 * cliente e manda para ele. O link leva o identificador e uma assinatura que so
 * o servidor sabe fazer, entao ninguem inventa o convite de outra pessoa nem
 * trocando um numero na barra de endereco.
 *
 * Nao precisa de tabela nova: a assinatura e calculada na hora, a partir do
 * identificador do cliente e de um segredo que nunca sai do servidor.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * O segredo vem da credencial de servico, que ja existe e nunca vai para o
 * navegador. Trocar essa credencial invalida todos os convites de uma vez, o
 * que e o comportamento certo.
 */
function segredo(): string {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('sem credencial de serviço para assinar o convite');
  return `convite-cliente:${chave}`;
}

/**
 * Validade do convite. O formato antigo valia para sempre: um link mandado por
 * engano, ou parado num grupo de WhatsApp, abria a ficha do cliente anos
 * depois. Trinta dias cobrem com folga o tempo entre mandar e a pessoa criar a
 * senha.
 */
const VALIDADE_DIAS = 30;

/** Assinatura do formato antigo, sem validade. Só existe para conferência. */
function assinarAntigo(customerId: string): string {
  return createHmac('sha256', segredo()).update(customerId).digest('base64url').slice(0, 32);
}

/**
 * Assinatura do formato novo: o HMAC cobre o identificador E o prazo, então
 * ninguém estica a validade de um convite trocando o número na URL, porque a
 * assinatura deixa de bater.
 */
function assinarComPrazo(customerId: string, expiraEm: number): string {
  return createHmac('sha256', segredo())
    .update(`v2:${customerId}:${expiraEm}`)
    .digest('base64url')
    .slice(0, 32);
}

// Comparação de tempo constante: comparar com === entrega, pelo tempo de
// resposta, quantos caracteres iniciais alguém acertou.
function iguaisSemVazarTempo(esperado: string, recebido: string): boolean {
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** O pedaço que vai na URL, depois do id. Formato: v2.<vence em>.<assinatura>. */
export function gerarConvite(customerId: string): string {
  const expiraEm = Math.floor(Date.now() / 1000) + VALIDADE_DIAS * 24 * 60 * 60;
  return `v2.${expiraEm}.${assinarComPrazo(customerId, expiraEm)}`;
}

/**
 * Confere se o convite foi mesmo gerado por nós para aquele cliente e se ainda
 * está no prazo.
 */
export function conviteValido(customerId: string, token: string | null | undefined): boolean {
  if (!token) return false;

  // Formato novo: v2.<vence em segundos>.<assinatura>
  if (token.startsWith('v2.')) {
    const partes = token.split('.');
    if (partes.length !== 3) return false;

    const expiraEm = Number(partes[1]);
    if (!Number.isInteger(expiraEm) || expiraEm <= 0) return false;

    // Convite vencido não abre a ficha, mesmo com assinatura certa.
    if (expiraEm * 1000 < Date.now()) return false;

    return iguaisSemVazarTempo(assinarComPrazo(customerId, expiraEm), partes[2]);
  }

  // Formato antigo, sem validade. Continua aceito porque os links já mandados
  // aos clientes não podem quebrar de uma hora para outra.
  // TODO: remover esta aceitação depois de uns meses (por volta de 11/2026),
  // quando os convites antigos já tiverem sido usados ou reenviados no novo.
  return iguaisSemVazarTempo(assinarAntigo(customerId), token);
}

/** O endereço completo, pronto para mandar. */
export function linkDoConvite(customerId: string, base: string): string {
  const url = new URL('/cliente/cadastro', base);
  url.searchParams.set('c', customerId);
  url.searchParams.set('t', gerarConvite(customerId));
  return url.toString();
}

/** A mensagem que a barbearia manda, já com o primeiro nome de quem recebe. */
export function mensagemDoConvite(dados: {
  nomeCliente: string;
  nomeBarbearia: string;
  link: string;
}): string {
  const primeiroNome = dados.nomeCliente.trim().split(' ')[0];

  return (
    `Oi, ${primeiroNome}! Aqui é da ${dados.nomeBarbearia}. ` +
    `Criamos um aplicativo para você marcar horário sozinho, ver seus pontos e acompanhar sua assinatura. ` +
    `É só criar sua senha neste link, leva um minuto: ${dados.link}`
  );
}
