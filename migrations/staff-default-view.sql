-- ============================================================
-- Preferencia de visualizacao padrao dos profissionais
-- Tela: /admin/profissionais  ·  Configuracao: /admin/configuracoes
-- Valores: 'cards' (padrao de fabrica) | 'lista'
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'barbershops'
      AND column_name = 'staff_default_view'
  ) THEN
    ALTER TABLE public.barbershops
      ADD COLUMN staff_default_view text DEFAULT 'cards';
  END IF;
END $$;

-- Verificacao
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'barbershops'
  AND column_name = 'staff_default_view';
