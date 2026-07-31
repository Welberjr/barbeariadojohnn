-- ============================================================
-- CORRIGIR COMANDA FECHADA
--
-- Dois caminhos, combinados em 31/07/2026:
--
--  1. REABRIR (barbeiro, ate 1 hora depois de fechar)
--     Errou e percebeu na hora: a comanda volta a ficar aberta, ele corrige
--     e fecha de novo. Passou de 1 hora, ele nao mexe mais.
--
--  2. ESTORNAR (gestao, a qualquer momento)
--     A comanda fica marcada como estornada, com motivo e autor, e tudo o
--     que o fechamento fez e desfeito. Nada e apagado: excluir movimento e
--     o que faz o caixa nao bater sem ninguem saber explicar.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Registro do estorno na propria comanda
-- ------------------------------------------------------------
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid;

COMMENT ON COLUMN public.comandas.reversed_at IS
  'Quando a comanda foi estornada pela gestao.';
COMMENT ON COLUMN public.comandas.reversal_reason IS
  'Por que foi estornada. Obrigatorio no estorno, e o que explica o caixa depois.';
COMMENT ON COLUMN public.comandas.reopened_at IS
  'Ultima vez que a comanda foi reaberta para correcao.';

-- ------------------------------------------------------------
-- 2. Desfazer os efeitos de um fechamento
-- Usada pelos dois caminhos, para nao existir duas versoes da mesma conta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desfazer_efeitos_do_fechamento(
  p_comanda_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pontos  integer;
BEGIN
  SELECT * INTO v_comanda FROM public.comandas WHERE id = p_comanda_id;

  -- Cliente: devolve o atendimento e o valor somados no fechamento
  IF v_comanda.customer_id IS NOT NULL THEN
    UPDATE public.customers
       SET total_appointments = GREATEST(0, COALESCE(total_appointments, 0) - 1),
           total_spent = GREATEST(0, COALESCE(total_spent, 0) - COALESCE(v_comanda.total, 0))
     WHERE id = v_comanda.customer_id;

    -- Fidelidade: tira os pontos que esta comanda gerou
    SELECT COALESCE(SUM(points), 0) INTO v_pontos
      FROM public.loyalty_points_events
     WHERE comanda_id = p_comanda_id;

    IF v_pontos <> 0 THEN
      UPDATE public.loyalty_points
         SET balance = GREATEST(0, balance - v_pontos),
             lifetime_earned = GREATEST(0, lifetime_earned - v_pontos),
             updated_at = now()
       WHERE customer_id = v_comanda.customer_id;

      UPDATE public.customers
         SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - v_pontos)
       WHERE id = v_comanda.customer_id;

      DELETE FROM public.loyalty_points_events WHERE comanda_id = p_comanda_id;
      DELETE FROM public.loyalty_transactions WHERE comanda_id = p_comanda_id;
    END IF;
  END IF;

  -- Pagamento registrado no fechamento
  DELETE FROM public.comanda_payments WHERE comanda_id = p_comanda_id;

  -- Atendimento volta a ficar em aberto
  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'confirmed',
           completed_at = NULL
     WHERE id = v_comanda.appointment_id;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Reabrir para correcao (barbeiro, janela de 1 hora)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reabrir_comanda(
  p_comanda_id uuid,
  p_staff_id   uuid,
  p_ator       uuid,
  p_janela_minutos integer DEFAULT 60
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda public.comandas%ROWTYPE;
BEGIN
  SELECT * INTO v_comanda
    FROM public.comandas
   WHERE id = p_comanda_id
     FOR UPDATE;

  IF v_comanda.id IS NULL THEN
    RAISE EXCEPTION 'NAO_ENCONTRADA';
  END IF;

  -- p_staff_id nulo significa gestao: nao precisa ser o dono
  IF p_staff_id IS NOT NULL AND v_comanda.staff_id <> p_staff_id THEN
    RAISE EXCEPTION 'NAO_E_SUA';
  END IF;

  IF v_comanda.status <> 'closed' THEN
    RAISE EXCEPTION 'NAO_ESTA_FECHADA';
  END IF;

  IF p_staff_id IS NOT NULL
     AND v_comanda.closed_at < now() - make_interval(mins => p_janela_minutos) THEN
    RAISE EXCEPTION 'FORA_DA_JANELA';
  END IF;

  PERFORM public.desfazer_efeitos_do_fechamento(p_comanda_id);

  UPDATE public.comandas
     SET status = 'open',
         closed_at = NULL,
         closed_by = NULL,
         card_fee_total = 0,
         net_total = subtotal,
         total = subtotal,
         reopened_at = now(),
         reopened_by = p_ator,
         updated_at = now()
   WHERE id = p_comanda_id;
END $$;

-- ------------------------------------------------------------
-- 4. Estornar (gestao)
-- A comanda sai do faturamento, mas continua existindo e explicada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estornar_comanda(
  p_comanda_id uuid,
  p_ator       uuid,
  p_motivo     text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_item    RECORD;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'MOTIVO_OBRIGATORIO';
  END IF;

  SELECT * INTO v_comanda
    FROM public.comandas
   WHERE id = p_comanda_id
     FOR UPDATE;

  IF v_comanda.id IS NULL THEN
    RAISE EXCEPTION 'NAO_ENCONTRADA';
  END IF;

  IF v_comanda.status <> 'closed' THEN
    RAISE EXCEPTION 'NAO_ESTA_FECHADA';
  END IF;

  PERFORM public.desfazer_efeitos_do_fechamento(p_comanda_id);

  -- Produtos voltam para o estoque
  FOR v_item IN
    SELECT product_id, quantity
      FROM public.comanda_items
     WHERE comanda_id = p_comanda_id
       AND item_type = 'product'
       AND product_id IS NOT NULL
  LOOP
    UPDATE public.products
       SET stock_current = COALESCE(stock_current, 0) + COALESCE(v_item.quantity, 0),
           updated_at = now()
     WHERE id = v_item.product_id;
  END LOOP;

  -- Usos de assinatura voltam para o ciclo do cliente, se ainda nao foram
  -- acertados no fechamento do potinho
  DELETE FROM public.subscription_usages
   WHERE comanda_id = p_comanda_id
     AND settled_payout_id IS NULL;

  UPDATE public.comandas
     SET status = 'cancelled',
         reversed_at = now(),
         reversed_by = p_ator,
         reversal_reason = trim(p_motivo),
         updated_at = now()
   WHERE id = p_comanda_id;
END $$;

-- ------------------------------------------------------------
-- 5. Verificacao
-- ------------------------------------------------------------
SELECT routine_name
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name IN ('reabrir_comanda', 'estornar_comanda', 'desfazer_efeitos_do_fechamento')
 ORDER BY routine_name;
