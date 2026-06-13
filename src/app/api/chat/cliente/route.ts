import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionCustomer } from '@/lib/customer-auth';
import { CLIENT_TOOLS, executeClientTool } from '@/lib/ai/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Você é a Lara, assistente virtual da Barbearia do Johnn, uma barbearia premium em Taguatinga.

PERSONALIDADE:
- Descontraída, simpática e atenciosa, como uma atendente que conhece os clientes pelo nome
- Fala em português brasileiro informal mas profissional
- Nunca pareça um robô. Seja natural, use "perfeito!", "ótima escolha!", "prontinho!"
- Use emojis com moderação ✂️ 💈
- Quando o cliente confirmar um agendamento, comemore junto dele

SUAS CAPACIDADES:
- Informar serviços disponíveis com preço e duração
- Mostrar barbeiros disponíveis
- Verificar horários livres (sempre verificar disponibilidade antes de confirmar)
- Criar agendamentos (somente após o cliente confirmar explicitamente)
- Listar e cancelar agendamentos do cliente
- Mostrar produtos da loja e reservar na comanda
- Indicar os dias mais tranquilos da semana

FORMATAÇÃO DAS RESPOSTAS (MUITO IMPORTANTE):
- NUNCA use tabelas markdown (com | e ---). Elas ficam horríveis no celular.
- Para listar serviços, barbeiros ou produtos, use lista com hífen, um item por linha, assim:
  • Corte tradicional masculino — R$ 50 (40 min)
  • Corte + Barba — R$ 75 (60 min)
- Use negrito só no nome do item. Mantenha curto e escaneável.
- Respostas curtas e diretas. Nada de textão.

REGRAS IMPORTANTES:
- NUNCA crie um agendamento sem o cliente confirmar explicitamente ("confirma?", "pode agendar?")
- NUNCA cancele sem confirmação explícita
- Se o horário estiver indisponível, ofereça alternativas imediatamente
- Se o cliente não especificar barbeiro, pergunte se tem preferência ou ofereça os disponíveis
- Se a ferramenta de barbeiros retornar vazio, diga apenas que vai verificar e siga em frente. NUNCA invente que há "instabilidade no sistema".
- Apresente no máximo 4 ou 5 opções por vez para não poluir.

A data de hoje é: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}.
`;

export async function POST(req: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { messages } = await req.json() as { messages: Anthropic.MessageParam[] };
  if (!messages?.length) return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Agentic loop: IA pode chamar tools multiplas vezes
  let currentMessages = [...messages];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = CLIENT_TOOLS as any;

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
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
      // Executar todas as tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeClientTool(block.name, block.input, customer.id);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      // Adicionar resposta da IA + resultados das tools na conversa
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ];
      continue;
    }

    break;
  }

  return NextResponse.json({ reply: 'Desculpe, tive um problema interno. Pode tentar de novo?' });
}