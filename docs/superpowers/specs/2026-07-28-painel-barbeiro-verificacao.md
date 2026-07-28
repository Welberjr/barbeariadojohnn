# Roteiro de verificação do painel do barbeiro

Para rodar antes da implantação de segunda, 03/08/2026. Cada item diz o que fazer e o que
precisa acontecer. Se algum resultado sair diferente, é defeito.

## Preparação

1. Aplicar `migrations/painel-barbeiro.sql` no SQL Editor do projeto.
2. Criar os profissionais de teste:

```bash
node scripts/preparar-teste-painel.mjs
```

Isso cria dois logins:

| Login | Senha | Acesso |
|---|---|---|
| teste.barbeiro@barbeariadojohnn.local | TesteBarbeiro2026 | todos os seis módulos |
| teste.novato@barbeariadojohnn.local | TesteNovato2026 | só a agenda em leitura |

Ao terminar a verificação, remover os dois:

```bash
node scripts/preparar-teste-painel.mjs --remover
```

## 1. Portaria e roteamento

| O que fazer | O que precisa acontecer |
|---|---|
| Abrir `/painel` sem estar logado | Vai para `/login` |
| Entrar com o login do Johnn | Cai no `/admin`, como sempre |
| Entrar com o barbeiro de teste | Cai no `/painel`, nunca no admin |
| Logado como barbeiro, digitar `/admin/dre` na barra | Volta para `/painel` |
| Logado como barbeiro, digitar `/admin/financeiro` | Volta para `/painel` |
| Logado como cliente, digitar `/painel` | Vai para `/cliente` |

## 2. Vazamento pelas rotas de API

Com o barbeiro de teste logado, no console do navegador:

```js
await fetch('/api/admin/search?q=silva').then(r => r.status)      // 403
await fetch('/api/admin/notifications').then(r => r.status)        // 403
await fetch('/api/chat/admin', {method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({messages:[{role:'user',content:'qual o faturamento do mês?'}]})})
  .then(r => r.status)                                             // 403
```

Os três precisam responder 403. Antes desta entrega respondiam 200 para qualquer pessoa logada,
inclusive cliente.

## 3. Permissão por pessoa

| O que fazer | O que precisa acontecer |
|---|---|
| Entrar como o novato | Menu só com Hoje e Agenda |
| Novato digitando `/painel/financeiro` | Volta para `/painel` |
| Novato digitando `/painel/comandas` | Volta para `/painel` |
| No admin, ligar "Meu financeiro" para o novato e salvar | O item aparece no menu dele ao recarregar |
| No admin, tentar ligar "Pedir vale" sem "Meus vales" | A tela marca os dois juntos |

## 4. Isolamento entre barbeiros

| O que fazer | O que precisa acontecer |
|---|---|
| Ver a agenda do barbeiro de teste | Só os atendimentos dele |
| Abrir `/painel/comandas/<id de comanda de outro>` | Página não encontrada |
| Financeiro do barbeiro de teste | Só a produção dele, nunca o total da barbearia |
| Meus clientes | Só quem ele atendeu em comanda fechada |

## 5. Acesso de gestão e trava anti-lockout

| O que fazer | O que precisa acontecer |
|---|---|
| Desligar o acesso de gestão do único gestor ativo | Recusa com aviso, e o acesso continua ligado |
| Desativar o único gestor ativo | Recusa com aviso |
| Ligar gestão para um barbeiro e entrar com ele | Entra no admin completo |

## 6. Senha e primeiro acesso

| O que fazer | O que precisa acontecer |
|---|---|
| Definir senha para o barbeiro de teste | A senha aparece uma vez, com botão de copiar |
| Entrar com essa senha | Cai direto na troca de senha, sem acesso ao resto |
| Tentar ir para `/painel/agenda` antes de trocar | Volta para a troca de senha |
| Trocar a senha | Painel libera normalmente |
| Sair e tentar entrar com a senha antiga | Recusa |

## 7. Selo de assinante

Com um cliente assinante na agenda, conferir os cinco casos:

| Situação montada | O que precisa aparecer |
|---|---|
| Assinante com saldo | `restam X de Y`, em verde |
| Assinante sem saldo | `usos esgotados neste ciclo, cobrar avulso`, em amarelo |
| Ciclo vencido | `vencido, aguardando pagamento`, em vermelho |
| Fora dos dias do plano | `o plano cobre <dias>, hoje cobra avulso`, em amarelo |
| Não assinante | Nenhum selo |

Nos quatro primeiros casos, o botão "Assinatura" só pode aparecer no caso com saldo.

## 8. Comanda

| O que fazer | O que precisa acontecer |
|---|---|
| Abrir comanda a partir do atendimento do dia | Abre e vincula ao agendamento |
| Lançar serviço avulso | Entra com o valor cheio e comissão do barbeiro |
| Cobrir pela assinatura | Item entra zerado e o contador do ciclo sobe |
| Remover o item coberto | O uso volta para o ciclo do cliente |
| Lançar produto com estoque 1, em duas abas ao mesmo tempo | Uma passa, a outra avisa que não tem estoque |
| Fechar comanda com item de outro profissional | Recusa e manda falar com a gestão |
| Fechar a comanda | Fecha, grava o pagamento e conclui o atendimento |
| Clicar em fechar duas vezes rápido | A segunda avisa que já foi fechada, sem duplicar |
| Conferir o valor no admin | Bate exatamente com o que o painel mostrou |

## 9. Agenda

| O que fazer | O que precisa acontecer |
|---|---|
| Confirmar presença | Muda para confirmado |
| Marcar falta antes da hora marcada | Recusa e explica |
| Marcar falta depois da hora | Aceita |
| Concluir atendimento já concluído | Recusa |
| Bloquear um dia com atendimento marcado | Recusa e diz quantos atendimentos existem |
| Bloquear um dia livre | Bloqueia só a agenda dele |
| Encaixar em horário que já passou | Recusa |
| Encaixar em horário ocupado dele | Recusa avisando do conflito |

## 10. Vales

| O que fazer | O que precisa acontecer |
|---|---|
| Pedir vale | Entra como pendente e some o botão de pedir |
| Pedir outro vale com um pendente | Recusa avisando do pedido em aberto |
| Pedir dois vales em duas abas ao mesmo tempo | Só um entra |
| Ver o sino do admin | Mostra o pedido, com link para a fila |
| Aprovar no admin | O barbeiro vê como aprovado e o valor desconta do saldo dele |
| Recusar no admin | O barbeiro vê como recusado e nada desconta |
| Cancelar o próprio pedido pendente | Some da lista |

## 11. Profissional desligado

| O que fazer | O que precisa acontecer |
|---|---|
| Com o barbeiro logado, desativar ele no admin | Na próxima navegação ele cai no login |
| Tentar entrar de novo | Não passa do login |

## 12. Celular

Abrir o painel no celular (ou no navegador em modo mobile) e conferir:

1. A navegação inferior aparece e não cobre conteúdo.
2. Nenhuma tela rola para o lado.
3. Os botões de ação da agenda são clicáveis com o polegar.
4. Dá para instalar como aplicativo pela opção de adicionar à tela inicial.
