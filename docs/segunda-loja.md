# Segunda loja (franquia)

Levantado em 01/08/2026 e construído em 02/08/2026, a pedido do Welber.

## Onde a gente está agora

**Funciona.** O Johnn abre a segunda unidade em Sistema → Unidades. Testado com
duas lojas de verdade: os dados não se misturam.

O que foi feito:

- **A loja vem da sessão**, não do código. O identificador estava escrito fixo em
  62 lugares, em 59 arquivos. Agora a pergunta é feita em `src/lib/loja.ts`, e a
  ordem é: escolha da pessoa (cookie, só vale se ela trabalhar lá) → cadastro de
  equipe → ficha de cliente → única loja ativa, para quem não está logado.
- **Tela de unidades** (`/admin/lojas`): abrir, fechar, reabrir, ver equipe,
  clientes e faturamento do mês de cada uma. A unidade nova nasce com o horário,
  as taxas e as regras da unidade de onde foi criada, e quem abre já entra como
  gestor dela.
- **Troca de unidade** pelo menu da conta, sem sair do sistema. Com uma loja só,
  o bloco não aparece.
- **Acesso por unidade**: a mesma pessoa tem um cadastro em cada loja, com o
  mesmo login. A trava do banco passou a ser `(barbershop_id, profile_id)`.
- **Visão da rede** (`/admin/rede`): soma e compara as unidades. Só aparece no
  menu para quem administra mais de uma.

## Armadilhas que já custaram caro

Ficam escritas porque não são óbvias e voltam a morder:

**A trava de um cadastro por pessoa.** Existia `staff_one_active_per_profile`,
que permitia um cadastro ativo por pessoa na REDE inteira. Estava certa quando
havia uma loja e impedia exatamente a franquia. Corrigida em
`migrations/franquia-uma-pessoa-varias-lojas.sql`.

**Busca de cadastro sem filtro de loja.** `staff-auth` e a portaria buscavam por
`profile_id` com `maybeSingle`. Com dois cadastros a consulta acha duas linhas, o
`maybeSingle` devolve erro e a pessoa perde o acesso inteiro. Os dois filtram por
unidade agora.

**Consulta que lê a rede inteira.** Com uma loja ninguém percebe. A lista de
Profissionais mostrava a equipe das duas unidades; a de barbeiros e serviços na
agenda, nas comandas, na ficha do cliente e no agendamento também. Para achar,
use a varredura: procurar `.from('tabela_de_loja')` sem `barbershop_id` na mesma
consulta. `insert` é falso positivo, porque o payload leva a loja.

**Contagem que precisa ser por unidade.** A guarda de "último gestor" contava a
rede inteira: deixaria desligar o único gestor da loja B porque a loja A tem
outro, e a loja B ficaria trancada.

## O que ainda falta

**A sincronização do EcoBarber** (`scripts/migrar-ecobarber.mjs`) escreve na loja
principal. Quando houver duas, ela precisa saber para qual unidade importa.

**A tarefa da madrugada e o webhook do pagamento** usam `lojaPadrao()`, que com
uma unidade ativa é a resposta certa. Com duas, cada um precisa dizer de qual
loja está falando. Estão marcados no código.

**A auditoria de acesso** (`scripts/auditar-acesso.mjs`) confere se cliente
enxerga dado de cliente. Precisa conferir também se loja enxerga dado de loja.

**O site público e o link de agendamento** apontam para a loja padrão. Com duas
unidades, o cliente precisa escolher em qual quer marcar, provavelmente por slug
na URL (`barbershops.slug` já existe).

## Uma decisão que é do cliente, não do código

Crédito da casa, assinatura e fidelidade valem em qual unidade? O cliente que
assina na loja A pode usar na loja B? O ponto acumulado numa vale na outra?

Hoje cada um desses vive numa loja só, porque é o que o banco já dizia. Se o
Johnn quiser que valham na rede inteira, é mudança de regra de negócio e precisa
ser perguntada antes de programar, não decidida por quem escreve o código.
