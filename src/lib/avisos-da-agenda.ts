/**
 * Quem precisa saber quando a agenda mexe.
 *
 * Um lugar so para os dois sentidos:
 *
 *  - O cliente mexeu (marcou, confirmou, desmarcou): toca no celular do
 *    barbeiro dono daquela agenda, porque e ele que vai ficar esperando ou vai
 *    ganhar um buraco no dia. A gestao tambem recebe quando e horario novo.
 *
 *  - A casa mexeu (a recepcao marcou, o barbeiro encaixou, alguem cancelou):
 *    toca no celular do cliente, que nao estava vendo nada acontecer.
 *
 * Tudo aqui e best effort: aviso que falha nao pode derrubar o agendamento, a
 * confirmacao ou o cancelamento que estava acontecendo. Por isso cada funcao
 * engole o proprio erro em vez de deixar estourar.
 */
import { tocarNoCelular, tocarNaGestao, loginDoProfissional, loginDoCliente } from '@/lib/push';
import { quandoEmPalavras } from '@/lib/avisos';

/** Cliente marcou sozinho pelo aplicativo. */
export async function avisarQueClienteMarcou(dados: {
  staffId: string;
  nomeCliente: string;
  quandoISO: string;
  servico?: string | null;
}) {
  try {
    const quando = quandoEmPalavras(dados.quandoISO);
    const oQue = dados.servico ? `${dados.servico} · ` : '';

    await Promise.all([
      loginDoProfissional(dados.staffId).then((login) =>
        tocarNoCelular(login, {
          titulo: 'Novo cliente na sua agenda',
          corpo: `${dados.nomeCliente} marcou ${oQue}${quando}.`,
          url: '/painel/agenda',
          etiqueta: 'agenda',
        })
      ),
      tocarNaGestao({
        titulo: 'Agendamento pelo aplicativo',
        corpo: `${dados.nomeCliente} marcou ${oQue}${quando}.`,
        url: '/admin/agenda',
        etiqueta: 'agenda',
      }),
    ]);
  } catch {
    // O agendamento vale mais que o aviso
  }
}

/** Cliente confirmou presenca. */
export async function avisarQueClienteConfirmou(dados: {
  staffId: string;
  nomeCliente: string;
  quandoISO: string;
}) {
  try {
    const login = await loginDoProfissional(dados.staffId);
    await tocarNoCelular(login, {
      titulo: 'Presença confirmada',
      corpo: `${dados.nomeCliente} confirmou o horário de ${quandoEmPalavras(dados.quandoISO)}.`,
      url: '/painel/agenda',
      etiqueta: 'agenda',
    });
  } catch {
    // silencio
  }
}

/** Cliente desmarcou sozinho: o barbeiro precisa saber na hora. */
export async function avisarQueClienteDesmarcou(dados: {
  staffId: string;
  nomeCliente: string;
  quandoISO: string;
}) {
  try {
    const quando = quandoEmPalavras(dados.quandoISO);

    await Promise.all([
      loginDoProfissional(dados.staffId).then((login) =>
        tocarNoCelular(login, {
          titulo: 'Cliente desmarcou',
          corpo: `${dados.nomeCliente} desmarcou o horário de ${quando}.`,
          url: '/painel/agenda',
          etiqueta: 'agenda',
        })
      ),
      tocarNaGestao({
        titulo: 'Horário desmarcado',
        corpo: `${dados.nomeCliente} desmarcou ${quando}.`,
        url: '/admin/agenda',
        etiqueta: 'agenda',
      }),
    ]);
  } catch {
    // silencio
  }
}

/** A casa marcou um horario para o cliente. */
export async function avisarClienteQueMarcamos(dados: {
  customerId: string;
  quandoISO: string;
  servico?: string | null;
  profissional?: string | null;
}) {
  try {
    const login = await loginDoCliente(dados.customerId);
    const comQuem = dados.profissional ? ` com ${dados.profissional}` : '';
    await tocarNoCelular(login, {
      titulo: 'Marcamos seu horário',
      corpo: `${dados.servico ?? 'Seu horário'}${comQuem} em ${quandoEmPalavras(
        dados.quandoISO
      )}.`,
      url: '/cliente/agendamentos',
      etiqueta: 'meu-horario',
    });
  } catch {
    // silencio
  }
}

/** A casa desmarcou o horario do cliente. */
export async function avisarClienteQueDesmarcamos(dados: {
  customerId: string;
  quandoISO: string;
}) {
  try {
    const login = await loginDoCliente(dados.customerId);
    await tocarNoCelular(login, {
      titulo: 'Seu horário foi desmarcado',
      corpo: `O horário de ${quandoEmPalavras(dados.quandoISO)} não vai acontecer. Fale com a gente para remarcar.`,
      url: '/cliente/agendamentos',
      etiqueta: 'meu-horario',
    });
  } catch {
    // silencio
  }
}
