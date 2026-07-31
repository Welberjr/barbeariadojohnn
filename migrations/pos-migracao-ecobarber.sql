-- ============================================================
-- O QUE FALTAVA EM RELACAO AO SISTEMA ANTIGO
--
-- Combinado em 31/07/2026, depois de comparar os dois sistemas:
--   1. clientes sumidos: marcar quem ja foi chamado de volta
--   2. confirmacao do atendimento pelo painel do cliente
--   3. jornada por barbeiro, com horario de almoco
--   4. agendamento em grupo
--
-- O bot de WhatsApp ficou de fora de proposito: o Johnn vai por uma pessoa
-- cuidando do WhatsApp.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Clientes sumidos: registro de quem ja foi chamado
-- Sem isso, duas pessoas ligam para o mesmo cliente no mesmo dia.
-- ------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS reactivation_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivation_contacted_by uuid,
  ADD COLUMN IF NOT EXISTS reactivation_notes text;

COMMENT ON COLUMN public.customers.reactivation_contacted_at IS
  'Ultima vez que a barbearia chamou este cliente de volta.';

CREATE INDEX IF NOT EXISTS customers_last_visit_idx
  ON public.customers (barbershop_id, last_visit_at DESC NULLS LAST)
  WHERE active = true;

-- ------------------------------------------------------------
-- 2. Confirmacao do atendimento pelo cliente
-- ------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by_customer_at timestamptz;

COMMENT ON COLUMN public.appointments.confirmation_requested_at IS
  'Quando o pedido de confirmacao foi enviado ao painel do cliente.';
COMMENT ON COLUMN public.appointments.confirmed_by_customer_at IS
  'Quando o proprio cliente confirmou presenca pelo painel dele.';

-- Quantas horas antes o cliente recebe o pedido de confirmacao
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS confirmation_hours_before integer NOT NULL DEFAULT 24;

COMMENT ON COLUMN public.barbershops.confirmation_hours_before IS
  'Horas de antecedencia do pedido de confirmacao. Zero desliga.';

-- ------------------------------------------------------------
-- 3. Jornada por profissional, com almoco
-- O horario da barbearia continua valendo como padrao: estas colunas so
-- entram quando o profissional tem horario proprio.
-- ------------------------------------------------------------
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS work_start time,
  ADD COLUMN IF NOT EXISTS work_end time,
  ADD COLUMN IF NOT EXISTS work_start_weekend time,
  ADD COLUMN IF NOT EXISTS work_end_weekend time,
  ADD COLUMN IF NOT EXISTS lunch_start time,
  ADD COLUMN IF NOT EXISTS lunch_end time;

COMMENT ON COLUMN public.staff.work_start IS
  'Entrada em dia de semana. Vazio significa seguir o horario da barbearia.';
COMMENT ON COLUMN public.staff.lunch_start IS
  'Inicio do almoco. A agenda para de oferecer encaixe nesse intervalo.';

-- ------------------------------------------------------------
-- 4. Agendamento em grupo
-- Dois servicos emendados, ou duas pessoas juntas, viram um bloco.
-- ------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS group_id uuid;

CREATE INDEX IF NOT EXISTS appointments_group_idx
  ON public.appointments (group_id)
  WHERE group_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.group_id IS
  'Liga atendimentos marcados juntos. Mesmo valor significa mesmo bloco.';

-- ------------------------------------------------------------
-- 5. Verificacao
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name LIKE 'reactivation%') AS colunas_reativacao,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'staff' AND (column_name LIKE 'work_%' OR column_name LIKE 'lunch_%')) AS colunas_jornada,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name IN ('group_id','confirmation_requested_at','confirmed_by_customer_at')) AS colunas_agendamento;
