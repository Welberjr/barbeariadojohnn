-- ============================================================
-- SOBRA DA ASSINATURA
-- Cada corte incluso passa a valer uma fatia fixa da parte dos barbeiros.
-- O profissional leva pelo que atendeu e o que o cliente nao usou vira
-- SOBRA, com destino escolhido no plano.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Destino da sobra, escolhido por plano
-- ------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS leftover_destination text NOT NULL DEFAULT 'barbearia';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_leftover_destination_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_leftover_destination_check
      CHECK (leftover_destination IN ('barbearia', 'dividir_igual', 'maior_performance'));
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_plans.leftover_destination IS
  'O que fazer com o valor dos cortes que o cliente nao usou no ciclo: barbearia | dividir_igual | maior_performance.';

-- ------------------------------------------------------------
-- 2. Registro da sobra em cada fechamento
-- Sem isso nao da para responder "quanto sobrou do fulano no mes passado".
-- ------------------------------------------------------------
ALTER TABLE public.subscription_payouts
  ADD COLUMN IF NOT EXISTS leftover_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unused_uses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_uses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leftover_destination text NOT NULL DEFAULT 'barbearia';

COMMENT ON COLUMN public.subscription_payouts.leftover_amount IS
  'Quanto sobrou neste ciclo e ficou com a barbearia.';
COMMENT ON COLUMN public.subscription_payouts.unused_uses IS
  'Cortes inclusos que o cliente nao usou no ciclo.';
COMMENT ON COLUMN public.subscription_payouts.included_uses IS
  'Cortes que o plano incluia no momento do fechamento.';
COMMENT ON COLUMN public.subscription_payouts.leftover_destination IS
  'Destino aplicado a sobra neste fechamento, guardado para o historico nao mudar se o plano mudar depois.';

-- ------------------------------------------------------------
-- 3. Detalhe do que cada profissional recebeu
-- Separa o que veio dos atendimentos e o que veio da sobra.
-- ------------------------------------------------------------
ALTER TABLE public.subscription_payout_items
  ADD COLUMN IF NOT EXISTS base_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leftover_amount numeric(10,2) NOT NULL DEFAULT 0;

-- Historico anterior: tudo o que foi pago veio de atendimento, porque a regra
-- antiga distribuia o valor inteiro entre quem atendeu.
UPDATE public.subscription_payout_items
   SET base_amount = amount
 WHERE base_amount = 0 AND amount > 0;

-- ------------------------------------------------------------
-- 4. Verificacao
-- ------------------------------------------------------------
SELECT name, price, included_uses, barber_share_percent, leftover_destination
  FROM public.subscription_plans
 ORDER BY name;
