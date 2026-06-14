-- ============================================================
-- Taxa de cartao de DEBITO (separada da de credito)
-- Tela: /admin/configuracoes (secao Regras Financeiras)
-- Aplicada no fechamento da comanda (closeComanda) em
-- card_fee_total / net_total e nos campos do pagamento.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'barbershops'
      AND column_name = 'debit_fee_percent'
  ) THEN
    ALTER TABLE public.barbershops
      ADD COLUMN debit_fee_percent numeric DEFAULT 0;
  END IF;
END $$;

-- Verificacao
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'barbershops'
  AND column_name IN ('credit_fee_percent', 'debit_fee_percent')
ORDER BY column_name;
