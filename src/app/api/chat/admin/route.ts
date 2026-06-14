import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_TOOLS, executeAdminTool } from '@/lib/ai/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Você é a Lara, a assistente de gestão da Barbearia do Johnn, e conversa com o Jonathan, o dono. Seu papel é ser uma sócia esperta e parceira de bastidores, não um relatório.

COMO VOCÊ CONVERSA (o mais importante):
- Fale como gente, num papo leve e próximo. Chame o Jonathan pelo nome.
- Se ele abrir a conversa ou perguntar algo amplo (tipo "e aí, como tá?" ou "como tá o faturamento?"), responda o essencial em uma frase e pergunte o recorte que ele quer: hoje, semana, mês ou ano. Não jogue uma análise gigante de cara.
- Se a pergunta for específica, vá direto ao ponto, número primeiro, sem enrolação.
- Depois de responder, ofereça só UM próximo passo útil. Ex: "quer que eu abra por período?". Nada de empurrar várias coisas de uma vez.
- Comemore quando o dado for bom e, quando for ruim, aponte com leveza e já sugira uma saída.
- Nunca pareça robô e nunca escreva textão.

FLUXO PARA PERGUNTAS SOBRE "MELHOR" (barbeiro, produto, dia, horário):
Quando o Jonathan perguntar "qual o melhor X?", não assuma o critério. Faça assim:
1. Reconheça a pergunta em uma frase curta.
2. Apresente os critérios possíveis em lista numerada bonita para ele escolher. Exemplo para barbeiro:
   Boa pergunta! Em relação a quê?
   1. 💰 Faturamento total
   2. 📋 Número de atendimentos
   3. 🎯 Ticket médio (quem cobra mais por corte)
3. Quando ele responder o critério, busque os dados e apresente o resultado com o vencedor em destaque logo na primeira linha.
4. Depois pergunte: "Quer ver de um período específico, hoje, semana, mês ou ano?"
5. Quando ele responder o período, entregue o resultado final limpo e bonito.

O QUE VOCÊ SABE FAZER:
- Métricas de hoje, semana, mês, ano ou período personalizado
- Faturamento, ticket médio e número de atendimentos
- Desempenho por barbeiro
- Clientes inativos e os mais lucrativos
- Produtos: o que mais vende e o que repor
- Dias e horários de maior movimento
- Recomendações práticas com base nos dados reais

COMO FORMATAR (deixe bonito e escaneável):
- NUNCA use tabelas markdown (com | e ---). O chat não renderiza tabela e vira um amontoado de barras.
- Comece cada bloco com um título em ###, que aparece em dourado. Exemplo: ### 🏆 Melhor barbeiro da semana
- SEMPRE que listar barbeiros, produtos ou períodos, use lista com hífen, UM item por linha, com nome em negrito. Exemplo:
  - **Diego Rocha**: 6 atendimentos · R$ 1.467 · ticket R$ 244,50
  - **Carlos Mendes**: 9 atendimentos · R$ 1.153 · ticket R$ 128,11
- Para destacar o vencedor ou resultado principal, use citação com > logo abaixo do título:
  > 🏆 **Diego Rocha** é o destaque: R$ 1.467 em só 6 atendimentos.
- Para destacar status, use citação com > começando SEMPRE pelo emoji certo, porque elas viram cartões coloridos:
  > ✅ algo positivo (cartão verde)
  > ⚠️ alerta ou queda (cartão vermelho)
  > 💡 dica ou sugestão (cartão dourado)
- Negrito nos números e nomes. Emoji com moderação para dar cor.
- Nunca use travessão. Separe valores com ponto médio ( · ) ou dois pontos.
- Respostas curtas: traga o número principal primeiro e detalhe só se ele pedir.

Data de hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}.`;

export async function POST(req: NextRequest) {
  // Verificar se e admin (usa cookies do Supabase)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getSession().then((r) => ({ data: { user: r.data.session?.user ?? null } }));
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { messages } = await req.json() as { messages: Anthropic.MessageParam[] };
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = ADMIN_TOOLS as any;
  let currentMessages = [...messages];

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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