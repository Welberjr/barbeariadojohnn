# Segunda loja (franquia)

Levantado em 01/08/2026, a pedido do Welber. Não é para fazer agora: fica
escrito para não se perder quando o Johnn abrir a segunda unidade.

## Onde a gente está

O banco já está pronto para mais de uma loja. Toda tabela que guarda movimento
carrega `barbershop_id`: conferi 12 delas (clientes, agendamentos, comandas,
serviços, equipe, produtos, assinaturas, contas, crédito, fidelidade, folgas e
transações) e nenhuma ficou de fora. Isso foi decidido no começo e é a parte
difícil de mudar depois.

O que falta é o sistema **perguntar de qual loja se trata**. Hoje o identificador
da Barbearia do Johnn está escrito fixo no código:

```
const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
```

São 62 ocorrências, em 59 arquivos. Toda tela, toda ação e todo relatório assume
que existe uma loja só. Por isso não existe onde criar a segunda: a pergunta
nunca é feita.

## O que precisa ser feito

**1. Tela de lojas no admin.** Cadastrar unidade com nome, endereço, telefone,
horário e taxas próprias. Hoje `barbershops` tem uma linha só e ninguém pode
criar a segunda pela interface.

**2. O identificador sai do código e vem de quem está logado.** Cada pessoa da
equipe passa a pertencer a uma unidade (ou a mais de uma), e o sistema lê a loja
da sessão em vez da constante. É a mudança que encosta em quase todo arquivo.

**3. Acesso por unidade.** Hoje `staff.can_manage` quer dizer "manda no
sistema". Precisa virar "manda na loja B". Um gerente da unidade nova não pode
ver o caixa da unidade antiga, e o dono precisa ver as duas.

**4. Painel do dono.** Uma tela que soma as unidades e deixa comparar: faturamento,
ticket, ocupação de agenda, equipe. Sem ela, ter duas lojas vira abrir dois
sistemas.

## Cuidados que já conhecemos

- A sincronização do EcoBarber (`scripts/migrar-ecobarber.mjs`) também escreve o
  identificador fixo. Ela precisa saber para qual unidade está importando.
- O crédito do cliente, a assinatura e a fidelidade valem em qual unidade? É
  decisão do dono, não do código, e precisa ser perguntada antes de programar.
- Os testes de acesso (`scripts/auditar-acesso.mjs`) hoje conferem se cliente
  enxerga dado de cliente. Vão precisar conferir também se loja enxerga dado de
  loja.

## Tamanho

Trabalho de dias, não de horas. Não atrasa nada do que está no ar hoje, e quando
for feito não exige refazer o banco: é acrescentar a pergunta, não reconstruir a
fundação.
