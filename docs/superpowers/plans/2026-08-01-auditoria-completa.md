# Auditoria Completa da Barbearia do Johnn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar e corrigir os fluxos reais dos painéis Administrativo, Barbeiro e Cliente, incluindo desempenho e publicação em produção.

**Architecture:** A auditoria parte da versão publicada e da `master`, mede navegação até conteúdo utilizável e cruza cada ação de interface com suas rotas, Server Actions e dados no Supabase. Alterações serão pequenas, isoladas e cobertas por teste de regressão antes de publicação.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase SSR/Auth/Postgres, Vitest, Vercel e Chrome DevTools.

## Global Constraints

- Não alterar dados reais fora de registros de teste explicitamente criados para esta auditoria.
- WhatsApp permanece fora da validação funcional, exceto por confirmar que links/telas não quebram o app.
- Medir tempo de clique até conteúdo utilizável, não apenas mudança de URL.
- Não publicar correções sem teste, typecheck, build e verificação de deploy.

---

### Task 1: Inventário e linha de base

**Files:**
- Inspect: `src/app/**/page.tsx`, `src/middleware.ts`, `src/lib/customer-auth.ts`, `src/lib/staff-auth.ts`
- Inspect: `next.config.mjs`, `vercel.json`, `package.json`

- [ ] Mapear rotas, perfis exigidos e ações que alteram dados.
- [ ] Conferir estado da `master`, deploy ativo e erros de build/runtime recentes.
- [ ] Medir carga fria e recursos críticos da tela pública de login.

### Task 2: Fluxos de cliente

**Files:**
- Inspect: `src/app/cliente/**`, `src/lib/customer-auth.ts`, `src/lib/booking.ts`
- Test: `src/lib/*.test.ts`, `src/lib/painel/*.test.ts`

- [ ] Validar login, painel, agendamento, agendamentos, benefícios, clube, histórico, loja, perfil e sair.
- [ ] Validar estados vazios, erros, links e mobile.
- [ ] Criar somente conta de teste necessária e remover/reverter os dados criados ao final.

### Task 3: Fluxos de barbeiro e administração

**Files:**
- Inspect: `src/app/painel/**`, `src/app/admin/**`, `src/lib/staff-auth.ts`
- Test: `src/lib/agenda-sobreposicao.test.ts`, `src/lib/confirmacao-agendamento.test.ts`, `src/lib/jornada.test.ts`

- [ ] Validar login e guardas de permissão de barbeiro.
- [ ] Exercitar agenda, comanda, pagamento, clientes, perfil e ações rápidas do barbeiro.
- [ ] Exercitar menu administrativo, agenda, comandas, clientes, profissionais, serviços, produtos, financeiro, DRE/PDF, contas, metas, assinaturas, fidelidade e configurações.

### Task 4: Auditoria técnica e de desempenho

**Files:**
- Inspect: `src/lib/supabase/**`, `src/lib/customer-auth.ts`, `src/lib/staff-auth.ts`, `src/app/**/loading.tsx`, `src/app/**/error.tsx`

- [ ] Examinar erros de console, erros de rede, falhas de hidratação, rotas mortas e código de teste/fictício.
- [ ] Medir Core Web Vitals e rede nas rotas representativas desktop e mobile.
- [ ] Identificar consultas duplicadas, navegação serial, bundles ou imagens que atrasem conteúdo utilizável.

### Task 5: Correções e aceite de produção

**Files:**
- Modify: apenas arquivos diretamente relacionados aos achados confirmados.
- Test: teste de regressão específico para cada correção.

- [ ] Reproduzir cada defeito antes de alterar código.
- [ ] Escrever teste que falha, implementar a menor correção e rodar a suíte completa.
- [ ] Validar ESLint, TypeScript, build, deploy Vercel e as rotas críticas publicadas.
- [ ] Entregar relatório com achados, evidências, correções e pendências reais.
