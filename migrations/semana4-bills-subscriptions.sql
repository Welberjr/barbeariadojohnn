-- ============================================================================
-- BARBEARIA DO JOHNN — Semana 4 — Contas a Pagar + Assinaturas
-- Migration idempotente (pode rodar várias vezes).
-- Cole o conteúdo TODO no SQL Editor do Supabase e clique em Run.
-- ============================================================================

-- ============================================================================
-- 1. EXPENSE_CATEGORIES (categorias de despesas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_barbershop
  ON public.expense_categories(barbershop_id);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_all" ON public.expense_categories;
CREATE POLICY "expense_categories_all" ON public.expense_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = expense_categories.barbershop_id
    )
  );

-- Categorias padrão (insere se não existir nenhuma)
INSERT INTO public.expense_categories (barbershop_id, name, color, display_order)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
  cat.name,
  cat.color,
  cat.display_order
FROM (VALUES
  ('Aluguel', '#EF4444', 1),
  ('Energia/Água/Internet', '#F59E0B', 2),
  ('Fornecedores', '#3B82F6', 3),
  ('Marketing', '#8B5CF6', 4),
  ('Impostos/Taxas', '#6B7280', 5),
  ('Equipamentos', '#10B981', 6),
  ('Outros', '#94A3B8', 99)
) AS cat(name, color, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_categories
  WHERE barbershop_id = '11111111-1111-1111-1111-111111111111'::uuid
);

-- ============================================================================
-- 2. BILLS (contas a pagar)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT 'Conta',
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  paid_amount numeric,
  payment_method text,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  supplier text,
  notes text,
  status text DEFAULT 'pending',
  is_recurring boolean DEFAULT false,
  recurrence_type text,
  recurrence_day integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garante todas as colunas (caso tabela já existisse com schema diferente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='description') THEN
    ALTER TABLE public.bills ADD COLUMN description text NOT NULL DEFAULT 'Conta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='amount') THEN
    ALTER TABLE public.bills ADD COLUMN amount numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='due_date') THEN
    ALTER TABLE public.bills ADD COLUMN due_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='paid_at') THEN
    ALTER TABLE public.bills ADD COLUMN paid_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='paid_amount') THEN
    ALTER TABLE public.bills ADD COLUMN paid_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='payment_method') THEN
    ALTER TABLE public.bills ADD COLUMN payment_method text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='category_id') THEN
    ALTER TABLE public.bills ADD COLUMN category_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='supplier') THEN
    ALTER TABLE public.bills ADD COLUMN supplier text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='notes') THEN
    ALTER TABLE public.bills ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='status') THEN
    ALTER TABLE public.bills ADD COLUMN status text DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='is_recurring') THEN
    ALTER TABLE public.bills ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='recurrence_type') THEN
    ALTER TABLE public.bills ADD COLUMN recurrence_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills' AND column_name='recurrence_day') THEN
    ALTER TABLE public.bills ADD COLUMN recurrence_day integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bills_barbershop ON public.bills(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bills_all" ON public.bills;
CREATE POLICY "bills_all" ON public.bills
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = bills.barbershop_id
    )
  );

-- ============================================================================
-- 3. SUBSCRIPTION_PLANS (planos de assinatura mensal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  billing_cycle text DEFAULT 'monthly',
  includes_services jsonb DEFAULT '[]',
  includes_count integer DEFAULT 0,
  discount_percent_on_extras numeric DEFAULT 0,
  active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_barbershop
  ON public.subscription_plans(barbershop_id);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_select" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select" ON public.subscription_plans
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "subscription_plans_modify" ON public.subscription_plans;
CREATE POLICY "subscription_plans_modify" ON public.subscription_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = subscription_plans.barbershop_id
        AND s.role IN ('owner', 'manager')
    )
  );

-- ============================================================================
-- 4. CUSTOMER_SUBSCRIPTIONS (clientes assinantes ativos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '1 month'),
  cancelled_at timestamptz,
  remaining_uses integer DEFAULT 0,
  mp_subscription_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_barbershop
  ON public.customer_subscriptions(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer
  ON public.customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status
  ON public.customer_subscriptions(status);

ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_subscriptions_all" ON public.customer_subscriptions;
CREATE POLICY "customer_subscriptions_all" ON public.customer_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = customer_subscriptions.barbershop_id
    )
  );

-- ============================================================================
-- FINAL — confirma sucesso
-- ============================================================================
SELECT
  'Migration semana 4 aplicada com sucesso' as status,
  (SELECT COUNT(*) FROM public.expense_categories WHERE barbershop_id = '11111111-1111-1111-1111-111111111111'::uuid) as categorias_despesa,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('bills', 'expense_categories', 'subscription_plans', 'customer_subscriptions')) as tabelas_criadas;
