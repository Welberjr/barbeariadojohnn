import { HelpCircle } from 'lucide-react';
import { AjudaClient, type HelpArticle } from './_components/ajuda-client';

export const metadata = { title: 'Central de Ajuda' };

const S = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-fg leading-relaxed">{children}</p>
);
const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-bold text-gold mt-4 mb-1" style={{ fontFamily: 'var(--font-playfair), serif' }}>
    {children}
  </h3>
);
const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="text-sm text-fg-muted leading-relaxed">{children}</li>
);
const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>
);
const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md bg-gold/8 border border-gold/25 px-4 py-3 text-sm text-fg-muted">
    <span className="font-semibold text-gold">Dica: </span>{children}
  </div>
);
const Warn = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md bg-warning/8 border border-warning/25 px-4 py-3 text-sm text-fg-muted">
    <span className="font-semibold text-warning">Atenção: </span>{children}
  </div>
);

const ARTICLES: HelpArticle[] = [
  {
    id: 'dashboard', category: 'Gestão', icon: '📊', title: 'Dashboard',
    content: (
      <div className="space-y-3">
        <S>O Dashboard é a primeira tela que você vê ao entrar. Ele foi criado para responder a pergunta do dono ao chegar: o que está acontecendo agora?</S>
        <H>Os 4 cards do dia</H>
        <Ul>
          <Li><strong>Faturado hoje</strong> — soma das comandas já fechadas hoje, com número de vendas e ticket médio do dia.</Li>
          <Li><strong>Agenda de hoje</strong> — atendimentos concluídos vs. total agendado para hoje.</Li>
          <Li><strong>Em curso agora</strong> — comandas abertas neste momento e quanto somam (dinheiro ainda na casa).</Li>
          <Li><strong>Mês até agora</strong> — faturamento do mês com seta verde (crescimento) ou vermelha (queda) vs. mesmo período do mês passado.</Li>
        </Ul>
        <H>Alertas acionáveis</H>
        <S>Se existirem contas vencidas, assinaturas inadimplentes ou produtos com estoque baixo, um banner colorido aparece automaticamente. Clique nele para ir direto à tela que resolve o problema.</S>
        <H>Meta do mês</H>
        <S>Barra de progresso com o realizado (sólida), a projeção mantendo o ritmo atual (clara) e um traço que indica onde você deveria estar hoje proporcionalmente ao dia do mês.</S>
        <H>Gráfico 14 dias</H>
        <S>Barras de faturamento dos últimos 14 dias. Hoje fica destacado em dourado. Passe o mouse sobre cada barra para ver o valor exato.</S>
        <H>Equipe e serviços</H>
        <S>Ranking de faturamento dos profissionais e os serviços mais vendidos no mês, com barras proporcionais para comparação rápida.</S>
        <Tip>O Dashboard carrega os dados ao abrir e a cada nova ação no sistema. Não é preciso atualizar manualmente.</Tip>
      </div>
    ),
  },
  {
    id: 'agenda', category: 'Gestão', icon: '📅', title: 'Agenda',
    content: (
      <div className="space-y-3">
        <S>A Agenda mostra os agendamentos do dia em uma grade visual por barbeiro. É daqui que você controla quem está marcado, confirma presença e gerencia o fluxo do dia.</S>
        <H>Legenda de cores</H>
        <Ul>
          <Li><strong>Amarelo/dourado</strong> — Agendado (marcado, mas ainda não confirmado).</Li>
          <Li><strong>Verde</strong> — Confirmado (cliente confirmou presença).</Li>
          <Li><strong>Azul</strong> — Em atendimento (está na cadeira agora).</Li>
          <Li><strong>Cinza</strong> — Concluído (atendimento finalizado).</Li>
          <Li><strong>Vermelho</strong> — Cancelado.</Li>
          <Li><strong>Roxo</strong> — Não compareceu (no-show).</Li>
        </Ul>
        <H>Como confirmar um agendamento</H>
        <S>Clique sobre o bloco dourado na grade. O painel lateral desliza com os detalhes. Toque em "Confirmar" para mudar para verde. Use isso para saber quem realmente vai aparecer no dia.</S>
        <H>Criar um agendamento</H>
        <S>Clique no botão "+ Agendamento" no topo, ou clique em um horário vazio na grade de um barbeiro. Preencha cliente, serviço, barbeiro e horário.</S>
        <H>Marcar um grupo junto</H>
        <S>Pai e filho, dois amigos, a turma antes do casamento: no formulário de novo agendamento, em "Vem mais alguém junto?", toque em Somar e escolha o cliente e o profissional de cada pessoa. Todos ficam no mesmo horário, cada um com um barbeiro.</S>
        <S>Cada pessoa do grupo precisa de um profissional diferente, senão não dá para atender ao mesmo tempo. Se faltar horário para um deles, nenhum é marcado: grupo pela metade é pior do que nenhum, porque alguém chega e descobre na hora que ficou de fora.</S>
        <H>Quem confirmou presença</H>
        <S>O sistema pede a confirmação sozinho, no aplicativo do cliente, 24 horas antes. Na agenda você vê quem já respondeu. Quem não respondeu e está perto do horário aparece marcado, para a recepção correr atrás antes de perder a cadeira.</S>
        <H>Navegar entre datas</H>
        <S>Use as setas ao lado da data para ir ao dia anterior ou seguinte. O botão "Hoje" volta para o dia atual.</S>
        <Tip>Se a agenda de um barbeiro está vazia mas outros têm atendimentos, verifique a folga e a jornada dele em Disponibilidade.</Tip>
      </div>
    ),
  },
  {
    id: 'comandas', category: 'Gestão', icon: '🧾', title: 'Comandas',
    content: (
      <div className="space-y-3">
        <S>A Comanda é o registro de um atendimento. Ela abre quando o cliente chega e fecha quando ele paga. Tudo o que é vendido gera comissão automaticamente para o barbeiro.</S>
        <H>Abrir uma comanda</H>
        <S>Na tela de Comandas, toque em "+ Nova comanda". Selecione o cliente e o barbeiro responsável. A comanda fica com status Em curso.</S>
        <H>Adicionar serviços e produtos</H>
        <S>Dentro da comanda aberta, clique em "+ Adicionar" na seção de Serviços ou Produtos. Escolha o item e confirme o preço. O total atualiza na hora.</S>
        <H>Cobrança via assinatura</H>
        <S>Se o cliente for assinante e o dia for permitido pelo plano, o checkbox "Cobrir pela assinatura" aparece marcado. Isso zera o valor do serviço na comanda mas registra o uso no ciclo.</S>
        <H>Fechar a comanda</H>
        <S>Selecione a forma de pagamento: Dinheiro, PIX, Crédito ou Débito. Toque em "Fechar comanda". O sistema registra a venda, desconta estoque, calcula comissão e atualiza o financeiro.</S>
        <H>Filtros da lista</H>
        <Ul>
          <Li><strong>Hoje</strong> — comandas fechadas no dia atual.</Li>
          <Li><strong>Todas</strong> — histórico completo paginado (10 por página).</Li>
          <Li><strong>Data específica</strong> — escolha qualquer dia no campo de data.</Li>
        </Ul>
        <H>Errou depois de fechar</H>
        <S>O próprio barbeiro pode reabrir a comanda dele por até uma hora depois de fechar, corrigir e fechar de novo. Passou de uma hora, só a gestão resolve, pelo estorno, para não existir movimento mudando de valor no dia seguinte sem ninguém saber explicar.</S>
        <Warn>Cancelar uma comanda apaga os itens e não gera nenhuma venda. Use apenas se o atendimento não aconteceu.</Warn>
      </div>
    ),
  },
  {
    id: 'clientes', category: 'Gestão', icon: '👥', title: 'Clientes',
    content: (
      <div className="space-y-3">
        <S>A tela de Clientes é o cadastro completo da sua clientela. Cada cliente tem histórico de visitas, total gasto, pontos de fidelidade e, se for assinante, o status do clube.</S>
        <H>Cadastrar novo cliente</H>
        <S>Toque em "+ Novo cliente". Preencha no mínimo o nome. Telefone e e-mail são opcionais mas ajudam a identificar rapidamente quem chegou.</S>
        <H>Perfil do cliente</H>
        <S>Clique em qualquer cliente para abrir o perfil completo: total gasto, número de visitas, ticket médio, pontos acumulados, assinatura ativa e histórico de comandas.</S>
        <H>KPIs do topo</H>
        <Ul>
          <Li><strong>Total clientes</strong> — clientes ativos no cadastro.</Li>
          <Li><strong>Cliente VIP</strong> — quem mais gastou na barbearia desde o início.</Li>
          <Li><strong>Ticket médio</strong> — gasto médio por visita de toda a cartela.</Li>
          <Li><strong>Recorrentes</strong> — clientes com mais de uma visita.</Li>
        </Ul>
        <H>Cliente cadastrado pelo barbeiro</H>
        <S>O barbeiro também cadastra cliente na hora, pelo painel dele, com nome e telefone. Se o telefone já existir no cadastro, o sistema usa a ficha que existe em vez de criar outra, então a lista não enche de gente repetida.</S>
        <Tip>Sempre cadastre o cliente antes de abrir a comanda. Assim o histórico fica completo e a fidelidade funciona corretamente.</Tip>
      </div>
    ),
  },  {
    id: 'profissionais', category: 'Operação', icon: '✂️', title: 'Profissionais',
    content: (
      <div className="space-y-3">
        <S>Cadastre cada barbeiro ou atendente aqui. As configurações de comissão afetam diretamente o cálculo financeiro.</S>
        <H>Comissão padrão</H>
        <S>O percentual aplicado quando o serviço não tem comissão específica. Exemplo: 40% significa R$ 40 para cada R$ 100 em serviços.</S>
        <H>Comissão por serviço</H>
        <S>Em Profissionais, perfil, aba Serviços, defina comissões diferentes por tipo de serviço. Sobrescreve a comissão padrão.</S>
        <H>Acesso ao sistema</H>
        <S>No mesmo cadastro fica o bloco de acesso: a senha de entrada, o acesso de gestão e os seis módulos que você liga e desliga um por um. Está explicado em "Ligar e desligar o que cada um vê".</S>
        <Tip>Para ver o total de comissão acumulado de cada barbeiro, vá em Financeiro.</Tip>
      </div>
    ),
  },
  {
    id: 'disponibilidade', category: 'Operação', icon: '🕐', title: 'Disponibilidade',
    content: (
      <div className="space-y-3">
        <S>Define quando a barbearia funciona, quando cada profissional trabalha e quando está fechado. Sem isso configurado, a agenda pode aceitar agendamentos em dias fechados.</S>
        <H>Horário de funcionamento</H>
        <S>Marque quais dias da semana a barbearia abre e defina início e fim de cada dia. Vale para todo mundo que não tiver horário próprio.</S>
        <H>Jornada de cada profissional</H>
        <S>Cada pessoa tem um cartão. Enquanto estiver marcado "Segue o horário da barbearia", ela acompanha a loja e muda junto quando a loja mudar, sem ninguém precisar lembrar de atualizar um por um.</S>
        <S>Desmarque para dar horário próprio: segunda a sexta, sábado e domingo, com opção de "não atende" em qualquer um deles. É para quem entra mais tarde, sai mais cedo ou não trabalha no fim de semana.</S>
        <H>Horário de almoço</H>
        <S>Preencha a hora de parar e a de voltar. Nesse intervalo o cliente não consegue marcar com aquela pessoa. Vale todos os dias, e funciona também para quem segue o horário da loja: a barbearia continua aberta, mas aquele profissional não está na cadeira.</S>
        <S>Quem não para para almoçar é só deixar os dois campos em branco.</S>
        <H>Folgas e feriados</H>
        <S>Bloqueie dias específicos no calendário, da loja inteira ou de uma pessoa só. No dia configurado a agenda exibe aviso e impede novos agendamentos.</S>
        <Tip>O próprio barbeiro também pode bloquear um dia inteiro pelo painel dele, quando o dia não tiver ninguém marcado.</Tip>
      </div>
    ),
  },
  {
    id: 'servicos', category: 'Operação', icon: '💈', title: 'Serviços',
    content: (<div className="space-y-3"><S>O cardápio de serviços. Cada serviço tem preço, duração e comissão, usados nas comandas, na agenda e no financeiro.</S><H>Hierarquia de comissão</H><Ul><Li>1 Comissão do barbeiro para aquele serviço específico.</Li><Li>2 Comissão padrão do profissional.</Li><Li>3 Zero se nenhum percentual configurado.</Li></Ul><Tip>Desativar um serviço não apaga o histórico. Ele para de aparecer nas novas comandas.</Tip></div>),
  },
  {
    id: 'produtos', category: 'Operação', icon: '📦', title: 'Produtos',
    content: (<div className="space-y-3"><S>Itens físicos vendidos na barbearia. Podem ser vendidos em comanda ou como venda avulsa.</S><H>Campos importantes</H><Ul><Li>Preço de custo: para calcular lucro real no Financeiro.</Li><Li>Estoque mínimo: gera alerta no Dashboard quando atingido.</Li><Li>Comissão: percentual que o barbeiro recebe sobre cada produto vendido.</Li></Ul><H>Duplicar produto</H><S>Cria uma cópia com estoque zerado para ajustar os dados sem redigitar tudo.</S></div>),
  },
  {
    id: 'financeiro', category: 'Financeiro', icon: '💰', title: 'Financeiro',
    content: (<div className="space-y-3"><S>Resume tudo que movimentou dinheiro no período: receitas, comissões, formas de pagamento e ranking dos barbeiros.</S><H>Taxas de cartão</H><S>Em Configurações, defina o percentual de taxa de crédito e débito. Ao fechar uma comanda com cartão, o sistema calcula a taxa e a deduz da receita líquida automaticamente.</S><H>Vales</H><S>Um vale é um adiantamento de comissão. Quando aprovado, é deduzido do total de comissão do barbeiro no próximo pagamento.</S></div>),
  },
  {
    id: 'metas', category: 'Financeiro', icon: '🎯', title: 'Metas',
    content: (<div className="space-y-3"><S>Define e acompanha metas mensais de faturamento, atendimentos e ticket médio para a barbearia inteira ou por profissional.</S><H>Como ler as barras</H><Ul><Li>Barra sólida: realizado até agora.</Li><Li>Barra clara: projeção mantendo o ritmo atual.</Li><Li>Traço vertical: onde você deveria estar hoje proporcionalmente.</Li></Ul><H>Status por ritmo</H><Ul><Li>Superado: bateu 100% da meta.</Li><Li>Bom: acima de 90% do previsto.</Li><Li>Atenção: entre 60% e 90%.</Li><Li>Crítico: menos de 60% do esperado para hoje.</Li></Ul><Tip>O status compara o ritmo atual com o esperado para hoje, não com a meta cheia.</Tip></div>),
  },  {
    id: 'dre', category: 'Financeiro', icon: '📋', title: 'DRE',
    content: (<div className="space-y-3"><S>O relatório financeiro mais completo. Organiza toda movimentação em receitas, custos e despesas chegando ao lucro líquido real.</S><H>Estrutura</H><Ul><Li>Receita Bruta: serviços, produtos e extras.</Li><Li>Taxas de cartão: dedução das taxas de crédito e débito.</Li><Li>Custo dos produtos: preço de custo dos itens vendidos.</Li><Li>Comissões pagas: total quitado para a equipe.</Li><Li>Despesas operacionais: contas pagas no período.</Li><Li>Lucro Líquido: o que sobra no bolso.</Li></Ul><H>Gerar PDF</H><S>Clique em Baixar PDF. Selecione Salvar como PDF e desmarque Cabeçalhos e rodapés para resultado limpo.</S></div>),
  },
  {
    id: 'contas-pagar', category: 'Financeiro', icon: '📤', title: 'Contas a Pagar',
    content: (<div className="space-y-3"><S>Registra todas as saídas financeiras planejadas. Manter isso atualizado faz o DRE e o lucro serem precisos.</S><H>Pagar sem abrir a conta</H><S>Na lista, contas pendentes e vencidas têm um botão verde Pagar. Clique nele, escolha a forma de pagamento e confirme. Sem abrir o formulário completo.</S><H>Contas recorrentes</H><S>Marque como recorrente e o sistema cria a próxima ocorrência ao pagar a atual. Ideal para aluguel e contas mensais fixas.</S><Warn>Uma conta só afeta o DRE depois que for marcada como paga.</Warn></div>),
  },
  {
    id: 'assinaturas', category: 'Marketing', icon: '👑', title: 'Assinaturas',
    content: (<div className="space-y-3"><S>O Clube permite que clientes paguem uma mensalidade e tenham atendimentos com desconto. Receita recorrente que fideliza e garante caixa todo mês.</S><H>Dias permitidos</H><S>Cada plano tem dias da semana configurados. Fora desses dias, o cliente paga avulso sem consumir o uso do ciclo.</S><H>O Potinho dos barbeiros</H><S>Cálculo: valor do plano vezes percentual do Potinho. Rateado entre os barbeiros que atenderam o assinante no ciclo, proporcional ao número de atendimentos de cada um.</S><H>Ciclo vencido</H><S>Quando o ciclo vence sem pagamento, o status muda para Inadimplente. Registre o pagamento em Assinaturas para abrir o próximo ciclo.</S></div>),
  },
  {
    id: 'fidelidade', category: 'Marketing', icon: '🏆', title: 'Fidelidade',
    content: (<div className="space-y-3"><S>Acumula pontos a cada visita ou real gasto. Os pontos são trocados por prêmios que você cadastra em Fidelidade.</S><H>Como os pontos são creditados</H><S>Automaticamente ao fechar uma comanda, com base nas regras definidas. Clientes assinantes também pontuam sobre o valor original do serviço, mesmo quando coberto pelo plano.</S><Tip>Crie prêmios atrativos e divulgue o programa para aumentar a frequência de visitas.</Tip></div>),
  },
  {
    id: 'configuracoes', category: 'Sistema', icon: '⚙️', title: 'Configurações',
    content: (<div className="space-y-3"><S>Ajuste os dados principais da barbearia e as regras financeiras que afetam todo o sistema.</S><H>Como alterar a taxa de cartão</H><Ul><Li>Vá em Configurações, seção Financeiro.</Li><Li>Altere o percentual de crédito ou débito.</Li><Li>Clique em Salvar.</Li><Li>Novas comandas usam o novo percentual. Comandas já fechadas não são alteradas.</Li></Ul><H>Logo</H><S>Envie a logo do computador em PNG, JPG, SVG ou WEBP até 2MB, ou informe a URL de uma imagem já hospedada.</S><Warn>Percentuais de taxa errados distorcem o DRE. Revise sempre que mudar de maquininha.</Warn></div>),
  },
  {
    id: 'logica-comissao', category: 'Lógicas e Cálculos', icon: '📐', title: 'Como funciona a comissão',
    content: (<div className="space-y-3"><S>A comissão é calculada para cada item da comanda no momento em que ele é adicionado.</S><H>Hierarquia</H><Ul><Li>1 Comissão do barbeiro para aquele serviço específico.</Li><Li>2 Comissão padrão do profissional.</Li><Li>3 Zero se nenhum percentual configurado.</Li></Ul><H>Serviços cobertos por assinatura</H><S>Quando o serviço é coberto pelo plano, a comissão vem do Potinho, distribuído proporcionalmente entre quem atendeu o assinante no ciclo.</S><H>Registrar pagamento</H><S>Em Financeiro, Histórico de Comissões, clique em Registrar pagamento no card do barbeiro, selecione a forma e confirme.</S></div>),
  },
  {
    id: 'logica-cartao', category: 'Lógicas e Cálculos', icon: '💳', title: 'Como funciona o cartão',
    content: (<div className="space-y-3"><S>Quando uma comanda é fechada com cartão, o sistema calcula a taxa e a deduz da receita, garantindo que Financeiro e DRE mostrem a receita real.</S><H>Receita Líquida</H><S>Receita Líquida é igual a Receita Bruta menos as Taxas de Cartão. Se você vendeu R$ 10.000 e pagou R$ 200 em taxas, a Receita Líquida é R$ 9.800. O lucro é calculado sobre esse valor.</S><Tip>Revise o percentual toda vez que sua maquininha mudar de plano ou bandeira.</Tip></div>),
  },
  {
    id: 'logica-assinatura', category: 'Lógicas e Cálculos', icon: '🔄', title: 'Assinatura na comanda',
    content: (<div className="space-y-3"><S>Quando você abre a comanda de um cliente assinante, o sistema verifica automaticamente se ele pode usar o plano.</S><H>Condições para cobrir pelo plano</H><Ul><Li>Assinatura ativa e não vencida.</Li><Li>Dia da semana dentro dos dias permitidos pelo plano.</Li><Li>Ainda tem usos disponíveis no ciclo.</Li></Ul><H>Fora do dia permitido</H><S>O checkbox fica desabilitado com a explicação. O cliente paga avulso sem consumir o uso do ciclo.</S><H>Ciclo vencido</H><S>Checkbox bloqueado com aviso. Registre o pagamento em Assinaturas para abrir o ciclo novo.</S></div>),
  },

  // ---------------------------------------------------------------------
  // PAINEL DO BARBEIRO
  // ---------------------------------------------------------------------
  {
    id: 'painel-o-que-e', category: 'Painel do barbeiro', icon: '💈', title: 'O que o barbeiro vê',
    content: (
      <div className="space-y-3">
        <S>Cada profissional tem o painel dele, separado da gestão. Ele entra pelo mesmo endereço de login, com o e-mail e a senha dele, e cai direto no painel: nunca no admin.</S>
        <S>Tudo o que aparece ali é dele e só dele. A agenda dele, o dinheiro dele, os vales dele, os clientes que ele já atendeu. Ninguém vê o faturamento da casa nem o resultado dos colegas.</S>
        <H>As telas</H>
        <Ul>
          <Li><strong>Hoje</strong> — o próximo cliente, quantos faltam, quanto ele já produziu e quanto é de comissão.</Li>
          <Li><strong>Agenda</strong> — os atendimentos do dia, com o botão de confirmar, iniciar, concluir e marcar falta.</Li>
          <Li><strong>Comandas</strong> — abrir, lançar, fechar e cancelar a comanda dele.</Li>
          <Li><strong>Financeiro</strong> — produção e comissão do período, com o que já foi pago.</Li>
          <Li><strong>Vales</strong> — o que ele já pegou e o pedido de vale novo.</Li>
          <Li><strong>Clientes</strong> — quem ele atende, com quantas vezes e quanto costuma gastar.</Li>
        </Ul>
        <H>Primeiro acesso</H>
        <S>Você entrega a senha em Profissionais. Na primeira entrada o sistema obriga a pessoa a trocar por uma senha só dela, e a sua deixa de valer. Ninguém entra no painel antes de trocar.</S>
        <Tip>Quem tem "acesso de gestão" marcado entra no admin em vez do painel, e continua com o painel a um clique.</Tip>
      </div>
    ),
  },
  {
    id: 'painel-permissoes', category: 'Painel do barbeiro', icon: '🔑', title: 'Ligar e desligar o que cada um vê',
    content: (
      <div className="space-y-3">
        <S>Você decide, pessoa por pessoa, o que ela enxerga. Em Profissionais, abra o cadastro e use o bloco de acesso.</S>
        <H>Os seis módulos</H>
        <Ul>
          <Li><strong>Financeiro</strong> — ver a própria produção e comissão.</Li>
          <Li><strong>Ver vales</strong> — acompanhar os adiantamentos dele.</Li>
          <Li><strong>Pedir vale</strong> — solicitar adiantamento pelo painel. Só funciona junto com "ver vales".</Li>
          <Li><strong>Operar agenda</strong> — confirmar, iniciar, concluir, encaixar cliente e bloquear o dia.</Li>
          <Li><strong>Comanda</strong> — abrir e fechar a própria comanda.</Li>
          <Li><strong>Clientes</strong> — ver a lista de quem ele atende.</Li>
        </Ul>
        <S>O menu do painel muda na hora: o que está desligado some da tela dele e também deixa de funcionar por dentro, mesmo que alguém tente entrar pelo endereço direto.</S>
        <H>Acesso de gestão</H>
        <S>Chave separada, por pessoa. Quem tem, entra no admin e enxerga a barbearia inteira. Use com parcimônia: é o acesso do dono.</S>
        <Warn>O sistema não deixa tirar o acesso de gestão da última pessoa que tem. Sempre precisa sobrar alguém para abrir a porta.</Warn>
      </div>
    ),
  },
  {
    id: 'painel-encaixe', category: 'Painel do barbeiro', icon: '➕', title: 'Encaixar cliente e cadastrar na hora',
    content: (
      <div className="space-y-3">
        <S>O cliente chegou sem marcar e o barbeiro tem espaço. Na agenda dele, o botão "Encaixar cliente na minha agenda" resolve em três toques: quem é, o que vai fazer e que horas.</S>
        <S>O encaixe entra na agenda dele e em mais nenhuma. Ninguém encaixa cliente na agenda do colega.</S>
        <H>Cliente que nunca veio</H>
        <S>No próprio encaixe, e também na hora de abrir a comanda, tem "Cadastrar cliente novo". Pede nome e telefone e pronto, sem depender da recepção.</S>
        <S>Se o telefone já estiver no cadastro, o sistema usa a ficha que existe em vez de criar uma segunda. É o que evita a mesma pessoa aparecer três vezes na lista com o nome escrito de jeitos diferentes, e o histórico dela continua inteiro.</S>
        <H>Bloquear o dia</H>
        <S>O barbeiro pode fechar um dia inteiro da agenda dele, quando não tem ninguém marcado. Se já tiver cliente naquele dia, o sistema avisa e manda falar com a gestão para remarcar antes.</S>
      </div>
    ),
  },
  {
    id: 'painel-comanda', category: 'Painel do barbeiro', icon: '🧾', title: 'A comanda pelo painel',
    content: (
      <div className="space-y-3">
        <S>O barbeiro abre a comanda do cliente dele, lança serviço e produto, escolhe a forma de pagamento e fecha. A comissão sai calculada, o estoque baixa e o caixa recebe.</S>
        <H>Cliente foi embora antes de ser atendido</H>
        <S>Tem "Cancelar esta comanda". Antes disso, ele era obrigado a lançar alguma coisa só para conseguir fechar, o que sujava o caixa com venda que nunca existiu.</S>
        <S>Ao cancelar, produto lançado volta para o estoque e uso de assinatura volta para o cliente. O motivo fica gravado, então dá para perceber depois quem abre e desiste demais.</S>
        <H>Errou e percebeu na hora</H>
        <S>Por até uma hora depois de fechar, ele mesmo reabre, corrige e fecha de novo. Passou disso, é estorno pela gestão.</S>
        <H>O que ele não faz</H>
        <S>Desconto, comanda de outro profissional e apagar movimento continuam sendo coisa da gestão. Comanda com item lançado por outro barbeiro ele não fecha nem cancela, para a comissão do colega não sair errada.</S>
      </div>
    ),
  },

  // ---------------------------------------------------------------------
  // APLICATIVO DO CLIENTE
  // ---------------------------------------------------------------------
  {
    id: 'cliente-o-que-e', category: 'Aplicativo do cliente', icon: '📱', title: 'O que o cliente vê',
    content: (
      <div className="space-y-3">
        <S>O cliente tem a área dele, com login próprio. É onde ele marca horário sozinho, acompanha os pontos e vê a assinatura, sem precisar ligar para a barbearia.</S>
        <H>O que ele faz por lá</H>
        <Ul>
          <Li><strong>Agendar</strong> — escolhe serviço, profissional e horário. Só aparecem horários realmente livres, respeitando a jornada e o almoço de quem vai atender.</Li>
          <Li><strong>Meus agendamentos</strong> — os próximos e o histórico, com cancelamento até 2 horas antes.</Li>
          <Li><strong>Confirmar presença</strong> — responde ao aviso da barbearia sem sair do aplicativo.</Li>
          <Li><strong>Clube e benefícios</strong> — pontos, prêmios, ranking e a assinatura dele.</Li>
          <Li><strong>Loja</strong> — os produtos da barbearia.</Li>
          <Li><strong>Notificações</strong> — tudo o que a barbearia avisou.</Li>
        </Ul>
        <Tip>Nada do que o cliente vê expõe a operação: ele enxerga o que é dele, e só.</Tip>
      </div>
    ),
  },
  {
    id: 'cliente-confirmacao', category: 'Aplicativo do cliente', icon: '✅', title: 'Confirmação de presença',
    content: (
      <div className="space-y-3">
        <S>Um dia antes do atendimento, o sistema manda sozinho um aviso para o cliente pedindo que ele confirme se vem. O aviso chega no aplicativo dele, não por WhatsApp: o WhatsApp fica com uma pessoa de verdade.</S>
        <H>Como aparece para cada um</H>
        <Ul>
          <Li><strong>Cliente</strong> — o horário dele ganha um botão "Confirmar que eu vou". Um toque e pronto.</Li>
          <Li><strong>Barbeiro</strong> — na agenda dele aparece "Cliente confirmou", "Aguardando confirmação" ou "Não respondeu".</Li>
          <Li><strong>Gestão</strong> — a mesma informação na agenda da barbearia.</Li>
        </Ul>
        <S>"Não respondeu" só aparece quando o horário está chegando perto. Antes disso o cliente ainda tem tempo, e cobrar cedo demais assusta sem necessidade.</S>
        <H>Quantas horas antes</H>
        <S>Sai 24 horas antes. O aviso é feito uma vez só por atendimento: ninguém recebe o mesmo pedido de hora em hora.</S>
        <Tip>Cliente que não responde e não aparece é justamente quem vale a pena chamar antes, para a cadeira não ficar parada.</Tip>
      </div>
    ),
  },

  // ---------------------------------------------------------------------
  // MARKETING E SISTEMA (o que entrou depois)
  // ---------------------------------------------------------------------
  {
    id: 'clientes-sumidos', category: 'Marketing', icon: '🔎', title: 'Clientes sumidos',
    content: (
      <div className="space-y-3">
        <S>A lista de quem era cliente e parou de voltar. Serve para alguém pegar o telefone e chamar de volta, em vez de esperar a pessoa lembrar sozinha.</S>
        <H>Como a lista decide quem está sumido</H>
        <S>Cada um é comparado com o ritmo dele, não com uma régua igual para todos. Quem vinha toda semana e sumiu há um mês aparece antes de quem sempre veio de três em três meses. Quem veio poucas vezes usa o prazo padrão da casa, que você escolhe no topo da tela.</S>
        <H>O que aparece de cada um</H>
        <S>Nome, há quanto tempo não vem, de quanto em quanto tempo costumava vir, o serviço que ele costuma fazer, quantas visitas, quanto já gastou e o telefone.</S>
        <H>Chamar e marcar como falado</H>
        <S>O botão "Chamar" abre a conversa no WhatsApp com a mensagem pronta, já com o primeiro nome e o serviço de costume. Depois, marque "Já falei" para o cliente sair da fila e duas pessoas não ligarem para ele no mesmo dia.</S>
        <Tip>O valor no topo mostra quanto já gastou aqui a turma que parou de voltar. É o tamanho do dinheiro que está em jogo.</Tip>
      </div>
    ),
  },
  {
    id: 'sobra-assinatura', category: 'Lógicas e Cálculos', icon: '🫙', title: 'A sobra da assinatura',
    content: (
      <div className="space-y-3">
        <S>O assinante paga uma mensalidade e tem direito a um número de atendimentos. Quase nunca ele usa todos. O que sobra é dinheiro que ficou na casa, e a tela de Assinaturas mostra isso por cliente.</S>
        <H>Como o cálculo funciona</H>
        <S>O valor do plano é dividido pelos atendimentos incluídos, o que dá quanto vale cada corte. Os cortes que ele usou vão para os barbeiros que atenderam, na proporção de quantos cada um fez. O que não foi usado é a sobra.</S>
        <H>Para onde vai a sobra</H>
        <Ul>
          <Li><strong>Fica com a barbearia</strong> — o padrão.</Li>
          <Li><strong>Divide igual</strong> — reparte entre quem atendeu o assinante no ciclo.</Li>
          <Li><strong>Quem atendeu mais</strong> — vai inteira para quem mais atendeu aquele cliente.</Li>
        </Ul>
        <S>Você escolhe o destino, e a tela mostra quanto cada barbeiro tem a receber daquele cliente antes de pagar.</S>
        <Warn>A sobra só existe depois que o ciclo fecha. Enquanto o mês está correndo, o cliente ainda pode usar o que falta.</Warn>
      </div>
    ),
  },
  {
    id: 'um-login', category: 'Sistema', icon: '🔁', title: 'Quem trabalha aqui e também é cliente',
    content: (
      <div className="space-y-3">
        <S>Quem trabalha na barbearia também corta cabelo nela. O Jonathan é dono, barbeiro e cliente ao mesmo tempo: quando um colega atende ele, aquilo é uma comanda de verdade, com pagamento de verdade, e a comissão é do colega.</S>
        <S>Não precisa de dois cadastros nem de duas senhas. O mesmo e-mail abre os dois lados.</S>
        <H>Como ligar</H>
        <S>No painel, em Perfil, existe "Também sou cliente aqui". Basta informar o telefone. Se já existir ficha com aquele telefone, o sistema liga a ela e o histórico de cortes vem junto, em vez de começar do zero.</S>
        <H>Como trocar de lado</H>
        <S>Do painel, "Abrir minha conta de cliente". De volta, no perfil de cliente, "Voltar para o meu painel". Sem sair da conta e sem digitar senha de novo.</S>
        <Tip>Quem já era freguês da casa e passou a trabalhar aqui também entra normalmente no painel: o que vale é o cadastro de hoje.</Tip>
      </div>
    ),
  },
];

export default function AjudaPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Sistema</p>
        <h1 className="text-3xl text-fg font-bold flex items-center gap-3" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          <HelpCircle className="w-7 h-7 text-gold" />
          Central de Ajuda
        </h1>
        <p className="text-sm text-fg-muted mt-2">
          Tudo o que você precisa saber para usar o sistema com confiança.
        </p>
      </div>
      <div className="divider-gold" />
      <AjudaClient articles={ARTICLES} />
    </div>
  );
}