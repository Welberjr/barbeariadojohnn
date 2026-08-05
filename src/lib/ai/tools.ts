import { createAdminClient } from '@/lib/supabase/admin';
import { getAvailableSlots } from '@/lib/booking';
import { lojaAtual } from '@/lib/loja';
import { bookAppointment } from '@/app/cliente/actions';
const admin = createAdminClient();

export const CLIENT_TOOLS = [
  { name: 'listar_servicos', description: 'Lista todos os serviços disponíveis com nome, preço e duração em minutos.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'listar_barbeiros', description: 'Lista os barbeiros ativos com nome e avatar_url (foto).', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'verificar_disponibilidade', description: 'Retorna horários livres de um barbeiro em uma data para um serviço específico.', input_schema: { type: 'object' as const, properties: { staff_id: { type: 'string' }, service_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['staff_id', 'service_id', 'date'] } },
  { name: 'criar_agendamento', description: 'Cria agendamento para o cliente logado. Só chamar após confirmação explícita do cliente.', input_schema: { type: 'object' as const, properties: { service_id: { type: 'string' }, staff_id: { type: 'string' }, start_iso: { type: 'string' } }, required: ['service_id', 'staff_id', 'start_iso'] } },
  { name: 'listar_agendamentos_cliente', description: 'Lista os próximos agendamentos do cliente logado.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'cancelar_agendamento', description: 'Cancela agendamento do cliente. Só chamar após confirmação explícita.', input_schema: { type: 'object' as const, properties: { appointment_id: { type: 'string' } }, required: ['appointment_id'] } },
  { name: 'listar_produtos', description: 'Lista os produtos disponíveis na loja da barbearia.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'abrir_comanda_produto', description: 'Reserva um produto para o cliente na comanda. Só chamar após confirmação explícita.', input_schema: { type: 'object' as const, properties: { product_id: { type: 'string' }, customer_id: { type: 'string' } }, required: ['product_id', 'customer_id'] } },
  { name: 'dias_mais_tranquilos', description: 'Retorna dias e horários com menos movimento para quem quer evitar fila.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
] as const;

export const ADMIN_TOOLS = [
  { name: 'metricas_hoje', description: 'Faturamento, número de atendimentos e ticket médio de hoje.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'metricas_periodo', description: 'Métricas financeiras de um período.', input_schema: { type: 'object' as const, properties: { inicio: { type: 'string' }, fim: { type: 'string' } }, required: ['inicio', 'fim'] } },
  { name: 'melhores_clientes', description: 'Clientes que mais gastaram na barbearia.', input_schema: { type: 'object' as const, properties: { limite: { type: 'number' } }, required: [] } },
  { name: 'produtos_mais_vendidos', description: 'Produtos mais vendidos e os com estoque baixo.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'agenda_hoje', description: 'Todos os agendamentos de hoje com horário e cliente.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'dias_mais_movimentados', description: 'Quais dias da semana e horários têm mais movimento (últimos 60 dias).', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'clientes_inativos', description: 'Clientes que não vêm há mais de X dias.', input_schema: { type: 'object' as const, properties: { dias: { type: 'number' } }, required: [] } },
  { name: 'desempenho_barbeiros', description: 'Faturamento e atendimentos por barbeiro em um período.', input_schema: { type: 'object' as const, properties: { inicio: { type: 'string' }, fim: { type: 'string' } }, required: ['inicio', 'fim'] } },
  // Ferramentas de ação que o prompt do chat admin sempre prometeu. As
  // implementações moravam por engano na função do CLIENTE e o admin não as
  // enxergava: a Lara prometia agendar e não tinha como cumprir. A rota do chat
  // admin exige acesso de gestão antes de chegar aqui, então executar com a
  // credencial de serviço é aceitável.
  { name: 'listar_servicos_admin', description: 'Lista os serviços ativos com nome, preço e duração.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'listar_barbeiros_admin', description: 'Lista os barbeiros ativos.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'buscar_cliente', description: 'Busca cliente por nome ou telefone. Retorna até 5 resultados.', input_schema: { type: 'object' as const, properties: { q: { type: 'string', description: 'Nome ou telefone do cliente' } }, required: ['q'] } },
  { name: 'consultar_agendamentos', description: 'Consulta agendamentos por data, barbeiro, cliente ou status.', input_schema: { type: 'object' as const, properties: { data: { type: 'string', description: 'YYYY-MM-DD' }, staff_id: { type: 'string' }, customer_id: { type: 'string' }, status: { type: 'string' } }, required: [] } },
  { name: 'verificar_disponibilidade_admin', description: 'Retorna horários livres de um barbeiro em uma data para um serviço.', input_schema: { type: 'object' as const, properties: { staff_id: { type: 'string' }, service_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['staff_id', 'service_id', 'date'] } },
  { name: 'criar_agendamento_admin', description: 'Cria agendamento para um cliente. Só chamar após confirmação explícita do gestor.', input_schema: { type: 'object' as const, properties: { customer_id: { type: 'string' }, staff_id: { type: 'string' }, service_id: { type: 'string' }, start_iso: { type: 'string' } }, required: ['customer_id', 'staff_id', 'service_id', 'start_iso'] } },
  { name: 'cancelar_agendamento_admin', description: 'Cancela um agendamento. Só chamar após confirmação explícita.', input_schema: { type: 'object' as const, properties: { appointment_id: { type: 'string' } }, required: ['appointment_id'] } },
  { name: 'remarcar_agendamento', description: 'Muda o horário de um agendamento. Só chamar após confirmação explícita.', input_schema: { type: 'object' as const, properties: { appointment_id: { type: 'string' }, new_start_iso: { type: 'string' } }, required: ['appointment_id', 'new_start_iso'] } },
  { name: 'abrir_comanda_admin', description: 'Abre uma comanda para um cliente, ou reaproveita a que já estiver aberta.', input_schema: { type: 'object' as const, properties: { customer_id: { type: 'string' }, staff_id: { type: 'string' } }, required: ['customer_id'] } },
  { name: 'lancar_produto_comanda', description: 'Lança um produto em uma comanda aberta. Só chamar após confirmação explícita.', input_schema: { type: 'object' as const, properties: { comanda_id: { type: 'string' }, product_id: { type: 'string' }, quantity: { type: 'number' } }, required: ['comanda_id', 'product_id'] } },
  { name: 'fechar_comanda', description: 'Fecha a comanda informando a forma de pagamento. Só chamar após confirmação explícita.', input_schema: { type: 'object' as const, properties: { comanda_id: { type: 'string' }, payment_method: { type: 'string' } }, required: ['comanda_id', 'payment_method'] } },
] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeClientTool(name: string, input: any, customerId: string): Promise<unknown> {
  switch (name) {
    case 'listar_servicos': {
      const { data } = await admin.from('services').select('id, name, description, base_price, base_duration_minutes, category').eq('barbershop_id', (await lojaAtual())).eq('active', true).order('category').order('name');
      return data ?? [];
    }
    case 'listar_barbeiros': {
      const { data } = await admin.from('staff').select('id, display_name, bio, photo_url').eq('barbershop_id', (await lojaAtual())).eq('active', true).order('display_name');
      return data ?? [];
    }
    case 'verificar_disponibilidade': {
      return getAvailableSlots({ staffId: input.staff_id, serviceId: input.service_id, dateStr: input.date });
    }
    case 'criar_agendamento': {
      return bookAppointment({ service_id: input.service_id, staff_id: input.staff_id, startISO: input.start_iso });
    }
    case 'listar_agendamentos_cliente': {
      const { data } = await admin.from('appointments').select(`id, start_at, end_at, status, staff:staff (display_name), appointment_services (services:services (name))`).eq('customer_id', customerId).in('status', ['scheduled']).gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(5);
      return data ?? [];
    }
    case 'cancelar_agendamento': {
      const { error } = await admin.from('appointments').update({ status: 'cancelled' }).eq('id', input.appointment_id).eq('customer_id', customerId);
      return { ok: !error, error: error?.message };
    }
    case 'listar_produtos': {
      const { data } = await admin.from('products').select('id, name, description, sale_price, stock_current, brand').eq('barbershop_id', (await lojaAtual())).eq('active', true).gt('stock_current', 0).order('name');
      return data ?? [];
    }
    case 'abrir_comanda_produto': {
      const { data: existing } = await admin.from('comandas').select('id').eq('customer_id', customerId).eq('status', 'open').eq('barbershop_id', (await lojaAtual())).maybeSingle();
      let comandaId = existing?.id;
      if (!comandaId) {
        const { data: newC } = await admin.from('comandas').insert({ barbershop_id: (await lojaAtual()), customer_id: customerId, status: 'open', subtotal: 0, total: 0, net_total: 0, opened_at: new Date().toISOString() }).select('id').single();
        comandaId = newC?.id;
      }
      if (!comandaId) return { ok: false, error: 'Não foi possível abrir a comanda' };
      const { data: prod } = await admin.from('products').select('id, name, sale_price, stock_current').eq('id', input.product_id).maybeSingle();
      if (!prod || Number(prod.stock_current) <= 0) return { ok: false, error: 'Produto esgotado' };
      await admin.from('comanda_items').insert({ barbershop_id: (await lojaAtual()), comanda_id: comandaId, item_type: 'product', product_id: prod.id, unit_price: prod.sale_price, quantity: 1, total_price: prod.sale_price });
      await admin.from('products').update({ stock_current: Number(prod.stock_current) - 1 }).eq('id', prod.id);
      return { ok: true, product: prod.name, comanda_id: comandaId };
    }
    case 'dias_mais_tranquilos': {
      const fim = new Date(); fim.setDate(fim.getDate() + 7);
      const { data } = await admin.from('appointments').select('start_at').eq('barbershop_id', (await lojaAtual())).in('status', ['scheduled', 'completed']).gte('start_at', new Date().toISOString()).lte('start_at', fim.toISOString());
      const byDay: Record<string, number> = {};
      for (const a of data ?? []) { const d = new Date(a.start_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }); byDay[d] = (byDay[d] ?? 0) + 1; }
      const sorted = Object.entries(byDay).sort((a, b) => a[1] - b[1]);
      return { mais_tranquilos: sorted.slice(0, 3), mais_movimentados: sorted.slice(-2) };
    }
    default: return { error: `Tool "${name}" não reconhecida` };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeAdminTool(name: string, input: any): Promise<unknown> {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  switch (name) {
    case 'listar_servicos_admin': {
      const { data } = await admin.from('services').select('id, name, base_price, base_duration_minutes, category').eq('barbershop_id', (await lojaAtual())).eq('active', true).order('name');
      return data ?? [];
    }
    case 'listar_barbeiros_admin': {
      const { data } = await admin.from('staff').select('id, display_name').eq('barbershop_id', (await lojaAtual())).eq('active', true).order('display_name');
      return data ?? [];
    }
    case 'buscar_cliente': {
      // O termo vem do modelo e entrava cru na expressão do .or() do PostgREST.
      // Vírgula, parênteses e porcentagem fazem parte da sintaxe do filtro, e
      // um texto malicioso repassado pelo modelo mudaria a consulta inteira.
      // Aqui esses caracteres caem fora antes de o filtro ser montado, e o
      // termo é limitado a 60 caracteres.
      const q = String(input.q ?? '').replace(/[,()%]/g, '').trim().slice(0, 60);
      if (!q) return [];
      const { data } = await admin.from('customers').select('id, full_name, phone, total_spent, total_appointments').eq('barbershop_id', (await lojaAtual())).eq('active', true).or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).order('full_name').limit(5);
      return data ?? [];
    }
    case 'consultar_agendamentos': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = admin.from('appointments').select(`id, start_at, end_at, status, customers:customers (full_name, phone), staff:staff (display_name), appointment_services (services:services (name))`).eq('barbershop_id', (await lojaAtual()));
      if (input.data) q = q.gte('start_at', `${input.data}T00:00:00-03:00`).lte('start_at', `${input.data}T23:59:59-03:00`);
      if (input.staff_id) q = q.eq('staff_id', input.staff_id);
      if (input.customer_id) q = q.eq('customer_id', input.customer_id);
      if (input.status) q = q.eq('status', input.status); else q = q.in('status', ['scheduled', 'completed', 'cancelled']);
      const { data } = await q.order('start_at', { ascending: true }).limit(20);
      return data ?? [];
    }
    case 'verificar_disponibilidade_admin': {
      return getAvailableSlots({ staffId: input.staff_id, serviceId: input.service_id, dateStr: input.date });
    }
    case 'criar_agendamento_admin': {
      const startDt = new Date(input.start_iso);
      const { data: svc } = await admin.from('services').select('base_duration_minutes').eq('id', input.service_id).single();
      const endDt = new Date(startDt.getTime() + (svc?.base_duration_minutes ?? 30) * 60000);
      const { data: appt, error } = await admin.from('appointments').insert({ barbershop_id: (await lojaAtual()), customer_id: input.customer_id, staff_id: input.staff_id, start_at: startDt.toISOString(), end_at: endDt.toISOString(), status: 'scheduled' }).select('id').single();
      if (error) return { ok: false, error: error.message };
      if (appt?.id) await admin.from('appointment_services').insert({ appointment_id: appt.id, service_id: input.service_id, barbershop_id: (await lojaAtual()) });
      return { ok: true, appointment_id: appt?.id };
    }
    case 'cancelar_agendamento_admin': {
      const { error } = await admin.from('appointments').update({ status: 'cancelled' }).eq('id', input.appointment_id).eq('barbershop_id', (await lojaAtual()));
      return { ok: !error, error: error?.message };
    }
    case 'remarcar_agendamento': {
      const newStart = new Date(input.new_start_iso);
      const { data: appt } = await admin.from('appointments').select('appointment_services (service_id, services:services (base_duration_minutes))').eq('id', input.appointment_id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dur = (appt as any)?.appointment_services?.[0]?.services?.base_duration_minutes ?? 30;
      const newEnd = new Date(newStart.getTime() + dur * 60000);
      const { error } = await admin.from('appointments').update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString(), status: 'scheduled' }).eq('id', input.appointment_id).eq('barbershop_id', (await lojaAtual()));
      return { ok: !error, error: error?.message };
    }
    case 'abrir_comanda_admin': {
      const { data: existing } = await admin.from('comandas').select('id, subtotal, total').eq('customer_id', input.customer_id).eq('status', 'open').eq('barbershop_id', (await lojaAtual())).maybeSingle();
      if (existing) return { ok: true, comanda_id: existing.id, reaproveitada: true, subtotal: existing.subtotal, total: existing.total };
      const { data: newC, error } = await admin.from('comandas').insert({ barbershop_id: (await lojaAtual()), customer_id: input.customer_id, staff_id: input.staff_id ?? null, status: 'open', subtotal: 0, total: 0, net_total: 0, opened_at: new Date().toISOString() }).select('id').single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, comanda_id: newC?.id, reaproveitada: false };
    }
    case 'lancar_produto_comanda': {
      const qty = Number(input.quantity ?? 1);
      const { data: prod } = await admin.from('products').select('id, name, sale_price, stock_current').eq('id', input.product_id).maybeSingle();
      if (!prod || Number(prod.stock_current) < qty) return { ok: false, error: 'Produto esgotado ou estoque insuficiente' };
      const total = Number(prod.sale_price) * qty;
      const { error } = await admin.from('comanda_items').insert({ barbershop_id: (await lojaAtual()), comanda_id: input.comanda_id, item_type: 'product', product_id: prod.id, unit_price: prod.sale_price, quantity: qty, total_price: total });
      if (error) return { ok: false, error: error.message };
      await admin.from('products').update({ stock_current: Number(prod.stock_current) - qty }).eq('id', prod.id);
      const { data: items } = await admin.from('comanda_items').select('total_price').eq('comanda_id', input.comanda_id);
      const subtotal = (items ?? []).reduce((s, i) => s + Number(i.total_price), 0);
      await admin.from('comandas').update({ subtotal, total: subtotal, net_total: subtotal }).eq('id', input.comanda_id);
      return { ok: true, product: prod.name, qty, total_item: total, comanda_subtotal: subtotal };
    }
    case 'fechar_comanda': {
      const { data: items } = await admin.from('comanda_items').select('total_price').eq('comanda_id', input.comanda_id);
      const total = (items ?? []).reduce((s, i) => s + Number(i.total_price), 0);
      const { error } = await admin.from('comandas').update({ status: 'closed', total, net_total: total, subtotal: total, payment_method: input.payment_method, closed_at: new Date().toISOString() }).eq('id', input.comanda_id).eq('barbershop_id', (await lojaAtual()));
      return { ok: !error, total, error: error?.message };
    }
    case 'metricas_hoje': {
      const { data } = await admin.from('comandas').select('total').eq('barbershop_id', (await lojaAtual())).eq('status', 'closed').gte('closed_at', `${todayStr}T00:00:00-03:00`);
      const total = (data ?? []).reduce((s, c) => s + Number(c.total), 0);
      const qtd = data?.length ?? 0;
      return { faturamento_hoje: total, comandas_hoje: qtd, ticket_medio: qtd > 0 ? total / qtd : 0 };
    }
    case 'metricas_periodo': {
      const { data } = await admin.from('comandas').select('total').eq('barbershop_id', (await lojaAtual())).eq('status', 'closed').gte('closed_at', `${input.inicio}T00:00:00-03:00`).lte('closed_at', `${input.fim}T23:59:59-03:00`);
      const total = (data ?? []).reduce((s, c) => s + Number(c.total), 0);
      const qtd = data?.length ?? 0;
      return { periodo: `${input.inicio} a ${input.fim}`, faturamento: total, vendas: qtd, ticket_medio: qtd > 0 ? total / qtd : 0 };
    }
    case 'melhores_clientes': {
      const { data } = await admin.from('customers').select('full_name, total_spent, total_appointments').eq('barbershop_id', (await lojaAtual())).eq('active', true).order('total_spent', { ascending: false }).limit(Number(input.limite ?? 10));
      return data ?? [];
    }
    case 'produtos_mais_vendidos': {
      const { data: sold } = await admin.from('comanda_items').select('product_id, total_price, products:products (name)').eq('barbershop_id', (await lojaAtual())).eq('item_type', 'product');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byP: Record<string, { name: string; total: number; qty: number }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const i of (sold ?? []) as any[]) { const id = i.product_id; const n = i.products?.name ?? id; if (!byP[id]) byP[id] = { name: n, total: 0, qty: 0 }; byP[id].total += Number(i.total_price); byP[id].qty += 1; }
      const { data: ls } = await admin.from('products').select('name, stock_current, stock_minimum').eq('barbershop_id', (await lojaAtual())).eq('active', true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baixo = (ls ?? [] as any[]).filter((p: any) => Number(p.stock_current) <= Number(p.stock_minimum));
      return { mais_vendidos: Object.values(byP).sort((a, b) => b.total - a.total).slice(0, 10), estoque_baixo: baixo };
    }
    case 'agenda_hoje': {
      const { data } = await admin.from('appointments').select(`start_at, end_at, status, customers:customers (full_name, phone), staff:staff (display_name), appointment_services (services:services (name))`).eq('barbershop_id', (await lojaAtual())).gte('start_at', `${todayStr}T00:00:00-03:00`).lte('start_at', `${todayStr}T23:59:59-03:00`).order('start_at', { ascending: true });
      return data ?? [];
    }
    case 'dias_mais_movimentados': {
      const { data } = await admin.from('appointments').select('start_at').eq('barbershop_id', (await lojaAtual())).in('status', ['completed', 'scheduled']).gte('start_at', new Date(Date.now() - 60 * 86400000).toISOString());
      const byDow: Record<string, number> = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sab: 0 };
      const byHour: Record<string, number> = {};
      const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      for (const a of data ?? []) { const d = new Date(a.start_at); byDow[DOW[d.getDay()]] = (byDow[DOW[d.getDay()]] ?? 0) + 1; const h = `${String(d.getHours()).padStart(2, '0')}h`; byHour[h] = (byHour[h] ?? 0) + 1; }
      return { dias: Object.entries(byDow).sort((a, b) => b[1] - a[1]).slice(0, 3), horarios: Object.entries(byHour).sort((a, b) => b[1] - a[1]).slice(0, 3) };
    }
    case 'clientes_inativos': {
      const dias = Number(input.dias ?? 30);
      const corte = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
      const { data } = await admin.from('customers').select('full_name, phone, total_spent').eq('barbershop_id', (await lojaAtual())).eq('active', true).lt('updated_at', corte).order('total_spent', { ascending: false }).limit(20);
      return data ?? [];
    }
    case 'desempenho_barbeiros': {
      const { data } = await admin.from('comandas').select('staff_id, total, staff:staff (display_name)').eq('barbershop_id', (await lojaAtual())).eq('status', 'closed').gte('closed_at', `${input.inicio}T00:00:00-03:00`).lte('closed_at', `${input.fim}T23:59:59-03:00`);
      const byS: Record<string, { name: string; total: number; count: number }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of (data ?? []) as any[]) { const id = c.staff_id ?? 'sem'; const nm = (Array.isArray(c.staff) ? c.staff[0]?.display_name : c.staff?.display_name) ?? 'Sem barbeiro'; if (!byS[id]) byS[id] = { name: nm, total: 0, count: 0 }; byS[id].total += Number(c.total); byS[id].count += 1; }
      return Object.values(byS).sort((a, b) => b.total - a.total);
    }
    default: return { error: `Tool "${name}" não reconhecida` };
  }
}