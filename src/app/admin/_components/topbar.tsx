'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  User,
  Search,
  Bell,
  ChevronDown,
  Loader2,
  Users,
  Scissors,
  Calendar,
  ClipboardList,
  Package,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';

interface AdminTopbarProps {
  userEmail: string;
  userName?: string;
}

interface SearchResults {
  customers: { id: string; full_name: string; phone: string | null }[];
  services: { id: string; name: string; base_price: number }[];
  appointments: { id: string; start_at: string; customer_name: string }[];
}

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('Falha na busca');
        const data = (await res.json()) as SearchResults;
        setResults(data);
        setOpen(true);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults({ customers: [], services: [], appointments: [] });
          setOpen(true);
          setLoading(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery('');
    setResults(null);
    router.push(href);
  }

  function handleEnter() {
    const q = query.trim();
    if (!q) return;
    if (results?.customers?.[0]) {
      go(`/admin/clientes/${results.customers[0].id}`);
    } else {
      go(`/admin/clientes?q=${encodeURIComponent(q)}`);
    }
  }

  function agendaDate(iso: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
  }

  const isEmpty =
    results &&
    results.customers.length === 0 &&
    results.services.length === 0 &&
    results.appointments.length === 0;

  return (
    <div className="relative group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-gold transition-colors z-10" />
      <input
        type="text"
        placeholder="Buscar cliente, agendamento, serviço..."
        className="input pl-10 w-full text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleEnter();
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold animate-spin" />
      )}

      {open && results && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-2 card-premium p-2 z-50 animate-fade-in max-h-[70vh] overflow-y-auto">
            {isEmpty ? (
              <p className="text-sm text-fg-subtle text-center py-6">
                Nada encontrado para &quot;{query.trim()}&quot;
              </p>
            ) : (
              <>
                {results.customers.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-fg-dim">
                      Clientes
                    </p>
                    {results.customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => go(`/admin/clientes/${c.id}`)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left hover:bg-bg-elevated transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                        <span className="text-sm text-fg truncate flex-1">
                          {c.full_name}
                        </span>
                        {c.phone && (
                          <span className="text-[11px] text-fg-subtle flex-shrink-0">
                            {formatPhone(c.phone)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {results.services.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-fg-dim">
                      Serviços
                    </p>
                    {results.services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => go(`/admin/servicos/${s.id}`)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left hover:bg-bg-elevated transition-colors"
                      >
                        <Scissors className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                        <span className="text-sm text-fg truncate flex-1">
                          {s.name}
                        </span>
                        <span className="text-[11px] text-fg-subtle flex-shrink-0">
                          {formatCurrency(s.base_price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {results.appointments.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-fg-dim">
                      Próximos agendamentos
                    </p>
                    {results.appointments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => go(`/admin/agenda?date=${agendaDate(a.start_at)}`)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left hover:bg-bg-elevated transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                        <span className="text-sm text-fg truncate flex-1">
                          {a.customer_name}
                        </span>
                        <span className="text-[11px] text-fg-subtle flex-shrink-0">
                          {new Date(a.start_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// SINO DE NOTIFICAÇÕES
// ============================================================================

interface NotificationItem {
  type: 'comanda' | 'stock' | 'bill' | 'appointment';
  severity: 'danger' | 'warn' | 'info';
  title: string;
  subtitle: string;
  href: string;
}

const notifIcons = {
  comanda: ClipboardList,
  stock: Package,
  bill: Receipt,
  appointment: Calendar,
} as const;

const severityColors = {
  danger: 'text-danger bg-danger/10',
  warn: 'text-gold bg-gold/10',
  info: 'text-info bg-info/10',
} as const;

function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications');
      if (!res.ok) throw new Error('Falha ao carregar');
      const data = (await res.json()) as {
        count: number;
        items: NotificationItem[];
      };
      setItems(data.items ?? []);
      setCount(data.count ?? 0);
    } catch {
      // Sem alarde: o sino apenas fica sem badge
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative p-2.5 rounded-md hover:bg-bg-elevated text-fg-muted hover:text-gold transition-colors"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold animate-pulse-glow" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[85vw] card-premium p-2 z-50 animate-fade-in max-h-[70vh] overflow-y-auto">
            <div className="px-3 py-2 border-b border-border/60 mb-1 flex items-center justify-between">
              <p className="text-xs text-fg-muted">Notificações</p>
              {loading && (
                <Loader2 className="w-3.5 h-3.5 text-gold animate-spin" />
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 text-fg-dim opacity-40" />
                <p className="text-sm text-fg-subtle">Tudo em dia por aqui.</p>
              </div>
            ) : (
              items.map((n, i) => {
                const Icon = notifIcons[n.type] ?? Bell;
                return (
                  <button
                    key={`${n.type}-${i}`}
                    type="button"
                    onClick={() => go(n.href)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md text-left hover:bg-bg-elevated transition-colors"
                  >
                    <span
                      className={cn(
                        'p-1.5 rounded-md flex-shrink-0',
                        severityColors[n.severity] ?? severityColors.info
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-fg leading-tight truncate">
                        {n.title}
                      </span>
                      <span className="block text-[11px] text-fg-subtle truncate mt-0.5">
                        {n.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// TOPBAR
// ============================================================================

export function AdminTopbar({ userEmail, userName }: AdminTopbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Você saiu do sistema.');
    router.push('/login');
    router.refresh();
  }

  // Tira a parte antes do @ pra dar uma inicial
  const initials = (userName || userEmail.split('@')[0])
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="h-16 bg-bg-surface border-b border-border flex items-center justify-between px-6 lg:px-8 flex-shrink-0 relative"
      style={{
        background: 'linear-gradient(180deg, #121212 0%, #0F0F0F 100%)',
      }}
    >
      {/* Linha dourada sutil no rodapé */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/15 to-transparent" />

      {/* ========== LADO ESQUERDO ========== */}
      <div className="flex items-center gap-6 flex-1">
        {/* Crumbs/contexto */}
        <div className="hidden md:block">
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">
            Painel de Gestão
          </p>
          <p
            className="text-base text-fg font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Barbearia do <span className="text-gold italic">Johnn</span>
          </p>
        </div>

        {/* Barra de busca global */}
        <div className="hidden lg:block flex-1 max-w-md ml-4">
          <GlobalSearch />
        </div>
      </div>

      {/* ========== LADO DIREITO ========== */}
      <div className="flex items-center gap-2">
        {/* Notificações */}
        <NotificationsBell />

        {/* Perfil dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-elevated transition-colors"
          >
            {/* Avatar com initials */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-bg"
              style={{
                background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
              }}
            >
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs text-fg-muted leading-tight">Logado como</p>
              <p className="text-xs text-fg font-medium leading-tight max-w-[140px] truncate">
                {userName || userEmail.split('@')[0]}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-fg-subtle hidden md:block" />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <>
              {/* Backdrop pra fechar */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              {/* Menu */}
              <div className="absolute right-0 top-full mt-2 w-64 card-premium p-2 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <p className="text-xs text-fg-muted">Conta</p>
                  <p className="text-sm text-fg font-medium truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => router.push('/admin/configuracoes')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-bg-elevated transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>Meu perfil</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do sistema</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
