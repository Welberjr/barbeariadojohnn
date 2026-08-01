-- ============================================================
-- CREDITO DO CLIENTE, PARTE 3: fechar com credito no painel do barbeiro
--
-- Rodar depois de credito-do-cliente-2-desfazer.sql.
--
-- O barbeiro fecha a comanda dele por uma transacao so (painel_fechar_comanda):
-- comanda, pagamento, atendimento e cliente mudam juntos ou nao mudam. Se a
-- baixa do credito ficasse fora dessa transacao, uma falha no meio deixaria o
-- cliente sem saldo e sem comanda fechada, ou pior, comanda paga com credito e
-- saldo intacto.
--
-- Por isso a funcao passa a receber:
--
--   p_creditos     de quais creditos tirar e quanto de cada um. Quem monta a
--                  lista e o codigo, que conhece as regras de validade; aqui so
--                  gravamos.
--   p_metodo_resto como o cliente paga o que o credito nao cobre. Credito paga
--                  servico: produto e gorjeta saem do bolso dele.
--
-- Os dois tem valor padrao, entao a chamada antiga continua funcionando.
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- A versao antiga tem 9 parametros. Se ela continuasse no banco, a chamada com
-- 9 argumentos serviria nas duas e o Postgres recusaria por ambiguidade.
DROP FUNCTION IF EXISTS public.painel_fechar_comanda(
  uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric
);

CREATE OR REPLACE FUNCTION public.painel_fechar_comanda(
  p_comanda_id    uuid,
  p_staff_id      uuid,
  p_closed_by     uuid,
  p_metodo        text,
  p_subtotal      numeric,
  p_total         numeric,
  p_taxa_percent  numeric,
  p_taxa_valor    numeric,
  p_liquido       numeric,
  p_creditos      jsonb DEFAULT '[]'::jsonb,
  p_metodo_resto  text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda   public.comandas%ROWTYPE;
  v_credito   numeric := 0;
  v_resto     numeric := 0;
  v_item      jsonb;
BEGIN
  SELECT * INTO v_comanda
    FROM public.comandas
   WHERE id = p_comanda_id
     AND staff_id = p_staff_id
     FOR UPDATE;

  IF v_comanda.id IS NULL THEN
    RAISE EXCEPTION 'NAO_E_SUA';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'JA_FECHADA';
  END IF;

  SELECT COALESCE(SUM((x->>'amount')::numeric), 0)
    INTO v_credito
    FROM jsonb_array_elements(COALESCE(p_creditos, '[]'::jsonb)) AS x;

  IF v_credito > p_total THEN
    RAISE EXCEPTION 'CREDITO_MAIOR_QUE_TOTAL';
  END IF;

  v_resto := p_total - v_credito;

  IF v_credito > 0 AND v_resto > 0 AND p_metodo_resto IS NULL THEN
    RAISE EXCEPTION 'FALTA_METODO_DO_RESTO';
  END IF;

  UPDATE public.comandas
     SET status = 'closed',
         discount_type = 'percentage',
         discount_value = 0,
         subtotal = p_subtotal,
         total = p_total,
         card_fee_total = p_taxa_valor,
         net_total = p_liquido,
         closed_at = now(),
         closed_by = p_closed_by,
         updated_at = now()
   WHERE id = p_comanda_id;

  IF v_credito > 0 THEN
    -- Baixa de cada credito usado, dentro da mesma transacao do fechamento
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_creditos)
    LOOP
      INSERT INTO public.customer_credit_uses (
        barbershop_id, credit_id, customer_id, comanda_id, amount
      ) VALUES (
        v_comanda.barbershop_id,
        (v_item->>'credit_id')::uuid,
        v_comanda.customer_id,
        p_comanda_id,
        (v_item->>'amount')::numeric
      );
    END LOOP;

    INSERT INTO public.comanda_payments (
      barbershop_id, comanda_id, method, amount, installments,
      fee_percent, fee_value, net_amount
    ) VALUES (
      v_comanda.barbershop_id, p_comanda_id, 'store_credit'::payment_method,
      v_credito, 1, 0, 0, v_credito
    );

    IF v_resto > 0 THEN
      INSERT INTO public.comanda_payments (
        barbershop_id, comanda_id, method, amount, installments,
        fee_percent, fee_value, net_amount
      ) VALUES (
        v_comanda.barbershop_id, p_comanda_id, p_metodo_resto::payment_method,
        v_resto, 1, p_taxa_percent, p_taxa_valor, v_resto - p_taxa_valor
      );
    END IF;
  ELSE
    INSERT INTO public.comanda_payments (
      barbershop_id, comanda_id, method, amount, installments,
      fee_percent, fee_value, net_amount
    ) VALUES (
      v_comanda.barbershop_id, p_comanda_id, p_metodo::payment_method, p_total, 1,
      p_taxa_percent, p_taxa_valor, p_liquido
    );
  END IF;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'completed',
           completed_at = now(),
           comanda_id = p_comanda_id
     WHERE id = v_comanda.appointment_id
       AND staff_id = p_staff_id;
  END IF;

  -- O cliente so "gastou" o que saiu do bolso dele
  IF v_comanda.customer_id IS NOT NULL THEN
    UPDATE public.customers
       SET total_appointments = COALESCE(total_appointments, 0) + 1,
           total_spent = COALESCE(total_spent, 0) + v_resto,
           last_visit_at = now()
     WHERE id = v_comanda.customer_id;
  END IF;

  RETURN v_comanda.customer_id;
END $$;

-- ------------------------------------------------------------
-- CONFERENCIA
-- ------------------------------------------------------------
SELECT routine_name
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name = 'painel_fechar_comanda';
