# Auditoria de seguranca e franquia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar escritas privilegiadas sem guarda, impedir acesso cruzado entre unidades e corrigir os fluxos que ainda assumem a loja principal.

**Architecture:** Centralizar a verificacao de escopo da unidade no servidor e reutiliza-la em actions administrativas. Rotas publicas que recebem eventos externos validam segredo antes de abrir um cliente de service role. Fluxos de cliente usam a unidade da ficha autenticada, nunca uma constante.

**Tech Stack:** Next.js App Router, Server Actions, Route Handlers, Supabase service role, Vitest.

## Global Constraints

- Nunca alterar, criar ou remover registros reais de clientes durante testes.
- Toda escrita com service role precisa validar sessao, permissao e `barbershop_id` no servidor.
- Rotas externas devem falhar fechadas quando o segredo nao estiver configurado.
- Cada correcao recebe teste de regressao antes da implementacao.

---

### Task 1: Guardas de gestao e de unidade

**Files:**
- Modify: `src/lib/supabase/manager.ts`
- Create: `src/lib/supabase/manager.test.ts`
- Modify: `src/app/admin/servicos/staff-actions.ts`

- [x] Criar guarda de gestão/unidade e aplicar às associações profissional-serviço.
- [x] Rodar testes específicos, suíte completa e checagem de tipos.

### Task 2: Endpoints de pontos e cron fechados

**Files:**
- Modify: `src/app/api/bonus-points/route.ts`
- Create: `src/lib/bonus-points.test.ts`
- Modify: `src/app/api/cron/reminders/route.ts`
- Create: `src/lib/cron-auth.test.ts`
- Modify: `.env.example`

- [x] Sortear pontos somente no servidor e escopar saldo e transações pela unidade.
- [x] Fazer o cron falhar fechado e processar as unidades ativas isoladamente.
- [x] Validar testes, tipos e build.

### Task 3: Webhooks autenticados

**Files:**
- Modify: `src/app/api/whatsapp/webhook/route.ts`
- Modify: `src/app/api/mp/webhook/route.ts`
- Create: `src/lib/webhook-signature.ts`
- Create: `src/lib/webhook-signature.test.ts`
- Modify: `.env.example`

- [x] Adicionar testes HMAC de assinatura válida, inválida e segredo ausente.
- [x] Validar assinatura antes de qualquer cliente de service role ou escrita.
- [x] Documentar segredos sem expor valores.

### Task 4: Isolamento de dados administrativos

**Files:**
- Modify: `src/app/admin/profissionais/actions.ts`
- Modify: `src/app/admin/clientes/actions.ts`
- Modify: `src/app/admin/lojas/actions.ts`
- Modify: `src/app/admin/comandas/actions.ts`
- Modify: `src/app/admin/agenda/actions.ts`
- Modify: paginas de detalhe de admin que recebem `[id]`
- Create: testes de escopo por unidade para cada action extraida.

- [x] Endurecer as actions de unidades, profissionais, agenda do cliente e vínculos de serviço.
- [ ] Concluir a extração de todas as actions administrativas legadas que ainda aceitam IDs.

### Task 5: Confiabilidade, desempenho e qualidade restante

**Files:**
- Modify: `src/lib/mercadopago.ts`, `src/app/api/mp/webhook/route.ts`, `src/app/api/cron/reminders/route.ts`
- Modify: rotas de painel sem `loading.tsx` e componentes pesados
- Modify: textos com acentuacao/formato de moeda inconsistentes
- Modify: testes e documento de auditoria final.

- [x] Medir as entradas públicas desktop e mobile em produção.
- [x] Corrigir consulta repetida e N+1 confirmado na lista de unidades.
- [x] Rodar testes, tipos, build, auditoria de dependências e smoke público.
- [ ] Validar visualmente os fluxos autenticados usando contas sem dados reais.
