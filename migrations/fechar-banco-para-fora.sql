-- ============================================================
-- FECHAR O BANCO PARA QUEM CHEGA DE FORA
--
-- O PROBLEMA (achado em 01/08/2026, testando de verdade)
--
-- Qualquer pessoa que criasse uma conta de cliente no aplicativo conseguia
-- ler o banco inteiro por fora da tela, batendo direto na porta de dados com
-- a chave publica do site, que vai no codigo de toda pagina e nao e segredo.
--
-- Medido com um usuario recem-criado, sem vinculo nenhum com a barbearia:
--
--   412 clientes, com nome, telefone e quanto cada um ja gastou
--   1.000 comandas, com R$ 65.072,50 de faturamento
--   7 pessoas da equipe, com a comissao de cada uma e quem tem gestao
--   todos os agendamentos
--
-- Ou seja: um concorrente criava conta no aplicativo e baixava a carteira de
-- clientes da barbearia com telefone e valor gasto. Alem do prejuizo obvio,
-- e dado pessoal de 412 pessoas que a barbearia responde por guardar.
--
-- POR QUE ACONTECIA
--
-- As tabelas tem RLS ligado, mas com regra permissiva para quem esta logado:
-- a regra olhava "esta autenticado?" em vez de "esta linha e sua?". Quem
-- entra pela tela nunca ve isso, porque a tela so pede o que interessa. A
-- porta de dados nao tem tela: ela entrega o que voce pedir.
--
-- A CORRECAO
--
-- O nosso sistema nunca le tabela pelo navegador: toda tela e montada no
-- servidor, com a credencial de servico, e o navegador so recebe o resultado
-- pronto. O unico uso do banco pelo navegador e entrar e sair da conta, que
-- acontece noutro lugar (schema auth) e nao e tocado aqui.
--
-- Entao a porta de dados pode ser fechada por completo para os papeis de fora.
-- Isso e mais forte do que arrumar regra por regra: sem permissao, nao existe
-- regra permissiva que valha, nem em tabela que alguem criar amanha e esquecer
-- de proteger.
--
-- Idempotente: pode rodar mais de uma vez.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tirar o acesso direto as tabelas de dados
--
-- Revogar de PUBLIC nao basta: cada papel precisa ser nomeado, senao a
-- permissao continua valendo pelo caminho do outro.
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all tables in schema public from public;

revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;
revoke all on all sequences in schema public from public;

-- As funcoes do sistema (fechar comanda, usar assinatura, reabrir) sao
-- chamadas pelo servidor, nunca pelo navegador.
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from authenticated;
revoke all on all functions in schema public from public;

-- ------------------------------------------------------------
-- 2. Fechar tambem o que for criado daqui para frente
--
-- Sem isto, a proxima tabela nasce aberta e ninguem lembra de fechar.
-- ------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;

-- ------------------------------------------------------------
-- 3. Manter a porta do proprio schema, sem dar nada dentro dele
--
-- Sem o uso do schema, a porta de dados devolve erro de configuracao em vez
-- de "vazio", e o Supabase reclama na inicializacao. Uso do schema sozinho
-- nao da acesso a tabela nenhuma.
-- ------------------------------------------------------------
grant usage on schema public to anon;
grant usage on schema public to authenticated;

-- ------------------------------------------------------------
-- 4. Deixar o RLS ligado de qualquer jeito
--
-- Cinto e suspensorio: se algum dia alguem devolver permissao sem pensar, o
-- RLS ainda esta la barrando.
-- ------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select tablename
      from pg_tables
     where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- CONFERENCIA
--
-- Depois de rodar, o comando abaixo tem que voltar VAZIO. Se voltar alguma
-- linha, aquela tabela ainda esta aberta para quem vem de fora.
-- ------------------------------------------------------------
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated', 'PUBLIC')
 order by table_name;
