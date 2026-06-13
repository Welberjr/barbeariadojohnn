import { Crown, CheckCircle2, Scissors, Star, ChevronLeft, Zap } from 'lucide-react';
import Link from 'next/link';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Clube VIP' };
export const dynamic = 'force-dynamic';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export default async function ClubeVipPage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const { data: plans } = await admin
    .from('subscription_plans')
    .select('id, name, price, included_uses, allowed_days, active')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('price', { ascending: true });

  const activePlans = plans ?? [];

  const benefits = [
    { icon: '✂️', title: 'Atendimentos incluídos',   desc: 'Cortes mensais cobertos pelo plano sem pagar na hora.' },
    { icon: '⚡', title: 'Prioridade no agendamento', desc: 'Assinantes têm acesso antecipado aos melhores horários.' },
    { icon: '💰', title: 'Economia garantida',        desc: 'Pague menos por corte do que no valor avulso.' },
    { icon: '🏆', title: 'Pontos bônus',              desc: 'Assinantes acumulam pontos mesmo nos atendimentos cobertos.' },
    { icon: '👑', title: 'Status VIP',                desc: 'Conquista exclusiva de Clube VIP no seu perfil.' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Link href="/cliente" className="text-fg-subtle hover:text-fg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">Fidelização</p>
      </div>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden px-5 py-8 text-center"
        style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1204 60%, #2a1c00 100%)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C518, transparent)' }} />
        <Crown className="w-12 h-12 text-gold mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-fg mb-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Clube VIP
        </h1>
        <p className="text-sm text-fg-muted max-w-xs mx-auto">
          Economize, tenha prioridade e acumule pontos toda vez que vier à barbearia.
        </p>
      </div>

      {/* Beneficios */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-fg">O que você ganha</h2>
        <div className="space-y-2.5">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{b.icon}</span>
              <div>
                <p className="text-sm font-semibold text-fg">{b.title}</p>
                <p className="text-[11px] text-fg-muted leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      {activePlans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-fg">Escolha seu plano</h2>
          {activePlans.map((plan) => (
            <div key={plan.id} className="card p-5 space-y-3 border-gold/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                    {plan.name}
                  </p>
                  <p className="text-[11px] text-fg-muted mt-0.5">
                    {plan.included_uses} {plan.included_uses === 1 ? 'atendimento' : 'atendimentos'} por ciclo
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                    R$ {Number(plan.price).toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-[10px] text-fg-subtle">/mês</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                {plan.included_uses} atendimentos cobertos no mês
              </div>
            </div>
          ))}
        </section>
      )}

      {/* CTA */}
      <div className="card p-5 space-y-3 border-gold/30" style={{
        background: 'linear-gradient(135deg, rgba(212,160,79,0.08) 0%, transparent 100%)'
      }}>
        <div className="flex items-center gap-2 text-gold">
          <Zap className="w-4 h-4" />
          <p className="text-sm font-bold">Como assinar</p>
        </div>
        <p className="text-sm text-fg-muted leading-relaxed">
          Para ativar seu Clube VIP, basta pedir ao seu barbeiro na próxima visita.
          Ele vai criar sua assinatura na hora.
        </p>
        <Link href="/cliente/agendar"
          className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-3">
          <Scissors className="w-4 h-4" />
          <span>Agendar e pedir meu Clube VIP</span>
        </Link>
      </div>

      {/* Depoimento ficticio / social proof */}
      <div className="card p-4 border-border/40">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3 h-3 text-gold fill-current" />
          ))}
        </div>
        <p className="text-sm text-fg-muted italic leading-relaxed">
          &quot;Assino o clube há 4 meses. Economizo no corte e sei que tenho horário garantido toda semana.&quot;
        </p>
        <p className="text-[11px] text-fg-dim mt-1.5">— Cliente desde 2024</p>
      </div>
    </div>
  );
}