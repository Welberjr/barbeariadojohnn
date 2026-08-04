/** Um cron sem segredo configurado nunca deve processar dados reais. */
export function isAuthorizedCronRequest(
  authorization: string | null,
  cronSecret: string | undefined
): boolean {
  return Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
}
