/**
 * Permissoes do painel do barbeiro (parte pura, sem banco e sem sessao).
 *
 * Regras de ouro:
 *  - chave desconhecida nao existe
 *  - qualquer valor que nao seja o booleano true significa desligado
 *  - vales_pedir so vale quando vales_ver tambem esta ligado
 *  - quem tem acesso de gestao ve tudo
 *
 * Ler `permissions.financeiro` direto do banco e proibido: passe sempre por
 * parseStaffPermissions, senao um "true" em texto ou um erro de digitacao
 * viram permissao silenciosa.
 */

export const MODULOS = [
  'financeiro',
  'vales_ver',
  'vales_pedir',
  'agenda_operar',
  'comanda',
  'clientes',
] as const;

export type Modulo = (typeof MODULOS)[number];

export type Permissoes = Record<Modulo, boolean>;

export const PERMISSOES_VAZIAS: Permissoes = {
  financeiro: false,
  vales_ver: false,
  vales_pedir: false,
  agenda_operar: false,
  comanda: false,
  clientes: false,
};

/** Rotulo e explicacao usados na tela do profissional, no admin. */
export const MODULO_INFO: Record<Modulo, { label: string; ajuda: string }> = {
  financeiro: {
    label: 'Meu financeiro',
    ajuda: 'Vê a própria produção, a comissão, os vales descontados e o que tem a receber.',
  },
  vales_ver: {
    label: 'Meus vales',
    ajuda: 'Vê os vales dele, com valor, motivo, data e situação.',
  },
  vales_pedir: {
    label: 'Pedir vale',
    ajuda: 'Solicita vale pelo painel. O pedido chega aqui para você aprovar ou recusar.',
  },
  agenda_operar: {
    label: 'Operar a agenda',
    ajuda: 'Confirma presença, conclui atendimento, marca falta, bloqueia horário e encaixa cliente.',
  },
  comanda: {
    label: 'Minha comanda',
    ajuda: 'Abre e fecha a própria comanda, inclusive cobrindo o atendimento pela assinatura.',
  },
  clientes: {
    label: 'Meus clientes',
    ajuda: 'Vê a lista de clientes que ele já atendeu, com histórico e preferências.',
  },
};

/** Sugestao aplicada no cadastro conforme o papel. O gestor ajusta depois. */
export const PRESETS_POR_PAPEL: Record<string, { canManage: boolean; modulos: Modulo[] }> = {
  owner: { canManage: true, modulos: [...MODULOS] },
  manager: { canManage: true, modulos: [...MODULOS] },
  barber: {
    canManage: false,
    modulos: ['financeiro', 'vales_ver', 'vales_pedir'],
  },
  receptionist: { canManage: false, modulos: ['agenda_operar', 'comanda'] },
  assistant: { canManage: false, modulos: [] },
};

function isModulo(valor: string): valor is Modulo {
  return (MODULOS as readonly string[]).includes(valor);
}

/**
 * Le o jsonb do banco com desconfianca e devolve o mapa completo.
 * Entrada invalida nunca vira permissao: no maximo vira falso.
 */
export function parseStaffPermissions(raw: unknown): Permissoes {
  const out: Permissoes = { ...PERMISSOES_VAZIAS };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  for (const [chave, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (!isModulo(chave)) continue;
    out[chave] = valor === true;
  }

  // Dependencia: pedir vale sem enxergar vale nao faz sentido
  if (!out.vales_ver) out.vales_pedir = false;

  return out;
}

/** Monta o jsonb que vai para o banco a partir das chaves marcadas na tela. */
export function buildStaffPermissions(modulos: string[]): Permissoes {
  const marcados: Record<string, boolean> = {};
  for (const m of modulos) {
    if (isModulo(m)) marcados[m] = true;
  }
  return parseStaffPermissions(marcados);
}

export interface StaffAcesso {
  canManage: boolean;
  permissions: Permissoes;
  active: boolean;
}

/**
 * Unica fonte de verdade sobre "pode ou nao pode".
 * Profissional inativo nao pode nada, nem sendo gestor.
 */
export function podeModulo(staff: StaffAcesso, modulo: Modulo): boolean {
  if (!staff.active) return false;
  if (staff.canManage) return true;
  return staff.permissions[modulo] === true;
}

/** Modulos visiveis no menu do painel, na ordem em que aparecem. */
export function modulosLiberados(staff: StaffAcesso): Modulo[] {
  return MODULOS.filter((m) => podeModulo(staff, m));
}
