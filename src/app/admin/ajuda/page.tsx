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
        <H>Navegar entre datas</H>
        <S>Use as setas ao lado da data para ir ao dia anterior ou seguinte. O botão "Hoje" volta para o dia atual.</S>
        <Tip>Se a agenda de um barbeiro está vazia mas outros têm atendimentos, verifique se ele tem folga cadastrada em Disponibilidade.</Tip>
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
        <Tip>Sempre cadastre o cliente antes de abrir a comanda. Assim o histórico fica completo e a fidelidade funciona corretamente.</Tip>
      </div>
    ),
  },  {
    id: 'profissionais', category: 'Operação', icon: '✂️', title: 'Profissionais',
    content: (<div className="space-y-3"><S>Cadastre cada barbeiro ou atendente aqui. As configurações de comissão afetam diretamente o cálculo financeiro.</S><H>Comissão padrão</H><S>O percentual aplicado quando o serviço não tem comissão específica. Exemplo: 40% significa R$ 40 para cada R$ 100 em serviços.</S><H>Comissão por serviço</H><S>Em Profissionais, perfil, aba Serviços, defina comissões diferentes por tipo de serviço. Sobrescreve a comissão padrão.</S><Tip>Para ver o total de comissão acumulado de cada barbeiro, vá em Financeiro.</Tip></div>),
  },
  {
    id: 'disponibilidade', category: 'Operação', icon: '🕐', title: 'Disponibilidade',
    content: (<div className="space-y-3"><S>Define quando a barbearia funciona e quando está fechada. Sem isso configurado, a agenda pode aceitar agendamentos em dias fechados.</S><H>Horário de funcionamento</H><S>Marque quais dias da semana a barbearia abre e defina início e fim de cada dia.</S><H>Folgas e feriados</H><S>Bloqueie dias específicos no calendário. No dia configurado a agenda exibe aviso e impede novos agendamentos.</S></div>),
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