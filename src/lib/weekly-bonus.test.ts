import { describe, expect, it } from 'vitest';
import {
  drawWeeklyBonus,
  WEEKLY_BONUS_PRIZES,
  weeklyBonusReason,
} from './weekly-bonus';

describe('raspadinha semanal', () => {
  it('sorteia apenas valores previstos, inclusive nos limites', () => {
    expect(drawWeeklyBonus(() => 0)).toBe(5);
    expect(drawWeeklyBonus(() => 0.999999)).toBe(50);
    expect(WEEKLY_BONUS_PRIZES).toContain(drawWeeklyBonus(() => 0.5));
  });

  it('identifica uma única raspadinha por semana ISO', () => {
    expect(weeklyBonusReason(new Date('2026-08-04T12:00:00Z'))).toBe(
      'raspadinha_semanal:2026-W32'
    );
  });
});
