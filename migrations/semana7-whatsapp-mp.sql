-- ============================================================================
-- BARBEARIA DO JOHNN — Semana 7 — Fluxo Conversacional WhatsApp + Mercado Pago
-- Idempotente: pode rodar várias vezes.
-- ============================================================================

-- ============================================================================
-- 1. WHATSAPP_SESSIONS — estado conversacional por número de telefone
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  phone text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'idle',
  context jsonb DEFAULT '{}'::jsonb,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(barbershop_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_barbershop ON public.whatsapp_sessions(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_state ON public.whatsapp_sessions(state);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_sessions_all" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_all" ON public.whatsapp_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = whatsapp_sessions.barbershop_id
    )
  );

-- ============================================================================
-- 2. WHATSAPP_MESSAGES — log de mensagens recebidas/enviadas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,
  direction text NOT NULL,
  phone text NOT NULL,
  body text,
  meta_message_id text,
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_barbershop ON public.whatsapp_messages(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session ON public.whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_messages(created_at);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_messages_all" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_all" ON public.whatsapp_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.barbershop_id = whatsapp_messages.barbershop_id
    )
  );

-- ============================================================================
-- 3. BARBERSHOPS — colunas Mercado Pago
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name='mp_config') THEN
    ALTER TABLE public.barbershops ADD COLUMN mp_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- 4. COMANDAS — coluna mp_preference_id (link de pagamento online)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comandas' AND column_name='mp_preference_id') THEN
    ALTER TABLE public.comandas ADD COLUMN mp_preference_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comandas' AND column_name='mp_init_point') THEN
    ALTER TABLE public.comandas ADD COLUMN mp_init_point text;
  END IF;
END $$;

-- ============================================================================
-- FINAL
-- ============================================================================
SELECT
  'Migration semana 7 aplicada' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('whatsapp_sessions', 'whatsapp_messages')) as tabelas_whatsapp,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='barbershops' AND column_name='mp_config') as col_mp_config,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='comandas' AND column_name IN ('mp_preference_id', 'mp_init_point')) as cols_mp_comandas;
