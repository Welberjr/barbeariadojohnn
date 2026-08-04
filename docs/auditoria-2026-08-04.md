# Auditoria técnica — 04/08/2026

## Escopo e segurança dos dados

Foram feitas somente leituras em produção e verificações locais. Nenhum cliente,
agendamento, comanda, produto, ponto ou cadastro real foi criado, alterado ou removido.

## Resultado da comparação com o relatório anterior

O relatório anterior estava correto ao apontar riscos de isolamento entre unidades,
pontuação controlada pelo navegador, cron permissivo e webhooks sem assinatura.
Também trazia itens já resolvidos no código atual (login de profissionais por loja,
troca de unidade e cabeçalhos básicos). Não considerei cada um dos 124 apontamentos
como defeito atual: os achados foram revalidados contra `origin/master` de 04/08.

## Correções aplicadas

- Raspadinha: o navegador não escolhe mais os pontos; o servidor sorteia o prêmio,
  limita cliente e saldo à unidade da ficha e há uma migração para impedir duplicação
  semanal em duas abas.
- Agendamento do cliente: serviços, profissionais, associações e slots são filtrados
  pela unidade atual, impedindo combinações de IDs de outra loja.
- Serviços por profissional: actions agora exigem gestão e confirmam profissional e
  serviço na unidade atual antes de inserir, alterar ou remover a associação.
- Profissionais e unidades: ações sensíveis receberam filtros de unidade; a lista de
  unidades não exibe indicadores de lojas que o gestor não administra e deixou de
  carregar seus resumos em série.
- Cron: falha fechado sem `CRON_SECRET` e percorre todas as unidades ativas com
  consultas e atualizações isoladas por `barbershop_id`.
- Webhooks: WhatsApp e Mercado Pago validam HMAC antes de abrir o cliente de serviço.
  Foram documentadas `META_APP_SECRET` e `MP_WEBHOOK_SECRET` em `.env.example`.
- Segurança: foi incluído HSTS na política de headers.
- Build: o checkout estava sem `web-push` apesar de ele constar no lockfile; a
  restauração com `npm ci` corrigiu a falha de compilação.

## Evidências

- Testes: 21 arquivos, 216 testes aprovados.
- Tipos: `npx tsc --noEmit` aprovado.
- Build: `npm run build` aprovado, com 28 páginas estáticas geradas.
- Produção pública: login administrativo com LCP de 268 ms e CLS 0,00; entrada mobile
  do cliente renderizou com os campos e rótulos esperados, sem exceção de JavaScript.

## Pendências de publicação segura

1. Cadastrar no ambiente Production da Vercel os valores secretos `MP_WEBHOOK_SECRET`
   e `META_APP_SECRET`. A auditoria confirmou que eles ainda não existem lá; não há
   valor possível de inferir ou gerar localmente.
2. Aplicar `migrations/auditoria-raspadinha-segura.sql` no Supabase antes de publicar
   para obter idempotência atômica entre duas abas. A migração não muda registros,
   mas deve ser executada no ambiente correto.
3. Há 3 alertas altos transitivos em `npm audit` (Next/PostCSS/Sharp). A única correção
   automatizada proposta sobe para Next 16 e é breaking; ela ficou fora desta entrega
   para não criar regressão em produção.
4. O WhatsApp já estava desativado por decisão de produto. Quando for ativado, cadastrar
   o App Secret e testar o handshake GET e um evento POST assinado em ambiente de teste.

## Limite da auditoria visual

As telas autenticadas não receberam cliques de gravação nesta rodada para preservar os
dados reais. Os caminhos foram auditados por código, tipos, build e entrada pública; a
validação final autenticada deve ser feita com contas de teste e sem executar operações
financeiras ou de agenda reais.
