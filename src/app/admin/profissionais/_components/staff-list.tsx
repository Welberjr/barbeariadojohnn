'use client';

import Link from 'next/link';
import { Edit2, MoreVertical, Mail, Phone, Briefcase } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StaffMember {
  id: string;
  display_name: string;
  role: 'owner' | 'manager' | 'barber' | 'receptionist' | 'assistant';
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
  use_barbershop_hours: boolean;
  default_commission_percent: number;
  active: boolean;
  hired_at: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

const roleLabels: Record<StaffMember['role'], string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  barber: 'Barbeiro',
  receptionist: 'Recepcionista',
  assistant: 'Auxiliar',
};

const roleColors: Record<StaffMember['role'], string> = {
  owner: 'text-gold border-gold/30 bg-gold/10',
  manager: 'text-info border-info/30 bg-info/10',
  barber: 'text-fg border-border-strong bg-bg-elevated',
  receptionist: 'text-success border-success/30 bg-success/10',
  assistant: 'text-fg-muted border-border-strong bg-bg-elevated',
};

export function StaffList({ staff }: { staff: StaffMember[] }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {staff.map((member) => {
        const initials = (member.display_name || '?')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <div
            key={member.id}
            className={cn(
              'card card-hover p-5 relative group',
              !member.active && 'opacity-60'
            )}
          >
            {/* Menu dropdown */}
            <div className="absolute top-3 right-3">
              <button
                onClick={() =>
                  setOpenMenuId(openMenuId === member.id ? null : member.id)
                }
                className="p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-bg-elevated transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {openMenuId === member.id && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpenMenuId(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 card-premium p-1.5 z-50 animate-fade-in">
                    <Link
                      href={`/admin/profissionais/${member.id}`}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-bg-elevated transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Header com avatar */}
            <div className="flex items-start gap-4 mb-4">
              {member.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photo_url}
                  alt={member.display_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-gold/30"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-bg flex-shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                  }}
                >
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0 pr-6">
                <h3
                  className="text-base font-bold text-fg leading-tight truncate"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {member.display_name}
                </h3>
                <p className="text-[11px] text-fg-subtle truncate mt-0.5">
                  {member.profile?.full_name}
                </p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border tracking-wider uppercase mt-2',
                    roleColors[member.role]
                  )}
                >
                  {roleLabels[member.role]}
                </span>
              </div>
            </div>

            {/* Bio */}
            {member.bio && (
              <p className="text-xs text-fg-muted line-clamp-2 mb-3">
                {member.bio}
              </p>
            )}

            {/* Contato */}
            <div className="space-y-1.5">
              {member.profile?.email && (
                <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{member.profile.email}</span>
                </div>
              )}
              {member.profile?.phone && (
                <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{member.profile.phone}</span>
                </div>
              )}
              {member.specialties && member.specialties.length > 0 && (
                <div className="flex items-start gap-2 text-[11px] text-fg-subtle">
                  <Briefcase className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">
                    {member.specialties.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Footer com comissão e status */}
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
              <div>
                <p className="text-[9px] tracking-wider uppercase text-fg-dim">
                  Comissão
                </p>
                <p
                  className="text-sm font-bold text-gold"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {member.default_commission_percent}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] tracking-wider uppercase text-fg-dim">
                  Status
                </p>
                <p
                  className={cn(
                    'text-xs font-semibold flex items-center gap-1.5',
                    member.active ? 'text-success' : 'text-fg-subtle'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      member.active ? 'bg-success animate-pulse' : 'bg-fg-dim'
                    )}
                  />
                  {member.active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
