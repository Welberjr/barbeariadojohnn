-- ============================================================================
-- BARBEARIA DO JOHNN — Semana 5 — Fidelidade + Site Público + WhatsApp
-- Idempotente: pode rodar várias vezes.
-- ============================================================================

-- ============================================================================
-- 1. LOYALTY_POINTS — saldo de pontos por cliente
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  balance integer DEFAULT 0,
  lifetime_earned integer DEFAULT 0,
  lifetime_redeemed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(barbershop_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_barbershop ON public.loyalty_points(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer ON public.loyalty_points(customer_id);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_points_all" ON public.loyalty_points;
CREATE POLICY "loyalty_points_all" ON public.loyalty_points
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = loyalty_points.barbershop_id
    )
  );

-- ============================================================================
-- 2. LOYALTY_TRANSACTIONS — histórico de pontos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type text NOT NULL,
  points integer NOT NULL,
  reason text,
  comanda_id uuid REFERENCES public.comandas(id) ON DELETE SET NULL,
  reward_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_barbershop ON public.loyalty_transactions(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON public.loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON public.loyalty_transactions(created_at);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_tx_all" ON public.loyalty_transactions;
CREATE POLICY "loyalty_tx_all" ON public.loyalty_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = loyalty_transactions.barbershop_id
    )
  );

-- ============================================================================
-- 3. LOYALTY_REWARDS — prêmios resgatáveis
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL DEFAULT 0,
  reward_type text DEFAULT 'discount',
  reward_value numeric,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_barbershop ON public.loyalty_rewards(barbershop_id);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_rewards_select" ON public.loyalty_rewards;
CREATE POLICY "loyalty_rewards_select" ON public.loyalty_rewards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "loyalty_rewards_modify" ON public.loyalty_rewards;
CREATE POLICY "loyalty_rewards_modify" ON public.loyalty_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = loyalty_rewards.barbershop_id
        AND s.role IN ('owner', 'manager')
    )
  );

-- ============================================================================
-- 4. BARBERSHOPS — campos novos (fidelidade, whatsapp, site)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name='loyalty_enabled') THEN
    ALTER TABLE public.barbershops ADD COLUMN loyalty_enabled boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name='loyalty_points_per_brl') THEN
    ALTER TABLE public.barbershops ADD COLUMN loyalty_points_per_brl numeric DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name='whatsapp_config') THEN
    ALTER TABLE public.barbershops ADD COLUMN whatsapp_config jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name='site_config') THEN
    ALTER TABLE public.barbershops ADD COLUMN site_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- FINAL
-- ============================================================================
SELECT
  'Migration semana 5 aplicada' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('loyalty_points', 'loyalty_transactions', 'loyalty_rewards')) as tabelas_loyalty,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name IN ('loyalty_enabled', 'loyalty_points_per_brl', 'whatsapp_config', 'site_config')) as colunas_novas;
