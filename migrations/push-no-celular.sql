-- ============================================================
-- PUSH NO CELULAR
--
-- Ate agora nenhum aviso tocava no aparelho de ninguem: tudo so aparecia
-- quando a pessoa abria o aplicativo. Para o barbeiro isso e pouco, porque a
-- informacao que importa (cliente confirmou, cliente cancelou, cliente novo na
-- agenda) so vale se chegar na hora.
--
-- Esta tabela guarda o "endereco" que cada aparelho da ao navegador para
-- receber aviso. Um endereco por aparelho: a mesma pessoa no celular e no
-- computador tem duas linhas, e as duas tocam.
--
-- O endereco nao e segredo por si so, mas so vale com a chave privada da
-- barbearia, que fica no servidor. Ainda assim a tabela nasce fechada, como o
-- resto do banco.
--
-- Idempotente: pode rodar mais de uma vez.
-- Rodar no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,

  -- De quem e o aparelho. Um login pode ser das duas pontas (quem trabalha
  -- aqui tambem corta cabelo aqui), por isso a chave e o usuario, e nao o
  -- cadastro de equipe ou a ficha de cliente.
  user_id uuid not null,

  endpoint text not null,
  p256dh text not null,
  auth text not null,

  -- Ajuda a entender de qual aparelho veio, quando alguem reclamar que nao
  -- recebeu nada
  user_agent text,

  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  -- O mesmo aparelho nao pode aparecer duas vezes: o navegador devolve sempre
  -- o mesmo endereco, e sem isto a pessoa receberia o aviso repetido
  unique (endpoint)
);

comment on table public.push_subscriptions is
  'Aparelhos que aceitaram receber aviso. Uma linha por aparelho, nao por pessoa.';

create index if not exists idx_push_por_usuario
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated, public;

-- ------------------------------------------------------------
-- CONFERENCIA
-- ------------------------------------------------------------
select count(*) as aparelhos from public.push_subscriptions;
