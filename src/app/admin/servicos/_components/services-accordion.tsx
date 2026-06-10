'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffServiceRow {
  staff_id: string;
  staff_name: string;
  price: number | null;
  duration: number | null;
  commission: number | null;
}

interface PromoDay {
  dow: number;
  price: number | null;
}

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface ServiceRowItem {
  id: string;
  name: string;
  active: boolean;
  base_price: number;
  base_duration_minutes: number;
  base_commission_percent: number;
  staff_services: StaffServiceRow[];
  promos: PromoDay[];
  staffCount: number;
}

interface ServicesByCat {
  category: string;
  items: ServiceRowItem[];
}

interface ServicesAccordionProps {
  servicesByCategory: ServicesByCat[];
  totalServices: number;
  totalAtivos: number;
  totalCategorias: number;
  totalUnicos: number;
}

export function ServicesAccordion({
  servicesByCategory,
  totalServices,
  totalAtivos,
  totalCategorias,
  totalUnicos,
}: ServicesAccordionProps) {
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  function toggle(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = servicesByCategory
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((s) =>
        query
          ? s.name.toLowerCase().includes(query.toLowerCase())
          : true
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: totalServices, cls: 'text-fg' },
          { label: 'Ativos', value: totalAtivos, cls: 'text-success' },
          { label: 'Inativos', value: totalServices - totalAtivos, cls: 'text-fg-muted' },
          { label: 'Serviços únicos', value: totalUnicos, cls: 'text-gold' },
        ].map((k) => (
          <div key={k.label} className="card p-5">
            <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">
              {k.label}
            </p>
            <p
              className={cn('text-3xl font-bold', k.cls)}
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* BUSCA */}
      <div className="card p-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-fg-subtle flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar por serviço ou profissional..."
          className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-fg-subtle"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* LISTA ACORDEÃO */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-fg-muted text-sm">Nenhum serviço encontrado.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((cat) => (
            <div key={cat.category}>
              {cat.items.map((svc, idx) => {
                const isOpen = openRows.has(svc.id);
                const isLast =
                  idx === cat.items.length - 1 &&
                  cat.category === filtered[filtered.length - 1].category;

                return (
                  <div
                    key={svc.id}
                    className={cn(!isLast && 'border-b border-border/50')}
                  >
                    {/* ROW PRINCIPAL */}
                    <div
                      className={cn(
                        'flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-bg-elevated transition-colors',
                        isOpen && 'bg-bg-elevated'
                      )}
                      onClick={() => toggle(svc.id)}
                    >
                      {/* expand icon */}
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gold flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                      )}

                      {/* nome */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-sm text-fg font-medium truncate">
                          {svc.name}
                        </p>
                        {/* dot categoria */}
                        <span className="hidden sm:block text-[10px] text-fg-dim border border-border/60 rounded px-1.5 py-0.5 flex-shrink-0">
                          {cat.category}
                        </span>
                      </div>

                      {/* staff count */}
                      <span className="text-[11px] text-fg-subtle flex-shrink-0 hidden md:block">
                        {svc.staffCount} prof.
                      </span>

                      {/* preco */}
                      <span
                        className={cn(
                          'text-sm font-bold flex-shrink-0',
                          svc.active ? 'text-gold' : 'text-fg-dim'
                        )}
                        style={{ fontFamily: 'var(--font-playfair), serif' }}
                      >
                        R$ {Number(svc.base_price).toFixed(2).replace('.', ',')}
                      </span>

                      {/* duracao */}
                      <span className="text-[11px] text-fg-muted flex-shrink-0 w-16 text-right hidden sm:block">
                        {svc.base_duration_minutes}min
                      </span>

                      {/* badge ativo */}
                      <span
                        className={cn(
                          'text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                          svc.active
                            ? 'bg-success/10 text-success border border-success/30'
                            : 'bg-fg-dim/10 text-fg-subtle border border-border'
                        )}
                      >
                        {svc.active ? 'Ativo' : 'Inativo'}
                      </span>

                      {/* editar */}
                      <Link
                        href={`/admin/servicos/${svc.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-fg-subtle hover:text-gold hover:bg-gold/10 transition-colors flex-shrink-0"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {/* EXPANSAO: por profissional + preco promocional */}
                    {isOpen && (
                      <div className="px-10 pb-4 pt-2 space-y-4 bg-bg-elevated border-t border-border/30 animate-fade-in">
                        {/* tabela de profissionais */}
                        {svc.staff_services.length > 0 && (
                          <div>
                            <div className="grid grid-cols-4 gap-3 text-[10px] uppercase tracking-wider text-fg-dim mb-1.5 px-1">
                              <span>Nome</span>
                              <span>Preço</span>
                              <span>Min</span>
                              <span>Comissão</span>
                            </div>
                            <div className="space-y-1">
                              {svc.staff_services.map((ss) => (
                                <div
                                  key={ss.staff_id}
                                  className="grid grid-cols-4 gap-3 items-center py-2 px-3 rounded-md bg-bg border border-border/40"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-gold/20 text-gold text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                                      {ss.staff_name.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="text-xs text-fg truncate">
                                      {ss.staff_name}
                                    </span>
                                  </div>
                                  <input
                                    type="number"
                                    readOnly
                                    value={
                                      ss.price != null
                                        ? Number(ss.price).toFixed(2)
                                        : Number(svc.base_price).toFixed(2)
                                    }
                                    className="input text-xs py-1 px-2 text-right w-full"
                                  />
                                  <input
                                    type="number"
                                    readOnly
                                    value={
                                      ss.duration != null
                                        ? ss.duration
                                        : svc.base_duration_minutes
                                    }
                                    className="input text-xs py-1 px-2 text-right w-full"
                                  />
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      readOnly
                                      value={
                                        ss.commission != null
                                          ? Number(ss.commission).toFixed(0)
                                          : Number(
                                              svc.base_commission_percent
                                            ).toFixed(0)
                                      }
                                      className="input text-xs py-1 px-2 text-right w-full"
                                    />
                                    <span className="text-[11px] text-fg-subtle">
                                      %
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* precos promocionais */}
                        {svc.promos.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gold mb-2">
                              Preços promocionais
                            </p>
                            <div className="grid grid-cols-7 gap-1.5">
                              {DOW_LABELS.map((label, dow) => {
                                const promo = svc.promos.find(
                                  (p) => p.dow === dow
                                );
                                return (
                                  <div
                                    key={dow}
                                    className="text-center"
                                  >
                                    <p className="text-[9px] uppercase text-fg-dim mb-1">
                                      {label}
                                    </p>
                                    <div className="input text-[11px] py-1 px-1 text-center">
                                      {promo?.price != null
                                        ? `R$${Number(promo.price).toFixed(0)}`
                                        : '—'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
