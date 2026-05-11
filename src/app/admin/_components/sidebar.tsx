'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Package,
  CircleDollarSign,
  Target,
  Crown,
  UserCog,
  MessageSquare,
  Settings,
  Trophy,
  FileText,
  Receipt,
  Globe,
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
  // GESTÃO
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin', section: 'Gestão' },
  { label: 'Agenda', icon: Calendar, href: '/admin/agenda', section: 'Gestão' },
  { label: 'Clientes', icon: Users, href: '/admin/clientes', section: 'Gestão' },

  // OPERAÇÃO
  { label: 'Profissionais', icon: UserCog, href: '/admin/profissionais', section: 'Operação' },
  { label: 'Serviços', icon: Scissors, href: '/admin/servicos', section: 'Operação' },
  { label: 'Produtos', icon: Package, href: '/admin/produtos', section: 'Operação' },

  // FINANCEIRO
  { label: 'Financeiro', icon: CircleDollarSign, href: '/admin/financeiro', section: 'Financeiro' },
  { label: 'Metas', icon: Target, href: '/admin/metas', section: 'Financeiro' },
  { label: 'DRE', icon: FileText, href: '/admin/dre', section: 'Financeiro' },
  { label: 'Contas a Pagar', icon: Receipt, href: '/admin/contas-pagar', section: 'Financeiro' },

  // MARKETING
  { label: 'Assinaturas', icon: Crown, href: '/admin/assinaturas', section: 'Marketing' },
  { label: 'Fidelidade', icon: Trophy, href: '/admin/fidelidade', section: 'Marketing' },
  { label: 'WhatsApp', icon: MessageSquare, href: '/admin/whatsapp', section: 'Marketing' },
  { label: 'Site Público', icon: Globe, href: '/admin/site', section: 'Marketing' },

  // SISTEMA
  { label: 'Configurações', icon: Settings, href: '/admin/configuracoes', section: 'Sistema' },
];

// Agrupar por seção mantendo a ordem
const groupedMenu = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
  const section = item.section || 'Outros';
  if (!acc[section]) acc[section] = [];
  acc[section].push(item);
  return acc;
}, {});

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-72 bg-bg-surface border-r border-border flex flex-col flex-shrink-0 relative"
      style={{
        background:
          'linear-gradient(180deg, #121212 0%, #0A0A0A 100%)',
      }}
    >
      {/* Linha dourada vertical sutil na direita */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/20 to-transparent" />

      {/* ========== LOGO BLOCK (destaque premium) ========== */}
      <div className="p-6 border-b border-border/60 relative">
        <Logo variant="compact" size="md" />
        {/* Linha dourada sutil abaixo */}
        <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </div>

      {/* ========== MENU (com seções) ========== */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {Object.entries(groupedMenu).map(([section, items]) => (
          <div key={section} className="space-y-1">
            {/* Section header */}
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-fg-dim">
              {section}
            </p>

            {/* Items */}
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all relative overflow-hidden',
                    isActive
                      ? 'text-gold bg-gold/10'
                      : 'text-fg-muted hover:text-fg hover:bg-bg-elevated'
                  )}
                >
                  {/* Barra lateral dourada no item ativo */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gradient-to-b from-gold to-gold-shimmer rounded-r-full" />
                  )}

                  <Icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-colors',
                      isActive ? 'text-gold' : 'text-fg-subtle group-hover:text-gold/70'
                    )}
                  />
                  <span>{item.label}</span>

                  {/* Hover glow sutil */}
                  {!isActive && (
                    <span className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/0 to-gold/0 group-hover:via-gold/5 transition-all pointer-events-none rounded-md" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ========== FOOTER ========== */}
      <div className="px-4 py-4 border-t border-border/60">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">
            v0.1.0
          </p>
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">
            Beta
          </p>
        </div>
      </div>
    </aside>
  );
}
