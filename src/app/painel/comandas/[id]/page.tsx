import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireStaff } from '@/lib/staff-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { assinaturasPorCliente } from '@/lib/painel/dados';
import { lojaAtual } from '@/lib/loja';
import { montarSelo } from '@/lib/painel/assinatura-selo';
import { saldoDeCredito } from '@/lib/creditos-db';
import { ComandaDetalhe } from './_components/comanda-detalhe';

export const metadata = { title: 'Comanda' };
export const dynamic = 'force-dynamic';

interface ComandaPageProps {
  params: Promise<{ id: string }>;
}

export default async function ComandaPainelPage({ params }: ComandaPageProps) {
  const { id } = await params;
  const staff = await requireStaff('comanda');
  const admin = createAdminClient();

  // Guarda de dono já na leitura: comanda de outro simplesmente não existe aqui
  const { data: comanda } = await admin
    .from('comandas')
    .select('id, status, subtotal, customer_id, closed_at, customers:customers ( full_name )')
    .eq('id', id)
    .eq('staff_id', staff.staffId)
    .maybeSingle();

  if (!comanda) notFound();

  const [{ data: itens }, { data: servicos }, { data: produtos }, { data: taxas }] =
    await Promise.all([
      admin
        .from('comanda_items')
        .select('id, name, item_type, quantity, total_price, staff_id, subscription_usage_id')
        .eq('comanda_id', id)
        .order('created_at'),
      admin
        .from('services')
        .select('id, name, base_price')
        .eq('barbershop_id', (await lojaAtual()))
        .eq('active', true)
        .order('name'),
      admin
        .from('products')
        .select('id, name, sale_price, stock_current')
        .eq('barbershop_id', (await lojaAtual()))
        .eq('active', true)
        .eq('is_sellable', true)
        .gt('stock_current', 0)
        .order('name'),
      admin
        .from('barbershops')
        .select('credit_fee_percent, debit_fee_percent')
        .eq('id', (await lojaAtual()))
        .maybeSingle(),
    ]);

  const [assinaturas, creditoDisponivel] = comanda.customer_id
    ? await Promise.all([
        assinaturasPorCliente([comanda.customer_id as string]),
        saldoDeCredito(comanda.customer_id as string),
      ])
    : [new Map(), 0];

  const selo = montarSelo(
    comanda.customer_id ? assinaturas.get(comanda.customer_id as string) ?? null : null,
    new Date()
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cliente = comanda.customers as any;
  const subtotal = (itens ?? []).reduce((s, i) => s + Number(i.total_price ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href="/painel/comandas"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para comandas</span>
      </Link>

      <ComandaDetalhe
        comandaId={comanda.id as string}
        cliente={cliente?.full_name ?? 'Cliente'}
        aberta={comanda.status === 'open'}
        cancelada={comanda.status === 'cancelled'}
        fechadaEm={(comanda.closed_at as string) ?? null}
        subtotal={subtotal}
        selo={selo}
        taxaCredito={Number(taxas?.credit_fee_percent ?? 0)}
        taxaDebito={Number(taxas?.debit_fee_percent ?? 0)}
        creditoDisponivel={creditoDisponivel}
        itens={(itens ?? []).map((i) => ({
          id: i.id as string,
          nome: i.name as string,
          tipo: i.item_type as string,
          quantidade: Number(i.quantity ?? 1),
          total: Number(i.total_price ?? 0),
          coberto: !!i.subscription_usage_id,
          meu: i.staff_id === staff.staffId,
        }))}
        servicos={(servicos ?? []).map((s) => ({
          id: s.id as string,
          nome: s.name as string,
          preco: Number(s.base_price ?? 0),
        }))}
        produtos={(produtos ?? []).map((p) => ({
          id: p.id as string,
          nome: p.name as string,
          preco: Number(p.sale_price ?? 0),
        }))}
      />
    </div>
  );
}
