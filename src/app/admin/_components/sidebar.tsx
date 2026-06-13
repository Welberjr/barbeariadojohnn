'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  HelpCircle, LayoutDashboard, Calendar, Users, Scissors,
  Package, CircleDollarSign, Target, Crown, UserCog,
  MessageSquare, Settings, Trophy, FileText, Receipt,
  Clock, ClipboardList, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';

interface MenuItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  section?: string;
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard',       icon: LayoutDashboard, href: '/admin',                    section: 'Gestão' },
  { label: 'Agenda',          icon: Calendar,        href: '/admin/agenda',              section: 'Gestão' },
  { label: 'Comandas',        icon: ClipboardList,   href: '/admin/comandas',            section: 'Gestão' },
  { label: 'Clientes',        icon: Users,           href: '/admin/clientes',            section: 'Gestão' },
  { label: 'Profissionais',   icon: UserCog,         href: '/admin/profissionais',       section: 'Operação' },
  { label: 'Disponibilidade', icon: Clock,           href: '/admin/disponibilidade',     section: 'Operação' },
  { label: 'Serviços',        icon: Scissors,        href: '/admin/servicos',            section: 'Operação' },
  { label: 'Produtos',        icon: Package,         href: '/admin/produtos',            section: 'Operação' },
  { label: 'Financeiro',      icon: CircleDollarSign,href: '/admin/financeiro',          section: 'Financeiro' },
  { label: 'Metas',           icon: Target,          href: '/admin/metas',               section: 'Financeiro' },
  { label: 'DRE',             icon: FileText,        href: '/admin/dre',                 section: 'Financeiro' },
  { label: 'Contas a Pagar',  icon: Receipt,         href: '/admin/contas-pagar',        section: 'Financeiro' },
  { label: 'Assinaturas',     icon: Crown,           href: '/admin/assinaturas',         section: 'Marketing' },
  { label: 'Fidelidade',      icon: Trophy,          href: '/admin/fidelidade',          section: 'Marketing' },
  { label: 'WhatsApp',        icon: MessageSquare,   href: '/admin/whatsapp',            section: 'Marketing' },
  { label: 'Configurações',   icon: Settings,        href: '/admin/configuracoes',       section: 'Sistema' },
  { label: 'Central de Ajuda',icon: HelpCircle,      href: '/admin/ajuda',              section: 'Sistema' },
];

const groupedMenu = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
  const section = item.section || 'Outros';
  if (!acc[section]) acc[section] = [];
  acc[section].push(item);
  return acc;
}, {});

// ── Conteúdo interno (reutilizado no desktop e mobile) ───────────────────────
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-border/60 relative flex items-center justify-between">
        <Logo variant="compact" size="md" />
        {onClose && (
          <button type="button" onClick={onClose} className="text-fg-subtle hover:text-fg md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {Object.entries(groupedMenu).map(([section, items]) => (
          <div key={section} className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-fg-dim">
              {section}
            </p>
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all relative overflow-hidden',
                    isActive ? 'text-gold bg-gold/10' : 'text-fg-muted hover:text-fg hover:bg-bg-elevated'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gradient-to-b from-gold to-gold-shimmer rounded-r-full" />
                  )}
                  <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-gold' : 'text-fg-subtle group-hover:text-gold/70')} />
                  <span>{item.label}</span>
                  {!isActive && (
                    <span className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/0 to-gold/0 group-hover:via-gold/5 transition-all pointer-events-none rounded-md" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border/60">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">v0.1.0</p>
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">Beta</p>
        </div>
      </div>
    </div>
  );
}

// ── Export principal ─────────────────────────────────────────────────────────
export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Fechar ao navegar
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Travar scroll do body quando menu aberto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* ── BOTÃO HAMBURGER (só mobile) ────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-bg-elevated border border-border/60 flex items-center justify-center text-fg hover:text-gold transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── SIDEBAR DESKTOP (≥ md) ─────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-72 flex-col flex-shrink-0 relative"
        style={{ background: 'linear-gradient(180deg, #121212 0%, #0A0A0A 100%)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/20 to-transparent" />
        <SidebarContent />
      </aside>

      {/* ── DRAWER MOBILE (< md) ──────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="relative w-72 flex-shrink-0 flex flex-col h-full overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #121212 0%, #0A0A0A 100%)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              animation: 'slideInRight 0.22s ease-out',
            }}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}