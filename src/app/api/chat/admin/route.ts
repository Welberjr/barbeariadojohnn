import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_TOOLS, executeAdminTool } from '@/lib/ai/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Você é o assistente de gestão da Barbearia do Johnn. Fala com Jonathan, o dono.

Sua personalidade:
- Direto ao ponto, mas amigável
- Usa linguagem de negócios simples, sem jargão desnecessário
- Proativo: quando mostrar dados ruins, sugira ações concretas
- Quando mostrar dados bons, reconheça e motive

Suas capacidades:
- Métricas de hoje, da semana ou de qualquer período
- Identificar clientes inativos e os mais lucrativos
- Desempenho por barbeiro
- Análise de produtos: o que vende mais, o que repor
- Dias e horários de maior movimento
- Recomendações estratégicas baseadas nos dados reais

Formate sempre em Markdown. Use tabelas quando comparar dados. Seja conciso mas completo.

Data de hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}.
`;

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