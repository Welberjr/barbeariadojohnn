-- ============================================================
-- QUEM ATENDE CLIENTE E QUEM SO ADMINISTRA
--
-- Nem todo mundo que tem acesso ao sistema corta cabelo. O dono pode cuidar
-- so do financeiro, e ainda assim precisa entrar no administrativo. Ate agora
-- o sistema decidia isso pelo cargo: barbeiro, dono e gerente apareciam na
-- agenda. So que o Jonathan e dono E atende, entao o cargo nao serve de
-- criterio.
--
-- O resultado era o cliente abrir o aplicativo e poder escolher, para cortar o
-- cabelo dele, alguem que nunca pegou numa maquina.
--
-- Idempotente: pode rodar mais de uma vez.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

alter table public.staff
  add column if not exists atende_clientes boolean not null default true;

comment on column public.staff.atende_clientes is
  'Aparece na agenda e pode ser escolhido pelo cliente. Quem so administra fica como false.';

-- Quem nao atende hoje na Barbearia do Johnn
update public.staff
   set atende_clientes = false
 where display_name in ('Welber', 'Welber Jr');

-- ------------------------------------------------------------
-- CONFERENCIA
-- ------------------------------------------------------------
select display_name, role, can_manage, atende_clientes
  from public.staff
 where active = true
 order by atende_clientes desc, display_name;
