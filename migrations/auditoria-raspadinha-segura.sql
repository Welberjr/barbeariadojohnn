-- Impede duas concessões da mesma raspadinha semanal em corridas entre abas.
-- O índice é parcial para não alterar os demais lançamentos de fidelidade.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_transactions_weekly_bonus_once
  ON public.loyalty_transactions (barbershop_id, customer_id, reason)
  WHERE type = 'bonus' AND reason LIKE 'raspadinha_semanal:%';
