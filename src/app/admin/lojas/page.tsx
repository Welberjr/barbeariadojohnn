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
  // A guarda e a loja da vez compartilham a mesma sessao memoizada, entao
  // resolver as duas juntas nao repete nenhuma ida ao banco.
  const [staff, daVez] = await Promise.all([requireCanManage(), lojaAtual()]);
  const admin = createAdminClient();

  // As duas listas nao dependem uma da outra: vao juntas ao banco.
  // A segunda e onde esta pessoa tem acesso: a lista mostra as outras, mas so
  // deixa entrar nas dela.
  const [{ data: unidades }, { data: meusCadastros }] = await Promise.all([
    admin
      .from('barbershops')
      .select('id, name, slug, phone, address_city, address_state, address_neighborhood, address_street, address_number, active, created_at')
      .order('created_at'),
    admin
      .from('staff')
      .select('barbershop_id, can_manage')
      .eq('profile_id', staff.profileId)
      .eq('active', true)
      .is('fired_at', null),
  ]);

  const minhas = new Set(
    (meusCadastros ?? [])
      .filter((cadastro) => cadastro.can_manage === true)
      .map((cadastro) => cadastro.barbershop_id as string)
  );
  // Gestor de uma unidade não recebe dados, clientes ou faturamento das
  // demais. O proprietário continua vendo todas em que possui gestão.
  const unidadesVisiveis = (unidades ?? []).filter((unidade) =>
    minhas.has(unidade.id as string)
  );

  // Um retrato de cada unidade, para a lista dizer algo alem do nome.
  // Tres consultas para a rede inteira em vez de tres por unidade: o banco
  // responde uma vez cada pergunta e a separacao por loja acontece aqui.
  const resumo = new Map<string, { equipe: number; clientes: number; mes: number }>();
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const idsVisiveis = unidadesVisiveis.map((u) => u.id as string);
  for (const id of idsVisiveis) resumo.set(id, { equipe: 0, clientes: 0, mes: 0 });

  if (idsVisiveis.length > 0) {
    const [{ data: equipeRows }, { data: clienteRows }, { data: comandasRows }] =
      await Promise.all([
        admin
          .from('staff')
          .select('barbershop_id')
          .in('barbershop_id', idsVisiveis)
          .eq('active', true),
        admin
          .from('customers')
          .select('barbershop_id')
          .in('barbershop_id', idsVisiveis)
          .eq('active', true),
        admin
          .from('comandas')
          .select('barbershop_id, total')
          .in('barbershop_id', idsVisiveis)
          .eq('status', 'closed')
          .gte('closed_at', inicioDoMes.toISOString()),
      ]);

    for (const r of equipeRows ?? []) {
      const dela = resumo.get(r.barbershop_id as string);
      if (dela) dela.equipe += 1;
    }
    for (const r of clienteRows ?? []) {
      const dela = resumo.get(r.barbershop_id as string);
      if (dela) dela.clientes += 1;
    }
    for (const r of comandasRows ?? []) {
      const dela = resumo.get(r.barbershop_id as string);
      if (dela) dela.mes += Number(r.total ?? 0);
    }
  }

  const lista = unidadesVisiveis.map((u) => {
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
