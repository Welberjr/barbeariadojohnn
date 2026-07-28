import { Phone } from 'lucide-react';
import { requireStaff } from '@/lib/staff-auth';
import { clientesDoStaff } from '@/lib/painel/dados';
import { montarSelo, corDoSelo } from '@/lib/painel/assinatura-selo';

export const metadata = { title: 'Meus clientes' };
export const dynamic = 'force-dynamic';

export default async function ClientesPainelPage() {
  const staff = await requireStaff('clientes');
  const clientes = await clientesDoStaff(staff);

  const agora = new Date();

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Clientes</p>
        <h1
          className="text-2xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Meus clientes
        </h1>
        <p className="text-xs text-fg-muted mt-1">
          Quem você já atendeu, do mais recente para o mais antigo.
        </p>
      </div>

      {clientes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-muted">
            Ainda não há atendimento fechado no seu nome. Assim que você fechar a primeira comanda,
            o cliente aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientes.map((c) => {
            const selo = montarSelo(c.assinatura, agora);

            return (
              <article key={c.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base text-fg truncate">{c.nome}</p>
                    <p className="text-xs text-fg-muted">
                      {c.atendimentos} {c.atendimentos === 1 ? 'atendimento' : 'atendimentos'}
                      {c.ultimaVisita
                        ? ` · última visita em ${new Date(c.ultimaVisita).toLocaleDateString(
                            'pt-BR',
                            { timeZone: 'America/Sao_Paulo' }
                          )}`
                        : ''}
                    </p>
                  </div>

                  {c.telefone && (
                    <a
                      href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-xs shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Chamar
                    </a>
                  )}
                </div>

                {c.servicosHabituais.length > 0 && (
                  <p className="text-xs text-fg-muted">
                    Costuma fazer: {c.servicosHabituais.join(', ')}
                  </p>
                )}

                {c.alergias && (
                  <p className="text-xs text-danger">Alergias: {c.alergias}</p>
                )}

                {c.observacoes && (
                  <p className="text-xs text-fg-muted italic">{c.observacoes}</p>
                )}

                {selo.situacao !== 'sem_assinatura' && (
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded-md border ${corDoSelo(
                      selo.situacao
                    )}`}
                  >
                    {selo.texto}
                  </span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
