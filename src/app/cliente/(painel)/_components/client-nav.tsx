'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CalendarPlus,
  CalendarDays,
  Trophy,
  ShoppingBag,
  User,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';

interface ClientNavProps {
  customerName: string;
  photoUrl: string | null;
  unreadCount: number;
}

const NAV_ITEMS = [
  { href: '/cliente', label: 'Início', icon: Home, exact: true },
  { href: '/cliente/agendar', label: 'Agendar', icon: CalendarPlus, exact: false },
  { href: '/cliente/agendamentos', label: 'Agenda', icon: CalendarDays, exact: false },
  { href: '/cliente/ranking', label: 'Ranking', icon: Trophy, exact: false },
  { href: '/cliente/loja', label: 'Loja', icon: ShoppingBag, exact: false },
  { href: '/cliente/perfil', label: 'Perfil', icon: User, exact: false },
];

export function ClientTopbar({ customerName, photoUrl, unreadCount }: ClientNavProps) {
  const pathname = usePathname();
  const initials = customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border/60">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/cliente" className="flex items-center">
          <Logo variant="full" size="sm" />
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors',
                  active
                    ? 'bg-gold/15 text-gold'
                    : 'text-fg-muted hover:text-fg hover:bg-bg-elevated'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/cliente/notificacoes"
            className={cn(
              'relative p-2 rounded-md transition-colors',
              pathname.startsWith('/cliente/notificacoes')
                ? 'text-gold bg-gold/10'
                : 'text-fg-muted hover:text-gold hover:bg-bg-elevated'
            )}
            aria-label="Notificações"
          >
            <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gold text-bg text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <Link href="/cliente/perfil" aria-label="Perfil">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={customerName}
                className="w-8 h-8 rounded-full object-cover border-2 border-gold/40"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-bg"
                style={{
                  background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                }}
              >
                {initials}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function ClientBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors',
                active ? 'text-gold' : 'text-fg-subtle hover:text-fg'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_8px_rgba(212,160,79,0.5)]')} />
              <span className={cn(active && 'font-semibold')}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
