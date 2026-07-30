'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CalendarDays,
  ClipboardList,
  CircleDollarSign,
  Wallet,
  Users,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import type { Modulo } from '@/lib/staff-permissions';

interface ItemNav {
  href: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
  /** Sem módulo, o item aparece para todo profissional */
  modulo?: Modulo;
}

const ITENS: ItemNav[] = [
  { href: '/painel', label: 'Hoje', icon: Home, exact: true },
  { href: '/painel/agenda', label: 'Agenda', icon: CalendarDays, exact: false },
  { href: '/painel/comandas', label: 'Comandas', icon: ClipboardList, exact: false, modulo: 'comanda' },
  { href: '/painel/financeiro', label: 'Financeiro', icon: CircleDollarSign, exact: false, modulo: 'financeiro' },
  { href: '/painel/vales', label: 'Vales', icon: Wallet, exact: false, modulo: 'vales_ver' },
  { href: '/painel/clientes', label: 'Clientes', icon: Users, exact: false, modulo: 'clientes' },
];

function itensVisiveis(modulos: Modulo[]): ItemNav[] {
  return ITENS.filter((item) => !item.modulo || modulos.includes(item.modulo));
}

interface NavProps {
  displayName: string;
  modulos: Modulo[];
}

export function PainelTopbar({ displayName, modulos }: NavProps) {
  const pathname = usePathname();
  const iniciais = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const visiveis = itensVisiveis(modulos);

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border/60">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/painel" className="flex items-center">
          <Logo variant="full" size="sm" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {visiveis.map((item) => {
            const ativo = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors',
                  ativo
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

        <Link
          href="/painel/perfil"
          prefetch={true}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
            pathname.startsWith('/painel/perfil')
              ? 'bg-gold text-bg'
              : 'bg-bg-elevated text-gold border border-gold/30 hover:border-gold/60'
          )}
          aria-label="Meu perfil"
        >
          {iniciais}
        </Link>
      </div>
    </header>
  );
}

export function PainelBottomNav({ modulos }: { modulos: Modulo[] }) {
  const pathname = usePathname();
  // No celular cabem cinco: os quatro primeiros liberados e o perfil
  const visiveis = itensVisiveis(modulos).slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur-md border-t border-border/60">
      <div className="flex items-stretch justify-around">
        {visiveis.map((item) => {
          const ativo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
                ativo ? 'text-gold' : 'text-fg-muted'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/painel/perfil"
          prefetch={true}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
            pathname.startsWith('/painel/perfil') ? 'text-gold' : 'text-fg-muted'
          )}
        >
          <User className="w-5 h-5" />
          <span>Perfil</span>
        </Link>
      </div>
    </nav>
  );
}
