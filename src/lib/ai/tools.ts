import { createAdminClient } from '@/lib/supabase/admin';
import { getAvailableSlots } from '@/lib/booking';
import { bookAppointment } from '@/app/cliente/actions';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
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
] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeClientTool(name: string, input: any, customerId: string): Promise<unknown> {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  switch (name) {
    case 'listar_servicos': {
      const { data } = await admin.from('services').select('id, name, description, base_price, base_duration_minutes, category').eq('barbershop_id', BARBERSHOP_ID).eq('active', true).order('category').order('name');
      return data ?? [];
    }
    case 'listar_barbeiros': {
      const { data } = await admin.from('staff').select('id, display_name, bio, avatar_url').eq('barbershop_id', BARBERSHOP_ID).eq('active', true).in('role', ['barber', 'owner', 'manager']).order('display_name');
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
      const { data } = await admin.from('products').select('id, name, description, price, stock_current, category').eq('barbershop_id', BARBERSHOP_ID).eq('active', true).order('name');
      return data ?? [];
    }
    case 'abrir_comanda_produto': {
      const { data: existing } = await admin.from('comandas').select('id').eq('customer_id', customerId).eq('status', 'open').eq('barbershop_id', BARBERSHOP_ID).maybeSingle();
      let comandaId = existing?.id;
      if (!comandaId) {
        const { data: newC } = await admin.from('comandas').insert({ barbershop_id: BARBERSHOP_ID, customer_id: customerId, status: 'open', subtotal: 0, total: 0, net_total: 0, opened_at: new Date().toISOString() }).select('id').single();
        comandaId = newC?.id;
      }
      if (!comandaId) return { ok: false, error: 'Não foi possível abrir a comanda' };
      const { data: prod } = await admin.from('products').select('id, name, price, stock_current').eq('id', input.product_id).maybeSingle();
      if (!prod || Number(prod.stock_current) <= 0) return { ok: false, error: 'Produto esgotado' };
      await admin.from('comanda_items').insert({ barbershop_id: BARBERSHOP_ID, comanda_id: comandaId, item_type: 'product', product_id: prod.id, unit_price: prod.price, quantity: 1, total_price: prod.price });
      await admin.from('products').update({ stock_current: Number(prod.stock_current) - 1 }).eq('id', prod.id);
      return { ok: true, product: prod.name, comanda_id: comandaId };
    }
    case 'dias_mais_tranquilos': {
      const fim = new Date(); fim.setDate(fim.getDate() + 7);
      const { data } = await admin.from('appointments').select('start_at').eq('barbershop_id', BARBERSHOP_ID).in('status', ['scheduled', 'completed']).gte('start_at', new Date().toISOString()).lte('start_at', fim.toISOString());
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
    case 'metricas_hoje': {
      const { data } = await admin.from('comandas').select('total').eq('barbershop_id', BARBERSHOP_ID).eq('status', 'closed').gte('closed_at', `${todayStr}T00:00:00-03:00`);
      const total = (data ?? []).reduce((s, c) => s + Number(c.total), 0);
      const qtd = data?.length ?? 0;
      return { faturamento_hoje: total, comandas_hoje: qtd, ticket_medio: qtd > 0 ? total / qtd : 0 };
    }
    case 'metricas_periodo': {
      const { data } = await admin.from('comandas').select('total').eq('barbershop_id', BARBERSHOP_ID).eq('status', 'closed').gte('closed_at', `${input.inicio}T00:00:00-03:00`).lte('closed_at', `${input.fim}T23:59:59-03:00`);
      const total = (data ?? []).reduce((s, c) => s + Number(c.total), 0);
      const qtd = data?.length ?? 0;
      return { periodo: `${input.inicio} a ${input.fim}`, faturamento: total, vendas: qtd, ticket_medio: qtd > 0 ? total / qtd : 0 };
    }
    case 'melhores_clientes': {
      const { data } = await admin.from('customers').select('full_name, total_spent, total_appointments').eq('barbershop_id', BARBERSHOP_ID).eq('active', true).order('total_spent', { ascending: false }).limit(Number(input.limite ?? 10));
      return data ?? [];
    }
    case 'produtos_mais_vendidos': {
      const { data: sold } = await admin.from('comanda_items').select('product_id, total_price, products:products (name)').eq('barbershop_id', BARBERSHOP_ID).eq('item_type', 'product');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byP: Record<string, { name: string; total: number; qty: number }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const i of (sold ?? []) as any[]) { const id = i.product_id; const n = i.products?.name ?? id; if (!byP[id]) byP[id] = { name: n, total: 0, qty: 0 }; byP[id].total += Number(i.total_price); byP[id].qty += 1; }
      const { data: ls } = await admin.from('products').select('name, stock_current, stock_minimum').eq('barbershop_id', BARBERSHOP_ID).eq('active', true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baixo = (ls ?? [] as any[]).filter((p: any) => Number(p.stock_current) <= Number(p.stock_minimum));
      return { mais_vendidos: Object.values(byP).sort((a, b) => b.total - a.total).slice(0, 10), estoque_baixo: baixo };
    }
    case 'agenda_hoje': {
      const { data } = await admin.from('appointments').select(`start_at, end_at, status, customers:customers (full_name, phone), staff:staff (display_name), appointment_services (services:services (name))`).eq('barbershop_id', BARBERSHOP_ID).gte('start_at', `${todayStr}T00:00:00-03:00`).lte('start_at', `${todayStr}T23:59:59-03:00`).order('start_at', { ascending: true });
      return data ?? [];
    }
    case 'dias_mais_movimentados': {
      const { data } = await admin.from('appointments').select('start_at').eq('barbershop_id', BARBERSHOP_ID).in('status', ['completed', 'scheduled']).gte('start_at', new Date(Date.now() - 60 * 86400000).toISOString());
      const byDow: Record<string, number> = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sab: 0 };
      const byHour: Record<string, number> = {};
      const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      for (const a of data ?? []) { const d = new Date(a.start_at); byDow[DOW[d.getDay()]] = (byDow[DOW[d.getDay()]] ?? 0) + 1; const h = `${String(d.getHours()).padStart(2, '0')}h`; byHour[h] = (byHour[h] ?? 0) + 1; }
      return { dias: Object.entries(byDow).sort((a, b) => b[1] - a[1]).slice(0, 3), horarios: Object.entries(byHour).sort((a, b) => b[1] - a[1]).slice(0, 3) };
    }
    case 'clientes_inativos': {
      const dias = Number(input.dias ?? 30);
      const corte = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
      const { data } = await admin.from('customers').select('full_name, phone, total_spent').eq('barbershop_id', BARBERSHOP_ID).eq('active', true).lt('updated_at', corte).order('total_spent', { ascending: false }).limit(20);
      return data ?? [];
    }
    case 'desempenho_barbeiros': {
      const { data } = await admin.from('comandas').select('staff_id, total, staff:staff (display_name)').eq('barbershop_id', BARBERSHOP_ID).eq('status', 'closed').gte('closed_at', `${input.inicio}T00:00:00-03:00`).lte('closed_at', `${input.fim}T23:59:59-03:00`);
      const byS: Record<string, { name: string; total: number; count: number }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of (data ?? []) as any[]) { const id = c.staff_id ?? 'sem'; const nm = (Array.isArray(c.staff) ? c.staff[0]?.display_name : c.staff?.display_name) ?? 'Sem barbeiro'; if (!byS[id]) byS[id] = { name: nm, total: 0, count: 0 }; byS[id].total += Number(c.total); byS[id].count += 1; }
      return Object.values(byS).sort((a, b) => b.total - a.total);
    }
    default: return { error: `Tool "${name}" não reconhecida` };
  }
}