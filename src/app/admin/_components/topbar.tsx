'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, User, Search, Bell, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';

interface AdminTopbarProps {
  userEmail: string;
  userName?: string;
}

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

        {/* Barra de busca */}
        <div className="hidden lg:block flex-1 max-w-md ml-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-gold transition-colors" />
            <input
              type="text"
              placeholder="Buscar cliente, agendamento, serviço..."
              className="input pl-10 w-full text-sm"
            />
          </div>
        </div>
      </div>

      {/* ========== LADO DIREITO ========== */}
      <div className="flex items-center gap-2">
        {/* Notificações */}
        <button
          className="relative p-2.5 rounded-md hover:bg-bg-elevated text-fg-muted hover:text-gold transition-colors"
          title="Notificações"
        >
          <Bell className="w-4 h-4" />
          {/* Badge de notificação */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold animate-pulse-glow" />
        </button>

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
