-- ============================================================
-- FECHAMENTO ADMINISTRATIVO ATOMICO + ESTOQUE SEM CORRIDA
-- ============================================================
-- O fechamento pela gestao escrevia em 5 tabelas, uma por vez: se falhasse no
-- meio, ficava comanda fechada sem pagamento, ou credito gasto sem comanda.
-- Aqui ou tudo acontece, ou nada acontece, no mesmo desenho da
-- painel_fechar_comanda que o barbeiro ja usa.
--
-- O calculo (desconto, taxa, quanto o credito cobre) continua no aplicativo,
-- que e testado; o banco recebe o resultado pronto e garante a transacao.
--
-- O codigo do aplicativo ja esta preparado: enquanto esta migracao nao roda,
-- ele usa o caminho antigo com trava de corrida; depois dela, passa sozinho
-- a usar a transacao. Pode colar a qualquer momento.

-- ------------------------------------------------------------
-- 1. Fechamento atomico da gestao
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_fechar_comanda(
  p_comanda_id       uuid,
  p_barbershop_id    uuid,
  p_discount_percent numeric,
  p_total            numeric,
  p_card_fee_total   numeric,
  p_net_total        numeric,
  -- [{"method":"pix","amount":50,"installments":1,"fee_percent":0,"fee_value":0,"net_amount":50}, ...]
  p_pagamentos       jsonb,
  -- [{"credit_id":"...","amount":30}, ...] (vazio quando nao ha credito)
  p_usos_credito     jsonb,
  -- o que saiu do bolso do cliente (total menos credito): e o que soma no gasto dele
  p_saiu_do_bolso    numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pag     jsonb;
  v_uso     jsonb;
BEGIN
  SELECT * INTO v_comanda
    FROM public.comandas
   WHERE id = p_comanda_id
     AND barbershop_id = p_barbershop_id
     FOR UPDATE;

  IF v_comanda.id IS NULL THEN
    RAISE EXCEPTION 'NAO_ENCONTRADA';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'JA_FECHADA';
  END IF;

  UPDATE public.comandas
     SET status = 'closed',
         discount_type = 'percentage',
         discount_value = p_discount_percent,
         total = p_total,
         card_fee_total = p_card_fee_total,
         net_total = p_net_total,
         closed_at = now(),
         updated_at = now()
   WHERE id = p_comanda_id;

  FOR v_pag IN SELECT * FROM jsonb_array_elements(COALESCE(p_pagamentos, '[]'::jsonb))
  LOOP
    INSERT INTO public.comanda_payments (
      barbershop_id, comanda_id, method, amount, installments,
      fee_percent, fee_value, net_amount
    ) VALUES (
      p_barbershop_id,
      p_comanda_id,
      (v_pag->>'method')::payment_method,
      (v_pag->>'amount')::numeric,
      COALESCE((v_pag->>'installments')::int, 1),
      COALESCE((v_pag->>'fee_percent')::numeric, 0),
      COALESCE((v_pag->>'fee_value')::numeric, 0),
      (v_pag->>'net_amount')::numeric
    );
  END LOOP;

  FOR v_uso IN SELECT * FROM jsonb_array_elements(COALESCE(p_usos_credito, '[]'::jsonb))
  LOOP
    INSERT INTO public.customer_credit_uses (
      barbershop_id, credit_id, customer_id, comanda_id, amount
    ) VALUES (
      p_barbershop_id,
      (v_uso->>'credit_id')::uuid,
      v_comanda.customer_id,
      p_comanda_id,
      (v_uso->>'amount')::numeric
    );
  END LOOP;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'completed',
           completed_at = now(),
           comanda_id = p_comanda_id
     WHERE id = v_comanda.appointment_id
       AND barbershop_id = p_barbershop_id;
  END IF;

  IF v_comanda.customer_id IS NOT NULL THEN
    -- Soma relativa (coluna = coluna + valor): dois fechamentos de comandas
    -- diferentes do mesmo cliente nao se atropelam.
    UPDATE public.customers
       SET total_appointments = COALESCE(total_appointments, 0) + 1,
           total_spent = COALESCE(total_spent, 0) + COALESCE(p_saiu_do_bolso, 0),
           last_visit_at = now()
     WHERE id = v_comanda.customer_id
       AND barbershop_id = p_barbershop_id;
  END IF;

  RETURN v_comanda.customer_id;
END $$;

-- So o servidor chama; ninguem de fora executa isto pela porta REST.
REVOKE EXECUTE ON FUNCTION public.admin_fechar_comanda(uuid, uuid, numeric, numeric, numeric, numeric, jsonb, jsonb, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_fechar_comanda(uuid, uuid, numeric, numeric, numeric, numeric, jsonb, jsonb, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_fechar_comanda(uuid, uuid, numeric, numeric, numeric, numeric, jsonb, jsonb, numeric) FROM authenticated;

-- ------------------------------------------------------------
-- 2. Estoque sem corrida
-- ------------------------------------------------------------
-- O aplicativo lia o estoque, somava em JavaScript e gravava o resultado:
-- duas vendas ao mesmo tempo contavam errado. Aqui a conta acontece dentro
-- do banco, numa instrucao so.
CREATE OR REPLACE FUNCTION public.ajustar_estoque(
  p_product_id    uuid,
  p_barbershop_id uuid,
  p_delta         integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo integer;
BEGIN
  UPDATE public.products
     SET stock_current = GREATEST(0, COALESCE(stock_current, 0) + p_delta),
         updated_at = now()
   WHERE id = p_product_id
     AND barbershop_id = p_barbershop_id
  RETURNING stock_current INTO v_novo;

  IF v_novo IS NULL THEN
    RAISE EXCEPTION 'PRODUTO_NAO_ENCONTRADO';
  END IF;

  RETURN v_novo;
END $$;

REVOKE EXECUTE ON FUNCTION public.ajustar_estoque(uuid, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ajustar_estoque(uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ajustar_estoque(uuid, uuid, integer) FROM authenticated;

-- ------------------------------------------------------------
-- 3. Fecha as duas policies de leitura aberta que a auditoria apontou
-- ------------------------------------------------------------
-- As telas leem estas tabelas pelo servidor; ninguem precisa delas pela
-- porta REST. Se a policy nao existir, o DROP so avisa e segue.
DROP POLICY IF EXISTS subscription_plans_select ON public.subscription_plans;
DROP POLICY IF EXISTS loyalty_rewards_select ON public.loyalty_rewards;

-- ------------------------------------------------------------
-- 4. Verificacao
-- ------------------------------------------------------------
SELECT routine_name
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name IN ('admin_fechar_comanda', 'ajustar_estoque');
