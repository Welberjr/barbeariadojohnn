import { createClient } from '@/lib/supabase/server';
import { Plus, Scissors, Clock } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export const metadata = {
  title: 'Serviços',
};

export default async function ServicosPage() {
  const supabase = await createClient();

  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });

  // Agrupar por categoria
  const grouped =
    services?.reduce<Record<string, typeof services>>((acc, svc) => {
      const cat = svc.category || 'Sem categoria';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    }, {}) ?? {};

  const totalAtivos = services?.filter((s) => s.active).length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Operação
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Serviços
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Cardápio de serviços oferecidos pela barbearia.
          </p>
        </div>

        <Link
          href="/admin/servicos/novo"
          className="btn-gold-shimmer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar serviço</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Scissors className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Total
            </p>
          </div>
          <p
            className="text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {services?.length ?? 0}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Scissors className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Ativos
            </p>
          </div>
          <p
            className="text-3xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalAtivos}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Categorias
            </p>
          </div>
          <p
            className="text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {Object.keys(grouped).length}
          </p>
        </div>
      </div>

      {/* LISTA POR CATEGORIA */}
      {error ? (
        <div className="card p-8 text-center">
          <p className="text-danger text-sm">
            Erro ao carregar serviços: {error.message}
          </p>
        </div>
      ) : !services || services.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
            <Scissors className="w-6 h-6" />
          </div>
          <h2
            className="text-xl font-bold text-fg mb-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Nenhum serviço cadastrado
          </h2>
          <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
            Adicione os serviços que sua barbearia oferece.
          </p>
          <Link
            href="/admin/servicos/novo"
            className="btn-gold-shimmer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar primeiro serviço</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h2
                className="text-sm font-semibold text-gold tracking-wider uppercase mb-3 flex items-center gap-2"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold" />
                {category}
                <span className="text-fg-dim font-normal normal-case ml-1">
                  ({items.length})
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((svc) => (
                  <Link
                    key={svc.id}
                    href={`/admin/servicos/${svc.id}`}
                    className={`card card-hover p-4 group ${
                      !svc.active ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                          <Scissors className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-fg truncate">
                            {svc.name}
                          </h3>
                          <p className="text-[11px] text-fg-subtle flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {svc.base_duration_minutes} min
                          </p>
                        </div>
                      </div>
                    </div>

                    {svc.description && (
                      <p className="text-[11px] text-fg-muted line-clamp-2 my-2">
                        {svc.description}
                      </p>
                    )}

                    <div className="flex items-end justify-between mt-3 pt-3 border-t border-border/60">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                          A partir de
                        </p>
                        <p
                          className="text-lg font-bold text-gold leading-none"
                          style={{ fontFamily: 'var(--font-playfair), serif' }}
                        >
                          {formatCurrency(Number(svc.base_price))}
                        </p>
                      </div>
                      {svc.active && (
                        <span className="badge-success text-[10px]">
                          <span className="w-1 h-1 rounded-full bg-success" />
                          Ativo
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
