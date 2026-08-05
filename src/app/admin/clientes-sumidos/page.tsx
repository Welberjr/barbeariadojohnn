import { UserMinus } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ritmoDoCliente,
  calcularAtraso,
  ordenarPorUrgencia,
  diasEntre,
  type ClienteSumido,
} from '@/lib/clientes-sumidos';
import { ClientesSumidosView } from './_components/clientes-sumidos-view';
import { lojaAtual } from '@/lib/loja';

export const metadata = { title: 'Clientes sumidos' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ dias?: string }>;
}

export default async function ClientesSumidosPage({ searchParams }: PageProps) {
  const { dias: diasParam } = await searchParams;
  const padraoDias = Number(diasParam) > 0 ? Number(diasParam) : 45;

  const admin = createAdminClient();
  const hoje = new Date();

  const [{ data: clientes }, { data: barbearia }] = await Promise.all([
    admin
      .from('customers')
      .select(
        'id, full_name, phone, last_visit_at, total_spent, total_appointments, reactivation_contacted_at, reactivation_notes'
      )
      .eq('barbershop_id', (await lojaAtual()))
      .eq('active', true)
      .limit(2000),
    admin.from('barbershops').select('name').eq('id', (await lojaAtual())).maybeSingle(),
  ]);

  // Historico de visitas para descobrir o ritmo de cada um.
  // Vem em blocos porque uma consulta simples traz no maximo mil linhas.
  //
  // A janela para em 18 meses de proposito: cliente parado ha mais de 18
  // meses ja apareceu nesta lista por meses seguidos, e visita mais antiga
  // que isso nao muda o ritmo de quem continua vindo. Varrer a historia
  // inteira so somava blocos de mil linhas sem mudar a resposta.
  const inicioDaJanela = new Date(hoje);
  inicioDaJanela.setMonth(inicioDaJanela.getMonth() - 18);

  const visitas: Array<{ customer_id: string; closed_at: string }> = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await admin
      .from('comandas')
      .select('customer_id, closed_at')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('status', 'closed')
      .not('customer_id', 'is', null)
      .gte('closed_at', inicioDaJanela.toISOString())
      .order('closed_at')
      .range(de, de + 999);

    visitas.push(...((data ?? []) as Array<{ customer_id: string; closed_at: string }>));
    if (!data || data.length < 1000) break;
  }

  const datasPorCliente = new Map<string, string[]>();
  for (const v of visitas) {
    if (!v.closed_at) continue;
    const atual = datasPorCliente.get(v.customer_id) ?? [];
    atual.push(v.closed_at.slice(0, 10));
    datasPorCliente.set(v.customer_id, atual);
  }

  // Serviço mais frequente de cada cliente, para a mensagem sair pessoal
  const servicoPorCliente = new Map<string, string>();
  const { data: itens } = await admin
    .from('comanda_items')
    .select('name, comanda:comandas!inner ( customer_id, status )')
    .eq('barbershop_id', (await lojaAtual()))
    .eq('item_type', 'service')
    .eq('comanda.status', 'closed')
    .limit(2000);

  const contagem = new Map<string, Map<string, number>>();
  for (const item of itens ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cid = (item.comanda as any)?.customer_id as string | undefined;
    if (!cid) continue;
    const nome = (item.name as string).replace(' (Assinatura)', '');
    const doCliente = contagem.get(cid) ?? new Map<string, number>();
    doCliente.set(nome, (doCliente.get(nome) ?? 0) + 1);
    contagem.set(cid, doCliente);
  }
  for (const [cid, mapa] of contagem) {
    const top = [...mapa.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) servicoPorCliente.set(cid, top[0]);
  }

  const lista: ClienteSumido[] = [];

  for (const c of clientes ?? []) {
    const ultima = (c.last_visit_at as string) ?? null;
    if (!ultima) continue; // quem nunca veio nao e um cliente que sumiu

    const diasSemVir = diasEntre(ultima, hoje);
    const ritmo = ritmoDoCliente(datasPorCliente.get(c.id as string) ?? []);
    const atraso = calcularAtraso(diasSemVir, ritmo, padraoDias);

    // Sumido e quem passou do proprio ritmo, com uma folga de meio ciclo
    if (atraso < 1.5) continue;

    lista.push({
      id: c.id as string,
      nome: (c.full_name as string) ?? 'Cliente',
      telefone: (c.phone as string) ?? null,
      ultimaVisita: ultima,
      diasSemVir,
      ritmoDias: ritmo,
      atraso,
      visitas: Number(c.total_appointments ?? 0),
      totalGasto: Number(c.total_spent ?? 0),
      servicoHabitual: servicoPorCliente.get(c.id as string) ?? null,
      contatadoEm: (c.reactivation_contacted_at as string) ?? null,
    });
  }

  const ordenada = ordenarPorUrgencia(lista);
  const aChamar = ordenada.filter((c) => !c.contatadoEm);
  const valorParado = aChamar.reduce((s, c) => s + c.totalGasto, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Marketing</p>
        <h1
          className="text-3xl text-fg font-bold flex items-center gap-3"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <UserMinus className="w-7 h-7 text-gold" />
          Clientes sumidos
        </h1>
        <p className="text-sm text-fg-muted mt-2">
          Quem era cliente e parou de voltar. A lista compara cada um com o ritmo dele: quem vinha
          toda semana e sumiu há um mês aparece antes de quem vinha de três em três meses.
        </p>
      </div>

      <ClientesSumidosView
        clientes={ordenada}
        nomeBarbearia={(barbearia?.name as string) ?? 'Barbearia do Johnn'}
        padraoDias={padraoDias}
        totalAChamar={aChamar.length}
        valorParado={valorParado}
      />
    </div>
  );
}
