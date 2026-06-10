import { Trophy, Star, Medal } from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { getRankings, type RankingRow } from '@/lib/loyalty';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Ranking' };
export const dynamic = 'force-dynamic';

function RankAvatar({ row }: { row: RankingRow }) {
  const initials = row.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (row.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.photo_url}
        alt={row.full_name}
        className="w-9 h-9 rounded-full object-cover border-2 border-gold/30 flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-bg flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)' }}
    >
      {initials}
    </div>
  );
}

function positionBadge(position: number) {
  if (position === 1)
    return (
      <span className="w-7 h-7 rounded-full bg-gold text-bg flex items-center justify-center flex-shrink-0">
        <Trophy className="w-3.5 h-3.5" />
      </span>
    );
  if (position === 2)
    return (
      <span className="w-7 h-7 rounded-full bg-gray-300/20 text-gray-300 border border-gray-300/40 flex items-center justify-center flex-shrink-0">
        <Medal className="w-3.5 h-3.5" />
      </span>
    );
  if (position === 3)
    return (
      <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 flex items-center justify-center flex-shrink-0">
        <Medal className="w-3.5 h-3.5" />
      </span>
    );
  return (
    <span className="w-7 h-7 rounded-full bg-bg-elevated border border-border text-fg-muted text-[11px] font-bold flex items-center justify-center flex-shrink-0">
      {position}
    </span>
  );
}

function Board({
  title,
  subtitle,
  rows,
  myRow,
  myCustomerId,
}: {
  title: string;
  subtitle: string;
  rows: RankingRow[];
  myRow: RankingRow | null;
  myCustomerId: string;
}) {
  const meInTop = rows.some((r) => r.customer_id === myCustomerId);

  return (
    <section className="card p-5 space-y-3">
      <div>
        <h2
          className="text-lg font-bold text-fg flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <Trophy className="w-4 h-4 text-gold" />
          {title}
        </h2>
        <p className="text-[11px] text-fg-subtle">{subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-fg-muted py-4 text-center">
          Ninguém pontuou ainda. Seja o primeiro!
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const isMe = r.customer_id === myCustomerId;
            return (
              <div
                key={r.customer_id}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-md transition-colors',
                  isMe
                    ? 'bg-gold/10 border border-gold/40'
                    : r.position <= 3
                      ? 'bg-bg-elevated'
                      : 'hover:bg-bg-elevated'
                )}
              >
                {positionBadge(r.position)}
                <RankAvatar row={r} />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm truncate',
                      isMe ? 'text-gold font-bold' : 'text-fg font-medium'
                    )}
                  >
                    {r.full_name}
                    {isMe && ' (você)'}
                  </p>
                </div>
                <p
                  className="text-sm font-bold text-gold flex-shrink-0"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {r.points.toLocaleString('pt-BR')}
                  <span className="text-[9px] text-fg-dim font-normal ml-1">
                    pts
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Minha posição (fora do top) */}
      {!meInTop && myRow && (
        <div className="pt-2 border-t border-border/60">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim mb-1.5">
            Sua posição
          </p>
          <div className="flex items-center gap-3 p-2.5 rounded-md bg-gold/10 border border-gold/40">
            {positionBadge(myRow.position)}
            <RankAvatar row={myRow} />
            <p className="flex-1 text-sm text-gold font-bold truncate">
              {myRow.full_name} (você)
            </p>
            <p
              className="text-sm font-bold text-gold"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {myRow.points.toLocaleString('pt-BR')}
              <span className="text-[9px] text-fg-dim font-normal ml-1">pts</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default async function RankingPage() {
  const { customer } = await requireCustomer();
  const rankings = await getRankings({
    limit: 20,
    highlightCustomerId: customer.id,
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">
          Clube de pontos
        </p>
        <h1
          className="text-2xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Ranking dos clientes
        </h1>
        <p className="text-xs text-fg-muted mt-1 flex items-center gap-1.5">
          <Star className="w-3 h-3 text-gold fill-current" />
          Cada R$ 1 gasto vale 10 pontos. Quanto mais você vem, mais sobe!
        </p>
      </div>

      <Board
        title="Ranking do Semestre"
        subtitle={`Zera a cada 6 meses · ${rankings.semesterLabel}`}
        rows={rankings.semester}
        myRow={rankings.mySemester}
        myCustomerId={customer.id}
      />

      <Board
        title="Ranking Geral"
        subtitle="Histórico completo · nunca zera"
        rows={rankings.allTime}
        myRow={rankings.myAllTime}
        myCustomerId={customer.id}
      />
    </div>
  );
}
