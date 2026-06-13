import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag, Package, ChevronLeft, Tag } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Loja' };
export const dynamic = 'force-dynamic';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export default async function LojaPage() {
  await requireCustomer();
  const admin = createAdminClient();

  // Buscar produtos com join na tabela de categorias
  const [{ data: products }, { data: categories }] = await Promise.all([
    admin
      .from('products')
      .select('id, name, description, sale_price, stock_current, stock_minimum, category_id, image_url, active, brand')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true)
      .order('name'),
    admin
      .from('product_categories')
      .select('id, name')
      .eq('barbershop_id', BARBERSHOP_ID)
      .order('name'),
  ]);

  const catMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

  // Disponiveis primeiro, esgotados por ultimo
  const all = (products ?? []).sort((a, b) => {
    const aOk = Number(a.stock_current) > 0 ? 0 : 1;
    const bOk = Number(b.stock_current) > 0 ? 0 : 1;
    return aOk - bOk;
  });

  // Agrupar por categoria
  const byCategory: Record<string, typeof all> = {};
  for (const p of all) {
    const cat = catMap.get(p.category_id ?? '') ?? 'Outros';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Link href="/cliente" className="text-fg-subtle hover:text-fg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">Produtos</p>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Loja
          </h1>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="card p-4 flex items-start gap-3 border-gold/20 bg-gold/5">
        <ShoppingBag className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-fg">Compre antes de chegar</p>
          <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
            Reserve seu produto pelo app e retire na barbearia. O pagamento é feito no balcão.
          </p>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="card p-10 text-center">
          <Package className="w-8 h-8 text-fg-dim mx-auto mb-3" />
          <p className="text-sm text-fg-muted">Nenhum produto disponível no momento.</p>
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, items]) => (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-gold" />
              <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">{cat}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map((p) => {
                const esgotado = Number(p.stock_current) <= 0;
                const ultimas = !esgotado && Number(p.stock_current) <= 3;
                return (
                  <div key={p.id} className={cn('card overflow-hidden flex flex-col', esgotado && 'opacity-60')}>
                    {/* Imagem ou placeholder */}
                    <div className="relative bg-bg-elevated flex items-center justify-center flex-shrink-0" style={{ aspectRatio: '1/1' }}>
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-10 h-10 text-fg-dim" />
                      )}
                      {esgotado && (
                        <div className="absolute inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-fg-dim/20 text-fg-muted border border-fg-dim/30">
                            Esgotado
                          </span>
                        </div>
                      )}
                      {ultimas && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-warning/20 text-warning border border-warning/30">
                          Últimas {p.stock_current}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="text-sm font-semibold text-fg leading-tight">{p.name}</p>
                      {p.brand && (
                        <p className="text-[10px] text-fg-subtle mt-0.5">{p.brand}</p>
                      )}
                      {p.description && (
                        <p className="text-[10px] text-fg-subtle mt-1 leading-relaxed line-clamp-2">
                          {p.description}
                        </p>
                      )}
                      <div className="mt-auto pt-3">
                        <p className="text-base font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                          {formatCurrency(Number(p.sale_price))}
                        </p>
                        <p className="text-[10px] text-fg-subtle mt-0.5">
                          {esgotado ? 'Indisponível' : 'Retire na barbearia'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* CTA agendar */}
      <div className="card p-5 space-y-3 border-gold/20">
        <p className="text-sm font-bold text-fg">Quer levar na sua próxima visita?</p>
        <p className="text-xs text-fg-muted leading-relaxed">
          Agende seu horário e fale com o barbeiro sobre os produtos que quer. Pagamento no balcão, na saída.
        </p>
        <Link href="/cliente/agendar"
          className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-3 text-sm">
          <ShoppingBag className="w-4 h-4" />
          Agendar e reservar produtos
        </Link>
      </div>
    </div>
  );
}