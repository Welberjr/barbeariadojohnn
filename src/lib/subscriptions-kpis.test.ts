import { describe, it, expect } from 'vitest';
import { monthlyEquivalent, subscriptionKpis } from './subscriptions';

const FUTURO = '2099-01-01T00:00:00.000Z';
const PASSADO = '2020-01-01T00:00:00.000Z';

describe('monthlyEquivalent', () => {
  it('divide pelo período do plano', () => {
    expect(monthlyEquivalent(120, 'monthly')).toBe(120);
    expect(monthlyEquivalent(300, 'quarterly')).toBe(100);
    expect(monthlyEquivalent(600, 'semiannual')).toBe(100);
    expect(monthlyEquivalent(1200, 'annual')).toBe(100);
  });
});

describe('subscriptionKpis', () => {
  it('assinante vigente é active OU past_due; cancelada fica de fora', () => {
    const kpis = subscriptionKpis([
      { status: 'active', current_price: 120, current_period_end: FUTURO },
      { status: 'past_due', current_price: 100, current_period_end: FUTURO },
      { status: 'cancelled', current_price: 300, current_period_end: FUTURO },
    ]);
    expect(kpis.assinantes).toBe(2);
    expect(kpis.mrr).toBe(220);
  });

  it('inadimplente é past_due OU ciclo vencido, mesmo marcada active', () => {
    const kpis = subscriptionKpis([
      { status: 'active', current_price: 120, current_period_end: FUTURO },
      { status: 'active', current_price: 100, current_period_end: PASSADO },
      { status: 'past_due', current_price: 80, current_period_end: FUTURO },
    ]);
    expect(kpis.inadimplentes).toBe(2);
    expect(kpis.mrrEmRisco).toBe(180);
  });

  it('MRR usa o equivalente mensal, não o preço cru do plano', () => {
    const kpis = subscriptionKpis([
      { status: 'active', current_price: 300, current_period_end: FUTURO, period: 'quarterly' },
    ]);
    expect(kpis.mrr).toBe(100);
  });
});
