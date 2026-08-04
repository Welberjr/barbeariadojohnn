export function getISOWeek(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

export function weeklyBonusReason(date = new Date()): string {
  return `raspadinha_semanal:${getISOWeek(date)}`;
}

/** Valores que podem ser concedidos pela raspadinha semanal. */
export const WEEKLY_BONUS_PRIZES = [5, 10, 15, 20, 30, 50] as const;

/**
 * Sorteia no servidor. O navegador nunca escolhe quantos pontos receberá.
 *
 * `random` é injetável apenas para teste; em produção usa a fonte padrão do
 * runtime. A validação de sessão e a gravação continuam na rota da API.
 */
export function drawWeeklyBonus(random = Math.random): number {
  const index = Math.min(
    WEEKLY_BONUS_PRIZES.length - 1,
    Math.floor(random() * WEEKLY_BONUS_PRIZES.length)
  );
  return WEEKLY_BONUS_PRIZES[Math.max(0, index)];
}
