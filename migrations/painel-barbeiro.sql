-- ============================================================
-- PAINEL DO BARBEIRO
-- Area /painel com permissao por pessoa.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas de acesso em staff
-- ------------------------------------------------------------
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS can_manage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.staff.can_manage IS
  'Acesso de gestao: entra no /admin completo. Quem nao tem, cai no /painel.';
COMMENT ON COLUMN public.staff.permissions IS
  'Modulos do painel: financeiro, vales_ver, vales_pedir, agenda_operar, comanda, clientes. Chave ausente = desligado.';
COMMENT ON COLUMN public.staff.must_change_password IS
  'Senha definida pelo gestor. Enquanto true, o painel so mostra a troca de senha.';

-- ------------------------------------------------------------
-- 2. Backfill: proprietario ativo vira gestor
-- ------------------------------------------------------------
UPDATE public.staff
   SET can_manage = true
 WHERE role = 'owner'
   AND active = true
   AND fired_at IS NULL
   AND can_manage = false;

-- Trava de seguranca: se ninguem ficou com gestao, aborta a migration
-- inteira. Sem isso, a trava do /admin sobe e ninguem mais entra.
DO $$
DECLARE
  gestores integer;
BEGIN
  SELECT count(*) INTO gestores
    FROM public.staff
   WHERE can_manage = true AND active = true AND fired_at IS NULL;

  IF gestores = 0 THEN
    RAISE EXCEPTION
      'Nenhum profissional ativo ficou com acesso de gestao. Ajuste o papel do dono antes de aplicar.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Um profissional ativo por usuario
-- Sem isso, requireStaff() poderia resolver o staff errado.
-- ------------------------------------------------------------
DO $$
DECLARE
  duplicados integer;
BEGIN
  SELECT count(*) INTO duplicados
    FROM (
      SELECT profile_id
        FROM public.staff
       WHERE active = true AND fired_at IS NULL AND profile_id IS NOT NULL
       GROUP BY profile_id
      HAVING count(*) > 1
    ) d;

  IF duplicados > 0 THEN
    RAISE EXCEPTION
      'Existem % usuarios ligados a mais de um profissional ativo. Resolva antes de aplicar.', duplicados;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_one_active_per_profile
  ON public.staff (profile_id)
  WHERE active = true AND fired_at IS NULL AND profile_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Vale: um pendente por profissional e valor positivo
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS allowances_one_pending_per_staff
  ON public.allowances (staff_id)
  WHERE status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allowances_amount_positive'
  ) THEN
    ALTER TABLE public.allowances
      ADD CONSTRAINT allowances_amount_positive CHECK (amount > 0);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Auditoria de acesso
-- Quem mexeu em permissao de quem, e quando.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_access_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  actor_staff_id uuid REFERENCES public.staff (id) ON DELETE SET NULL,
  action        text NOT NULL,
  before_value  jsonb,
  after_value   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_access_log_staff_idx
  ON public.staff_access_log (staff_id, created_at DESC);

ALTER TABLE public.staff_access_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. Alteracao de acesso em transacao, com trava anti-lockout
-- Dois gestores removendo acesso ao mesmo tempo nao conseguem
-- zerar a gestao: o lock serializa e o segundo recebe erro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_staff_access(
  p_staff_id     uuid,
  p_can_manage   boolean,
  p_permissions  jsonb,
  p_actor_staff_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before   jsonb;
  v_active   boolean;
  v_fired    timestamptz;
  v_gestores integer;
BEGIN
  -- Trava a linha alvo e as linhas de gestao para contagem consistente
  SELECT jsonb_build_object('can_manage', can_manage, 'permissions', permissions),
         active, fired_at
    INTO v_before, v_active, v_fired
    FROM public.staff
   WHERE id = p_staff_id
     FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Profissional nao encontrado.';
  END IF;

  IF p_can_manage AND (v_active = false OR v_fired IS NOT NULL) THEN
    RAISE EXCEPTION 'Profissional inativo nao pode receber acesso de gestao.';
  END IF;

  PERFORM 1
     FROM public.staff
    WHERE can_manage = true AND active = true AND fired_at IS NULL
      FOR UPDATE;

  UPDATE public.staff
     SET can_manage  = p_can_manage,
         permissions = COALESCE(p_permissions, '{}'::jsonb),
         updated_at  = now()
   WHERE id = p_staff_id;

  SELECT count(*) INTO v_gestores
    FROM public.staff
   WHERE can_manage = true AND active = true AND fired_at IS NULL;

  IF v_gestores = 0 THEN
    RAISE EXCEPTION 'A barbearia ficaria sem nenhum acesso de gestao. Libere outra pessoa antes.';
  END IF;

  INSERT INTO public.staff_access_log (staff_id, actor_staff_id, action, before_value, after_value)
  VALUES (
    p_staff_id,
    p_actor_staff_id,
    'set_access',
    v_before,
    jsonb_build_object('can_manage', p_can_manage, 'permissions', COALESCE(p_permissions, '{}'::jsonb))
  );
END $$;

-- A mesma trava vale para desativar profissional: nao pode sobrar zero gestor
CREATE OR REPLACE FUNCTION public.guard_last_manager()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_gestores integer;
BEGIN
  IF (NEW.active = false OR NEW.fired_at IS NOT NULL) AND OLD.can_manage = true THEN
    SELECT count(*) INTO v_gestores
      FROM public.staff
     WHERE can_manage = true AND active = true AND fired_at IS NULL
       AND id <> NEW.id;

    IF v_gestores = 0 THEN
      RAISE EXCEPTION 'Este e o unico acesso de gestao ativo. Libere outra pessoa antes de desativar.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_guard_last_manager ON public.staff;
CREATE TRIGGER staff_guard_last_manager
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_last_manager();

-- ------------------------------------------------------------
-- 7. Consumo de assinatura com trava
-- Dois barbeiros em abas diferentes nao podem gastar o mesmo
-- ultimo uso do ciclo. A contagem acontece dentro do lock.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_subscription_use(
  p_subscription_id uuid,
  p_included_uses   integer,
  p_barbershop_id   uuid,
  p_staff_id        uuid,
  p_service_id      uuid,
  p_comanda_id      uuid,
  p_comanda_item_id uuid,
  p_value_saved     numeric,
  p_period_start    timestamptz,
  p_period_end      timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usados integer;
  v_id     uuid;
BEGIN
  PERFORM 1 FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;

  SELECT count(*) INTO v_usados
    FROM public.subscription_usages
   WHERE subscription_id = p_subscription_id
     AND settled_payout_id IS NULL;

  IF v_usados >= p_included_uses THEN
    RAISE EXCEPTION 'SEM_SALDO:%/%', v_usados, p_included_uses;
  END IF;

  INSERT INTO public.subscription_usages (
    barbershop_id, subscription_id, staff_id, service_id,
    comanda_id, comanda_item_id, value_saved, period_start, period_end, used_at
  ) VALUES (
    p_barbershop_id, p_subscription_id, p_staff_id, p_service_id,
    p_comanda_id, p_comanda_item_id, p_value_saved, p_period_start, p_period_end, now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- ------------------------------------------------------------
-- 8. Verificacao final
-- ------------------------------------------------------------
SELECT display_name, role, active, can_manage, permissions, must_change_password
  FROM public.staff
 ORDER BY can_manage DESC, display_name;
