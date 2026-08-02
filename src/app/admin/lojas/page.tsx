/**
 * As unidades da rede.
 *
 * Enquanto houver uma so, a tela explica o que acontece quando a segunda
 * existir, em vez de mostrar uma lista de um item e deixar a pessoa adivinhar.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCanManage } from '@/lib/staff-auth';
import { lojaAtual } from '@/lib/loja';
import { formatCurrency } from '@/lib/utils';
import { ListaDeUnidades } from './_components/lista-de-unidades';

export const metadata = { title: 'Unidades' };
export const dynamic = 'force-dynamic';

export default async function LojasPage() {
  const staff = await requireCanManage();
  const admin = createAdminClient();
  const daVez = await lojaAtual();

  const { data: unidades } = await admin
    .from('barbershops')
    .select('id, name, slug, phone, address_city, address_state, address_neighborhood, address_street, address_number, active, created_at')
    .order('created_at');

  // Onde esta pessoa tem acesso: a lista mostra as outras, mas so deixa entrar
  // nas dela
  const { data: meusCadastros } = await admin
    .from('staff')
    .select('barbershop_id, can_manage')
    .eq('profile_id', staff.profileId)
    .eq('active', true)
    .is('fired_at', null);

  const minhas = new Set((meusCadastros ?? []).map((c) => c.barbershop_id as string));

  // Um retrato de cada unidade, para a lista dizer algo alem do nome
  const resumo = new Map<string, { equipe: number; clientes: number; mes: number }>();
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  for (const u of unidades ?? []) {
    const [{ count: equipe }, { count: clientes }, { data: comandas }] = await Promise.all([
      admin
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', u.id)
        .eq('active', true),
      admin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', u.id)
        .eq('active', true),
      admin
        .from('comandas')
        .select('total')
        .eq('barbershop_id', u.id)
        .eq('status', 'closed')
        .gte('closed_at', inicioDoMes.toISOString()),
    ]);

    resumo.set(u.id as string, {
      equipe: equipe ?? 0,
      clientes: clientes ?? 0,
      mes: (comandas ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0),
    });
  }

  const lista = (unidades ?? []).map((u) => {
    const r = resumo.get(u.id as string)!;
    return {
      id: u.id as string,
      nome: u.name as string,
      apelido: (u.slug as string) ?? null,
      telefone: (u.phone as string) ?? null,
      cidade: (u.address_city as string) ?? null,
      estado: (u.address_state as string) ?? null,
      bairro: (u.address_neighborhood as string) ?? null,
      rua: (u.address_street as string) ?? null,
      numero: (u.address_number as string) ?? null,
      aberta: u.active !== false,
      minha: minhas.has(u.id as string),
      atual: u.id === daVez,
      equipe: r.equipe,
      clientes: r.clientes,
      mesEmPalavras: formatCurrency(r.mes),
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-fg-dim">Rede</p>
        <h1
          className="text-3xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Unidades
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Cada unidade tem a própria agenda, o próprio caixa e a própria equipe. Os dados
          nunca se misturam.
        </p>
      </div>

      <div className="divider-gold" />

      <ListaDeUnidades unidades={lista} />
    </div>
  );
}
