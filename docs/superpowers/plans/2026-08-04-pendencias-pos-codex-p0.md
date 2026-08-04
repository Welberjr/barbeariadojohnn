# Pendencias Pos-Codex P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar escritas administrativas entre unidades e tornar o fechamento administrativo de comanda atômico e idempotente.

**Architecture:** Server Actions devem selecionar e escrever sempre com `barbershop_id = lojaAtual()`, recusando zero linhas afetadas. O fechamento administrativo passa para uma RPC que trava a comanda e grava comanda, pagamentos, créditos, atendimento e totais na mesma transação.

**Tech Stack:** Next.js 15, TypeScript, Supabase/PostgREST, PostgreSQL RPC, Vitest.

## Global Constraints

- Não criar, alterar ou apagar registros reais durante validação.
- WhatsApp e Mercado Pago permanecem inativos; este pacote não os ativa.
- Toda ação por ID deve devolver erro quando o registro não pertence à unidade atual.
- Todo código de produção nasce de teste automatizado em falha.

---

### Task 1: Contrato de posse da unidade

**Files:**

- Create: `src/lib/tenant-ownership.ts`
- Test: `src/lib/tenant-ownership.test.ts`
- Modify: `src/app/admin/agenda/actions.ts:333-350`

**Interfaces:**

- Produces: `requireCurrentStoreRecord(record, storeId, resource)`.
- Consumes: registros com `barbershop_id` antes de atualização administrativa.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { requireCurrentStoreRecord } from './tenant-ownership';

describe('requireCurrentStoreRecord', () => {
  it('recusa registro de outra unidade', () => {
    expect(requireCurrentStoreRecord(
      { id: 'other', barbershop_id: 'loja-b' },
      'loja-a',
      'Agendamento'
    )).toEqual({ ok: false, error: 'Agendamento não pertence a esta unidade.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tenant-ownership.test.ts`

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function requireCurrentStoreRecord<T extends { barbershop_id: string | null }>(
  record: T | null,
  storeId: string,
  resource: string
): { ok: true; record: T } | { ok: false; error: string } {
  if (!record || record.barbershop_id !== storeId) {
    return { ok: false, error: `${resource} não pertence a esta unidade.` };
  }
  return { ok: true, record };
}
```

- [ ] **Step 4: Apply the guard to `updateAppointment`**

Select `id, barbershop_id` by appointment ID, call the guard, and retain both `.eq('id', id)` and `.eq('barbershop_id', barbershopId)` on update. Return the guard error instead of successful zero-row writes.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/lib/tenant-ownership.test.ts && npx tsc --noEmit`

```bash
git add src/lib/tenant-ownership.ts src/lib/tenant-ownership.test.ts src/app/admin/agenda/actions.ts
git commit -m "fix(agenda): recusa atualizacao de outra unidade"
```

### Task 2: Escritas financeiras e de fidelidade por unidade

**Files:**

- Modify: `src/app/admin/financeiro/actions.ts:82-124`
- Modify: `src/app/admin/metas/actions.ts:76-81`
- Modify: `src/app/admin/fidelidade/actions.ts:76-239`
- Modify: `src/app/admin/contas-pagar/actions.ts:50-208`

**Interfaces:**

- Consumes: `requireCurrentStoreRecord` and `lojaAtual()`.
- Produces: scoped error results for allowance, goal, reward and bill IDs.

- [ ] **Step 1: Add failing test cases**

```ts
it('aceita registro da unidade atual', () => {
  expect(requireCurrentStoreRecord(
    { id: 'same', barbershop_id: 'loja-a' },
    'loja-a',
    'Conta'
  )).toMatchObject({ ok: true });
});

it('recusa registro ausente', () => {
  expect(requireCurrentStoreRecord(null, 'loja-a', 'Prêmio'))
    .toEqual({ ok: false, error: 'Prêmio não pertence a esta unidade.' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tenant-ownership.test.ts`

Expected: FAIL before the cases are added.

- [ ] **Step 3: Scope each mutation**

For `approveAllowance`, `rejectAllowance`, `deleteAllowance`, `deleteGoal`, `updateReward`, `deleteReward`, `redeemReward`, `updateBill`, `deleteBill`, `markBillAsPaid`, `reopenBill`, and `generateNextRecurrence`: resolve the store once, select target fields plus `barbershop_id`, guard ownership, and repeat the store filter on the mutation. In loyalty actions, check every insert/update error before returning success.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/lib/tenant-ownership.test.ts && npx tsc --noEmit`

```bash
git add src/app/admin/financeiro/actions.ts src/app/admin/metas/actions.ts src/app/admin/fidelidade/actions.ts src/app/admin/contas-pagar/actions.ts src/lib/tenant-ownership.test.ts
git commit -m "fix(admin): limita escritas financeiras a unidade atual"
```

### Task 3: Escopo de comanda e detalhes por ID

**Files:**

- Modify: `src/app/admin/comandas/actions.ts:84-535`
- Modify: `src/app/admin/servicos/[id]/page.tsx:1-45`
- Modify: `src/app/admin/contas-pagar/[id]/page.tsx:1-45`

**Interfaces:**

- Consumes: current store ID and the ownership guard.
- Produces: comanda, agendamento, item, estoque e serviço cannot be read or mutated across stores.

- [ ] **Step 1: Add failing resource-specific test**

```ts
it('preserva o recurso na mensagem de erro', () => {
  expect(requireCurrentStoreRecord(
    { id: 'cmd', barbershop_id: 'loja-b' },
    'loja-a',
    'Comanda'
  )).toEqual({ ok: false, error: 'Comanda não pertence a esta unidade.' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tenant-ownership.test.ts`

Expected: FAIL before the case is added.

- [ ] **Step 3: Scope actions and pages**

Use `.eq('barbershop_id', barbershopId)` on initial and mutation queries in `startAppointmentComanda`, `populateComandaFromAppointment`, `addServiceToComanda`, and `removeComandaItem`. Confirm both item and comanda belong to the store and that item belongs to the submitted comanda. Service and bill detail pages resolve `lojaAtual()`, filter the primary query by store, and call `notFound()` for invisible records.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/lib/tenant-ownership.test.ts && npx tsc --noEmit`

```bash
git add src/app/admin/comandas/actions.ts src/app/admin/servicos/[id]/page.tsx src/app/admin/contas-pagar/[id]/page.tsx src/lib/tenant-ownership.test.ts
git commit -m "fix(comandas): isola operacoes por unidade"
```

### Task 4: Fechamento administrativo atômico

**Files:**

- Create: `migrations/fechar-comanda-admin-atomico.sql`
- Modify: `src/app/admin/comandas/actions.ts:539-784`
- Test: `src/lib/painel/comanda-calculo.test.ts`

**Interfaces:**

- Produces: `admin_fechar_comanda(p_comanda_id, p_barbershop_id, p_closed_by, p_metodo, p_subtotal, p_total, p_discount_percent, p_taxa_percent, p_taxa_valor, p_liquido, p_creditos, p_metodo_resto) returns uuid`.
- Consumes: server-calculated payment values only.

- [ ] **Step 1: Write the failing integration specification**

The disposable-database test must call the new RPC twice with the same open comanda, then assert the second call raises `JA_FECHADA` and exactly one payment row exists. Do not use production data.

- [ ] **Step 2: Verify current calculation behavior**

Run: `npx vitest run src/lib/painel/comanda-calculo.test.ts`

Expected: PASS before SQL work.

- [ ] **Step 3: Create the RPC**

Base the transaction on `migrations/credito-do-cliente-3-painel.sql`, but lock by current store:

```sql
SELECT * INTO v_comanda
  FROM public.comandas
 WHERE id = p_comanda_id
   AND barbershop_id = p_barbershop_id
 FOR UPDATE;

IF v_comanda.id IS NULL THEN RAISE EXCEPTION 'NAO_ENCONTRADA'; END IF;
IF v_comanda.status <> 'open' THEN RAISE EXCEPTION 'JA_FECHADA'; END IF;
```

Inside that one function transaction, update comanda, payment rows, credits, appointment and customer totals. Never call `lojaPadrao()`.

- [ ] **Step 4: Replace the multi-write action**

Keep validation and calculation in `closeComanda`, replace its sequential writes with `admin.rpc('admin_fechar_comanda', ...)`, map `JA_FECHADA` and `NAO_ENCONTRADA` to user errors, and award loyalty points only after RPC success.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

Apply SQL first to a disposable/staging database. Production application requires a read-only compatibility preflight and must not create or close any real comanda.

```bash
git add migrations/fechar-comanda-admin-atomico.sql src/app/admin/comandas/actions.ts src/lib/painel/comanda-calculo.test.ts
git commit -m "fix(comandas): fecha caixa em transacao atomica"
```

## Deferred, Separate Plans

- P1: cadastro público por unidade, papéis multiunidade e políticas RLS.
- P1: diagnóstico de DRE, Financeiro e Assinaturas com consultas somente de leitura.
- P2: performance percebida, consultas N+1, imagens e carregamento sob demanda.
- P3: texto, acessibilidade, BOM e código morto.

## Plan Review

- Trata os achados confirmados de maior risco sem depender de WhatsApp ou Mercado Pago.
- Mantém integrações inativas, RLS e performance em pacotes separados para evitar uma publicação grande e arriscada.
- Tasks 2 and 3 depend on Task 1; Task 4 adds no production-data mutation by itself.

