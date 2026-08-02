-- ============================================================
-- FRANQUIA: a mesma pessoa pode trabalhar em mais de uma unidade
--
-- Quando o painel do barbeiro foi feito, o sistema tinha uma loja so. Para
-- garantir que a busca do cadastro pelo login sempre achasse uma linha unica,
-- foi criada esta trava:
--
--   staff_one_active_per_profile: um cadastro ativo por pessoa
--
-- Ela era certa naquele momento e passa a ser errada agora. Com duas unidades,
-- o Johnn precisa ter um cadastro na loja de Taguatinga e outro na de Aguas
-- Claras, com o MESMO login: e assim que ele troca de unidade sem trocar de
-- senha. Do jeito que esta, abrir a segunda unidade falha na hora de dar acesso
-- a ela.
--
-- A trava certa e por unidade, e ela JA EXISTE no banco desde sempre:
--
--   staff_barbershop_id_profile_id_key: (barbershop_id, profile_id)
--
-- Ou seja: continua sendo impossivel a mesma pessoa ter dois cadastros na mesma
-- loja, que e o que realmente nao pode. O que passa a ser possivel e ela ter um
-- cadastro em cada loja.
--
-- O codigo ja esta pronto para isso: a busca do cadastro e a portaria passaram
-- a filtrar pela unidade escolhida, entao nao existe mais o risco de a consulta
-- achar duas linhas e a pessoa perder o acesso.
--
-- Idempotente: pode rodar mais de uma vez.
-- Rodar no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Conferencia antes de mexer
-- ------------------------------------------------------------
do $$
declare
  v_repetidos integer;
begin
  select count(*) into v_repetidos
    from (
      select profile_id, barbershop_id
        from public.staff
       where active = true and fired_at is null and profile_id is not null
       group by profile_id, barbershop_id
      having count(*) > 1
    ) d;

  if v_repetidos > 0 then
    raise exception
      'Existem % pessoas com mais de um cadastro ativo na MESMA loja. Resolva antes.', v_repetidos;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. A trava de rede sai; a de unidade fica
-- ------------------------------------------------------------
drop index if exists public.staff_one_active_per_profile;

-- Garante que a trava por unidade existe mesmo em bancos antigos
create unique index if not exists staff_um_ativo_por_pessoa_e_loja
  on public.staff (barbershop_id, profile_id)
  where active = true and fired_at is null and profile_id is not null;

comment on index public.staff_um_ativo_por_pessoa_e_loja is
  'Uma pessoa nao pode ter dois cadastros ativos na mesma unidade. Em unidades diferentes, pode.';

-- ------------------------------------------------------------
-- CONFERENCIA
-- ------------------------------------------------------------
select indexname
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'staff'
   and indexname in ('staff_one_active_per_profile', 'staff_um_ativo_por_pessoa_e_loja');
