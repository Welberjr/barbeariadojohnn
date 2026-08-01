-- ============================================================
-- CREDITO DO CLIENTE
--
-- Dinheiro que o cliente tem para gastar na barbearia sem passar cartao: uma
-- permuta, um vale-presente, uma cortesia, um acerto de servico prestado. O
-- primeiro caso e o do Welber, que entregou o sistema e ficou com R$ 1.000 para
-- usar entre 02/08/2026 e 02/08/2027.
--
-- Duas coisas que o desenho resolve desde o comeco:
--
--  1. VALIDADE. Credito quase sempre tem prazo. Guardar so o saldo faria o
--     sistema aceitar um credito vencido, e a barbearia so descobriria depois.
--
--  2. DE ONDE VEIO O DINHEIRO. Credito usado nao e faturamento novo: quando o
--     Welber corta o cabelo com o credito dele, nao entrou dinheiro no caixa
--     naquele dia. Por isso o uso e registrado com forma de pagamento propria,
--     que o financeiro sabe separar do que e dinheiro de verdade. A comissao do
--     barbeiro sai normal: ele trabalhou igual.
--
-- Idempotente: pode rodar mais de uma vez.
-- Rodar no SQL Editor do Supabase (projeto vctxrowevcbfamwomrmw).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Forma de pagamento propria
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum
     where enumtypid = 'public.payment_method'::regtype
       and enumlabel = 'store_credit'
  ) then
    alter type public.payment_method add value 'store_credit';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. O credito concedido
-- ------------------------------------------------------------
create table if not exists public.customer_credits (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,

  amount numeric(10,2) not null check (amount > 0),
  reason text,

  starts_at date not null default current_date,
  expires_at date,

  granted_by uuid,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now()
);

comment on table public.customer_credits is
  'Credito que o cliente tem para gastar na barbearia. Cada linha e uma concessao.';
comment on column public.customer_credits.expires_at is
  'Ultimo dia de uso. Nulo significa credito sem prazo.';
comment on column public.customer_credits.cancelled_at is
  'Credito cancelado pela gestao. Nao e apagado: some do saldo mas fica no historico.';

create index if not exists idx_customer_credits_cliente
  on public.customer_credits (customer_id, cancelled_at);

-- ------------------------------------------------------------
-- 3. Cada uso do credito
--
-- Uma linha por vez que o cliente gastou. O saldo e o concedido menos o usado,
-- e nao um numero guardado que pode ficar errado sem ninguem perceber.
-- ------------------------------------------------------------
create table if not exists public.customer_credit_uses (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  credit_id uuid not null references public.customer_credits(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  comanda_id uuid references public.comandas(id) on delete set null,

  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

comment on table public.customer_credit_uses is
  'Cada vez que o cliente gastou do credito. O saldo sai da soma, nao de um campo guardado.';

create index if not exists idx_credit_uses_credito
  on public.customer_credit_uses (credit_id);
create index if not exists idx_credit_uses_comanda
  on public.customer_credit_uses (comanda_id);

-- ------------------------------------------------------------
-- 4. Fechar as portas, como o resto do banco
-- ------------------------------------------------------------
alter table public.customer_credits enable row level security;
alter table public.customer_credit_uses enable row level security;

revoke all on public.customer_credits from anon, authenticated, public;
revoke all on public.customer_credit_uses from anon, authenticated, public;

-- ------------------------------------------------------------
-- CONFERENCIA
-- ------------------------------------------------------------
select 'credito' as tabela, count(*) from public.customer_credits
union all
select 'usos', count(*) from public.customer_credit_uses;
