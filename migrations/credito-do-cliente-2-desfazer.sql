-- ============================================================
-- CREDITO DO CLIENTE, PARTE 2: desfazer o fechamento
--
-- Rodar depois de credito-do-cliente.sql.
--
-- Quando a gestao reabre ou estorna uma comanda, o sistema desfaz tudo o que o
-- fechamento fez. Com credito entram duas coisas nessa conta:
--
--  1. O credito gasto volta para o cliente. Sem isso, reabrir uma comanda
--     queimaria o saldo dele sem entregar nada.
--
--  2. O total_spent do cliente devolve so o que saiu do bolso dele. Uma comanda
--     pode ter sido paga metade com credito e metade no cartao (credito paga
--     servico; produto e gorjeta o cliente paga normal). No fechamento so a
--     parte paga com dinheiro foi somada, entao so ela pode ser subtraida.
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

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
  v_credito numeric;
  v_do_bolso numeric;
BEGIN
  SELECT * INTO v_comanda FROM public.comandas WHERE id = p_comanda_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_credito
    FROM public.comanda_payments
   WHERE comanda_id = p_comanda_id
     AND method = 'store_credit';

  v_do_bolso := GREATEST(0, COALESCE(v_comanda.total, 0) - v_credito);

  -- Cliente: devolve o atendimento sempre; do valor, so o que ele pagou
  IF v_comanda.customer_id IS NOT NULL THEN
    UPDATE public.customers
       SET total_appointments = GREATEST(0, COALESCE(total_appointments, 0) - 1),
           total_spent = GREATEST(0, COALESCE(total_spent, 0) - v_do_bolso)
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

  -- Credito gasto volta para o saldo do cliente
  DELETE FROM public.customer_credit_uses WHERE comanda_id = p_comanda_id;

  -- Pagamento registrado no fechamento
  DELETE FROM public.comanda_payments WHERE comanda_id = p_comanda_id;

  -- Atendimento volta a ficar em aberto
  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'confirmed',
           completed_at = NULL
     WHERE id = v_comanda.appointment_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.desfazer_efeitos_do_fechamento(uuid) IS
  'Desfaz tudo o que o fechamento da comanda fez: cliente, pontos, credito, pagamento e atendimento.';

-- ------------------------------------------------------------
-- CONFERENCIA
-- ------------------------------------------------------------
select 'funcao atualizada' as ok;
