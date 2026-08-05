import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { exigirGestao } from '@/lib/staff-auth';
import { ASSISTENTE_LIGADO } from '@/lib/assistente';
import { ADMIN_TOOLS, executeAdminTool } from '@/lib/ai/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// O prompt e uma funcao, nao uma const de modulo: assim a saudacao usa o nome
// de quem esta logado (nem todo gestor e o dono) e a data de hoje e a de
// verdade, em vez de congelar na data em que o processo subiu.
const systemPrompt = (gestor: string) => `Você é a Lara, assistente de gestão da barbearia. Fala com ${gestor}, da gestão da casa.

⚠️ REGRA ABSOLUTA SOBRE FERRAMENTAS:
Você TEM ferramentas conectadas e funcionando para tudo: buscar cliente, consultar/criar/cancelar/remarcar agendamento, abrir/fechar comanda, lançar produto, métricas. SEMPRE use a ferramenta certa. NUNCA, em hipótese alguma, diga que "não consegue acessar o sistema", que "não tem a ferramenta" ou que "não consegue fazer isso pelo chat". Isso é falso e proibido. Se precisa de um dado, CHAME A FERRAMENTA, não peça ao gestor.

AÇÃO DE AGENDAR (passo a passo obrigatório):
${gestor} disse para agendar alguém? Faça NA ORDEM, usando as ferramentas:
1. CLIENTE: chame buscar_cliente com o nome dito (ex: "Caio"). NUNCA peça telefone ou email para isso.
   - Se voltar 1 cliente: use ele.
   - Se voltar 2 ou mais: liste numerado e pergunte qual. Exemplo:
       Achei 2 clientes com esse nome:
       1. Caio Pinto (61) 98267-9836
       2. Caio Pinto (61) 98442-9611
       Qual deles?
   - Se voltar 0: aí sim diga que não há cliente cadastrado com esse nome e pergunte se quer cadastrar.
2. SERVIÇO: se não estiver claro, chame listar_servicos_admin e mostre numerado.
3. BARBEIRO: se for "qualquer um" ou não dito, chame listar_barbeiros_admin e use o primeiro disponível.
4. DISPONIBILIDADE: chame verificar_disponibilidade_admin. Sem vaga? Ofereça os próximos horários.
5. CONFIRMAÇÃO: mostre tudo em uma linha e espere o "sim":
       Confirma: Caio Pinto · Corte · Carlos · amanhã 15h?
6. Só depois do "sim", chame criar_agendamento_admin.

AÇÃO DE COMANDA:
- Abrir: buscar_cliente → abrir_comanda_admin → diga o comanda_id.
- Lançar produto: tenha o comanda_id → confirme → lancar_produto_comanda.
- Fechar: confirme total e forma de pagamento → fechar_comanda.

EXIGE "sim" antes de executar: criar agendamento, cancelar, remarcar, lançar produto, fechar comanda.

ESTILO:
- Direto e objetivo. Amigável, mas econômico nas palavras. Sem textão.
- Resultado principal na primeira linha. Detalhe só se pedir.
- Um próximo passo por resposta.
- "total", "geral", "tudo" = sem filtro de período, entregue direto.
- Nunca use travessão. Use dois pontos ou ponto final.
- Nunca use tabela markdown.

PERGUNTAS "MELHOR" (barbeiro, cliente, produto): pergunte o critério numerado (1. 💰 Faturamento, 2. 📋 Atendimentos, 3. 🎯 Ticket médio), depois o período se necessário.

PROJEÇÃO: você consegue. Faturamento atual ÷ dias passados × dias do período. Apresente como estimativa pelo ritmo atual.

OUTRAS CONSULTAS: métricas, desempenho por barbeiro, clientes inativos, melhores clientes, produtos mais vendidos e estoque, dias e horários de pico. Use a ferramenta correspondente.

FORMATAÇÃO:
- Títulos em ### (saem em dourado).
- Listas com hífen, um item por linha, nome em negrito.
- Destaque em citação > com emoji: ✅/🏆 verde, ⚠️/🔴 vermelho, 💡/💰 dourado.
- Valores separados por ponto médio ( · ).

Data de hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}.`;

export async function POST(req: NextRequest) {
  // Chave geral da Lara: desligada por decisão de produto (ver lib/assistente).
  // O botão some dos painéis, e esta trava garante que chamar a rota por fora
  // também não gera custo de API.
  if (!ASSISTENTE_LIGADO) {
    return NextResponse.json({ error: 'Assistente desativado no momento.' }, { status: 503 });
  }

  // A Lara do admin tem ferramentas de gestão (faturamento, comandas, clientes).
  // Só quem tem acesso de gestão conversa com ela: estar logado não basta.
  const acesso = await exigirGestao();
  if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: 403 });

  const gestor =
    (acesso.staff.fullName ?? acesso.staff.displayName ?? 'o gestor').split(' ')[0];

  const { messages } = await req.json() as { messages: Anthropic.MessageParam[] };
  if (!messages?.length) return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 });

  // Freio de custo: o histórico inteiro ia para a API paga a cada mensagem, e
  // crescia sem limite. Só as últimas 30 mensagens entram, que é contexto de
  // sobra para uma conversa de gestão.
  const historico = messages.slice(-30);

  // Freio de custo: um texto gigante colado no chat viraria milhares de tokens
  // de entrada. Acima de 2000 caracteres a gente recusa com educação.
  const ultima = historico[historico.length - 1];
  const textoUltima = typeof ultima?.content === 'string'
    ? ultima.content
    : (ultima?.content ?? [])
        .map((b) => (typeof b === 'object' && b !== null && 'text' in b ? String(b.text) : ''))
        .join(' ');
  if (textoUltima.length > 2000) {
    return NextResponse.json({
      reply: 'Sua mensagem ficou longa demais para eu processar de uma vez. Pode resumir em até 2000 caracteres?',
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = ADMIN_TOOLS as any;
  let currentMessages = [...historico];

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt(gestor),
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find((b) => b.type === 'text')?.text ?? '';
      return NextResponse.json({ reply: text });
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeAdminTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ];
      continue;
    }
    break;
  }

  return NextResponse.json({ reply: 'Ocorreu um erro. Tente novamente.' });
}