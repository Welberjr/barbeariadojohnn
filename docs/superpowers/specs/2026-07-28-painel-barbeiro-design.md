# Painel do Barbeiro

Especificação aprovada em 28/07/2026. Implantação prevista para segunda, 03/08/2026.

## Problema

Hoje a Barbearia do Johnn tem duas áreas logadas: o `/admin`, que é a gestão completa, e o `/cliente`,
que é o painel do cliente. Não existe nada no meio.

Isso gera dois problemas concretos:

1. **Buraco de segurança.** O cadastro de profissional em `src/app/admin/profissionais/actions.ts`
   já cria um usuário no Supabase Auth para cada pessoa da equipe. Qualquer profissional que recupere
   a senha e faça login entra no `/admin` completo: financeiro, DRE, contas a pagar, base inteira de
   clientes e configurações.
2. **Falta de autonomia do barbeiro.** Ele não consegue ver a própria agenda, a própria produção, a
   própria comissão nem os próprios vales sem pedir para o Johnn abrir no computador.

## Objetivo

Uma área nova, `/painel`, onde cada profissional vê e opera apenas o que é dele, com o Johnn
decidindo, pessoa por pessoa, quais módulos ficam disponíveis.

## Decisões tomadas

| Assunto | Decisão |
|---|---|
| Onde fica | Área nova `/painel`, desenhada para celular, separada do `/admin` |
| Permissão | Por pessoa, não por papel. O Johnn liga e desliga módulo a módulo |
| Quem entra no admin | Quem tiver a chave `can_manage`, independente do papel cadastrado |
| Login | O mesmo `/login` de hoje, com desvio automático conforme o acesso |
| Senha | O Johnn define na tela do profissional e entrega ao barbeiro |
| Financeiro do barbeiro | Produção, comissão, vales e líquido a receber. Nunca o resultado da barbearia |
| Reuso | A lógica de comanda e de agenda do admin é reaproveitada com guarda de dono |

## Modelo de dados

Duas colunas novas em `staff`, aplicadas por migration idempotente no padrão de `migrations/`:

```sql
can_manage  boolean  default false
permissions jsonb    default '{}'::jsonb
```

`can_manage` decide admin contra painel. `permissions` guarda as seis chaves de módulo. Chave ausente
significa desligada, então todo profissional já cadastrado nasce sem nada além da agenda em leitura.

Backfill obrigatório na mesma migration: `can_manage = true` para o profissional de papel `owner`.
Sem isso, no instante em que a trava entra no ar, ninguém consegue acessar a gestão.

### Chaves de módulo

| Chave | O que libera |
|---|---|
| `financeiro` | Produção, comissão, vales descontados, líquido a receber e o potinho de assinaturas |
| `vales_ver` | Lista dos vales dele, com valor, motivo, data e situação |
| `vales_pedir` | Solicitar vale, que entra pendente para o Johnn aprovar. Depende de `vales_ver` |
| `agenda_operar` | Confirmar presença, concluir, marcar falta, bloquear horário e encaixar cliente |
| `comanda` | Abrir e fechar a própria comanda, incluindo cobrir pela assinatura |
| `clientes` | Lista dos clientes que ele atendeu, com histórico e situação da assinatura |

A agenda própria em modo leitura não tem chave: é a base do painel e está sempre disponível.

### Presets por papel

Sugestão aplicada no cadastro, editável em seguida:

| Papel | Módulos sugeridos |
|---|---|
| Barbeiro | `financeiro`, `vales_ver`, `vales_pedir` |
| Recepcionista | `agenda_operar`, `comanda` |
| Auxiliar | nenhum |
| Gerente | todos, com `can_manage` sugerido ligado |
| Proprietário | `can_manage` ligado |

## Arquitetura

### Portaria

`src/lib/staff-auth.ts`, espelhando o `src/lib/customer-auth.ts` que já funciona para o cliente.

```ts
requireStaff(modulo?: ModuloPainel): Promise<SessionStaff>  // páginas, redireciona
getSessionStaff(): Promise<SessionStaff | null>             // server actions, devolve nulo
assertModulo(staff, modulo): void                           // lança quando não pode
```

`SessionStaff` carrega `staffId`, `profileId`, `displayName`, `role`, `canManage`, `permissions` e
`commissionPercent`.

**Regra de ouro do isolamento:** o `staff_id` usado em toda leitura e em toda escrita do painel vem
sempre da portaria, nunca de parâmetro de URL, de campo de formulário ou de estado do cliente.

### Roteamento

O middleware faz o desvio otimista pelo que está no token e o layout de cada área faz a conferência
autoritativa no banco, que é exatamente como o sistema já trabalha hoje.

- `/admin/*` exige sessão com `can_manage`. Quem não tem é mandado para `/painel`.
- `/painel/*` exige profissional ativo. Cliente vai para `/cliente`, visitante vai para `/login`.
- `/login` com sessão ativa manda para o lugar certo conforme o acesso.
- Ser da equipe tem precedência sobre ser cliente, para o caso de a mesma pessoa ser as duas coisas.

### Rotas do painel

```
/painel              visão do dia
/painel/agenda       agenda dele
/painel/comandas     comandas dele                     (módulo comanda)
/painel/financeiro   produção e comissão               (módulo financeiro)
/painel/vales        vales e pedido                    (módulo vales_ver)
/painel/clientes     clientes que ele atendeu          (módulo clientes)
/painel/perfil       dados e troca de senha
```

Rota de módulo desligado não aparece no menu e recusa o acesso direto pela barra de endereço.

### Renderização

Todas as páginas do painel renderizam sempre no servidor, sem cache (`export const dynamic =
'force-dynamic'`). Em tela com dado pessoal e vários usuários, cache compartilhado é o caminho mais
curto para um barbeiro ver a comissão do outro.

## Telas

### Visão do dia

Clientes de hoje, próximo atendimento com horário, produzido no dia e a receber no mês. Cada número
que dependa de módulo desligado some da tela.

### Agenda

Lista do dia com navegação por data. Ao lado do nome do cliente, o selo de assinante:

| Situação | Selo |
|---|---|
| Não assinante | nenhum |
| Assinante com saldo | `Clube Ouro · restam 2 de 4` |
| Assinante sem saldo | `Clube Ouro · usos esgotados neste ciclo, cobrar avulso` |
| Ciclo vencido | `Clube Ouro · vencido, aguardando pagamento. Não cobre hoje` |
| Fora dos dias do plano | `Clube Ouro · o plano cobre de quarta a sexta, hoje cobra avulso` |

Os dados vêm de `getActiveSubscription()` em `src/lib/subscriptions.ts`, que já devolve plano, usos
incluídos, usos no ciclo, saldo, fim do ciclo e dias permitidos. Os dois últimos estados são
justamente onde o barbeiro erra hoje e o Johnn só descobre depois.

Com `agenda_operar`: confirmar, concluir, marcar falta, bloquear horário e encaixar cliente.

### Comanda

Só as comandas dele. Lançamento de serviço e produto e o botão de cobrir pela assinatura com o
contador do ciclo ao lado. Reusa `src/app/admin/comandas/actions.ts` com guarda de dono na entrada de
cada ação, para não duplicar o cálculo de comissão nem o de taxa de cartão.

Não pode: mexer em comanda de outro, reabrir comanda fechada, excluir comanda e dar desconto acima do
teto configurado (padrão zero).

### Meu financeiro

Produção do período, percentual, comissão bruta, vales descontados e líquido a receber. Bloco de
assinaturas com atendimentos de assinante no ciclo, potinho já fechado e estimativa do ciclo em
aberto, com aviso explícito de que é estimativa e varia conforme os colegas atendem.

O potinho é a fatia dos barbeiros no plano (`barber_share_percent`), rateada proporcionalmente aos
atendimentos, conforme `splitPool()` em `src/lib/subscriptions.ts`.

### Meus vales

Valor, motivo, data, situação e total descontado no mês. Com `vales_pedir`, botão de solicitar, que
cria registro pendente em `allowances`.

### Meus clientes

Apenas quem ele atendeu. Nome, última visita, serviços habituais, observações e situação da
assinatura. Sem valores da barbearia.

### Perfil

Dados dele e troca de senha.

## Mudanças no admin

Trabalho aditivo. Nenhuma tela existente é reescrita.

1. **Tela do profissional**: bloco "Acesso ao sistema" com a chave de gestão, as seis chaves de
   módulo com texto em português claro, o botão de definir senha (mostrada uma vez para o Johnn
   copiar) e o status do último acesso. Com a gestão ligada, as chaves de módulo ficam desabilitadas
   e explicadas, porque essa pessoa vê tudo de qualquer forma.
2. **Financeiro**: fila de vales pendentes com aprovar e recusar, usando `approveAllowance` e
   `rejectAllowance`, que já existem sem tela.
3. **Notificação**: pedido de vale novo acende o sino que já existe na topbar, com link para a fila.

## Segurança

A trava fica no servidor. Esconder item de menu não é proteção. Toda ação de escrita revalida sessão,
módulo e propriedade do registro antes de tocar no banco.

| Caso | Comportamento |
|---|---|
| Profissional desativado | Perde acesso na hora, sem depender de troca de senha |
| Último acesso de gestão | Não pode ser removido. O sistema recusa e explica |
| Barbeiro que também é cliente | Equipe tem precedência. O painel do cliente segue acessível |
| Senha entregue por WhatsApp | Primeiro acesso exige troca antes de usar o painel |
| Vale acima do saldo | Avisa e mostra o saldo, mas não bloqueia. Quem decide é o Johnn |
| Vários pedidos de vale | Um pendente por vez |
| Comanda fechada | Barbeiro não reabre nem exclui |
| Id de outro profissional na URL | Recusa, porque o id da sessão é o único usado |

## Testes

O projeto não tem framework de teste hoje. Entra o Vitest cobrindo apenas as duas partes onde errar é
caro e a conferência visual não pega:

1. Resolução de permissão: quem pode o quê, incluindo gestão ligada, módulo dependente
   (`vales_pedir` sem `vales_ver`) e profissional inativo.
2. Cálculo do financeiro do barbeiro: comissão do período menos vales, e rateio do potinho.

O restante é verificado no navegador com roteiro escrito, incluindo dois profissionais de teste com
permissões diferentes para conferir o isolamento na prática.

## Cronograma

| Data | Entrega |
|---|---|
| 28 e 29/07 | Migration, portaria, roteamento, bloco de acesso e definir senha |
| 30/07 | Agenda com selo de assinante e visão do dia |
| 31/07 | Financeiro com potinho, vales, pedido e fila de aprovação |
| 01/08 | Comanda e meus clientes |
| 02/08 | Acabamento no celular, revisão de português, roteiro de verificação e publicação |
| 03/08 | Implantação, sem código sendo escrito |

## Fora de escopo

Relatório de desempenho por barbeiro, metas individuais no painel, conversa com a Lara dentro do
painel, edição de cadastro de cliente pelo barbeiro e aplicativo nativo. Ficam para depois da
implantação.
