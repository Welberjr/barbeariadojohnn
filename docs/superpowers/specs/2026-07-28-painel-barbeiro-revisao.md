# Revisão externa da especificação do painel do barbeiro

Revisor: GPT 5.5, consultado em 28/07/2026 com a spec completa e o contexto técnico do projeto.
Este documento registra o que foi aceito, o que foi recusado e por quê.

## Verificações feitas no banco antes de decidir

| Pergunta | Resposta real |
|---|---|
| O banco está aberto para a chave pública? | Não. Todas as tabelas testadas retornam vazio com a chave anônima |
| Existe profissional com papel `owner` ativo? | Sim, dois: Welber e JOHNN ALVEZ |
| Existe usuário ligado a mais de um profissional ativo? | Não |
| `allowances` já tem campos de auditoria? | Sim: `requested_by`, `reviewed_by`, `review_notes` |
| Já existe vale pendente? | Sim, um |

## Aceito e incorporado

1. **Travar o `/admin` de verdade, inclusive as server actions.** Este era o ponto mais forte da
   revisão. O buraco atual não é a falta do painel, é o admin aceitar qualquer profissional logado.
   Bloquear só a navegação deixaria as actions expostas. Toda action mutável do admin passa a
   começar por `requireCanManage()`.
2. **Não reaproveitar as actions de comanda do admin no painel.** A revisão está certa: elas foram
   escritas assumindo poder total e recebem identificadores do formulário. O painel ganha actions
   próprias, pequenas, e o cálculo puro é extraído para uso comum.
3. **Portaria por `profile_id = auth.uid()`, exigindo `active = true` e `fired_at is null`,
   consultado no banco a cada requisição.** Sem isso, "perde o acesso na hora" não seria verdade.
4. **Anti-lockout em transação.** A checagem em JavaScript tem corrida. Virou função SQL com lock,
   mais um gatilho que impede desativar o último gestor.
5. **Um vale pendente por profissional garantido por índice único parcial**, não por consulta prévia.
6. **Parser estrito de permissões.** Chave desconhecida ou valor que não seja booleano verdadeiro é
   tratado como desligado. Nada de ler `permissions.financeiro` direto.
7. **Um profissional ativo por usuário**, garantido por índice único parcial.
8. **Migration que aborta se ninguém ficar com acesso de gestão.**
9. **Consumo de assinatura com trava.** Dois barbeiros não podem gastar o mesmo último uso do ciclo.
   Vira função SQL com lock na assinatura e contagem dentro da transação.
10. **Fonte canônica de "clientes que ele atendeu"**: itens de comanda fechada com o `staff_id` dele.
11. **Comanda de vários profissionais**: o barbeiro só enxerga e opera a comanda cujo dono é ele, e
    não consegue fechar comanda que tenha item de outro profissional.
12. **Sem desconto no painel.** O teto de desconto não existe no modelo, então a versão um não
    permite desconto nenhum. Desconto continua no admin.
13. **Notificação filtrada por público**, para o barbeiro não receber aviso destinado à gestão.
14. **Financeiro pelo valor realizado** (`comanda_items.commission_value`), nunca recalculando com o
    percentual atual, e com o mesmo recorte que o admin já usa (comanda fechada, por `closed_at`).
15. **Idempotência por status** nas ações do painel, porque celular em rede ruim gera clique duplo.

## Recusado, com motivo

1. **Cortar comanda, meus clientes e o potinho da primeira versão.** Recusado. O Welber aprovou os
   seis módulos e é justamente aí que está o valor para a barbearia. O risco apontado é real, então
   foi mitigado com actions próprias, guarda de dono, bloqueio de comanda multiprofissional, ausência
   de desconto e trava de concorrência na assinatura.
2. **Trocar a senha definida pelo gestor por convite de e-mail.** Recusado. Decisão do Welber, e
   depender de e-mail chegar no dia da implantação presencial é risco maior. Em compensação, a troca
   obrigatória no primeiro acesso foi implementada de verdade, com a coluna
   `staff.must_change_password` e bloqueio do painel enquanto não trocar.
3. **Migrar o painel para cliente de sessão com RLS.** Recusado agora. O banco tem RLS ligada e sem
   políticas de leitura, então trocar a chave de serviço por sessão do usuário exigiria escrever
   política para cada tabela e cada junção até segunda. A chance de chegar no dia da implantação com
   tela vazia é alta demais. O isolamento fica na camada de acesso a dados, onde nenhuma função
   aceita identificador de profissional vindo de fora.

## Segunda rodada: revisão do código pronto

O mesmo revisor recebeu o código implementado. Nove achados, todos corrigidos antes deste
registro.

| Achado | Correção |
|---|---|
| Fechamento da comanda em chamadas separadas: falha ao gravar o pagamento deixava comanda fechada sem pagamento | Virou a função `painel_fechar_comanda`, que fecha, cobra, conclui o atendimento e soma os totais do cliente numa transação só |
| Totais do cliente somados no aplicativo (ler, somar, gravar) | Passaram a ser somados no próprio SQL, então dois fechamentos ao mesmo tempo não se sobrescrevem |
| Corrida de estoque: dois lançamentos vendiam a mesma última unidade | Virou `painel_baixar_estoque`, com a conta dentro do UPDATE condicional |
| Cliente aceito da tela sem conferência | Passa a exigir cliente da barbearia e ativo, na comanda e no encaixe |
| Serviço e produto buscados só pelo identificador | Passam a exigir `barbershop_id` e `active` |
| Mudança de status da agenda sem comparar o estado anterior | Gravação exige que o status ainda seja o que foi lido, com aviso quando mudou |
| Encaixe aceitava horário passado e dia bloqueado | Recusa os dois casos |
| Erro ao vincular o serviço do encaixe era ignorado | Passa a desfazer o agendamento e pedir para tentar de novo |
| Comentário dizia "uma comanda aberta por cliente", mas a checagem era por cliente e profissional | Comentário corrigido: dois profissionais podem ter comanda aberta para o mesmo cliente, que é o caso real de corte com um e barba com outro |

Uma sugestão foi recusada: criar índice único de uma comanda aberta por cliente em toda a
barbearia. Isso quebraria o atendimento simultâneo por dois profissionais, que acontece de
verdade na barbearia, e mudaria o comportamento do admin sem o Johnn ter pedido.

## Adaptação feita durante a implementação

O bloqueio de horário virou bloqueio de dia. O sistema guarda folga por dia (`days_off`), sem
faixa de horário, então o painel bloqueia o dia inteiro e a tela diz isso com todas as letras.
Bloquear faixa de horário exigiria tabela nova e mexeria na disponibilidade do site, o que não
cabe até segunda.

## Dívidas registradas para depois da implantação

1. Políticas de RLS nas tabelas do painel, como defesa em profundidade.
2. Migrar o consumo de assinatura do admin para a mesma função com trava usada pelo painel.
3. Vincular vale aprovado ao fechamento de comissão (`commission_payouts` hoje grava
   `total_allowances` zerado), para não haver risco de descontar duas vezes ou nenhuma.
4. Máquina de estados de agendamento documentada e compartilhada entre admin e painel.
