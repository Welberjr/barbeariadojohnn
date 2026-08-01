/**
 * Por onde esta pessoa pode entrar.
 *
 * O mesmo e-mail pode valer tres coisas ao mesmo tempo. O Johnn e dono, corta
 * cabelo e tambem e cliente da propria casa; o Welber administra e e cliente.
 * Antes o sistema escolhia sozinho e sempre mandava para a gestao, o que
 * obrigava a pessoa a procurar o caminho de volta para o lado que ela queria.
 *
 * Aqui a conta e feita uma vez e as portas sao mostradas. Quem so tem uma
 * porta nao ve tela nenhuma: entra direto, como sempre foi.
 *
 * O papel sai SEMPRE do cadastro no banco, nunca da etiqueta que o login
 * ganhou quando nasceu. Quem era freguês e virou barbeiro tem que entrar como
 * barbeiro no dia seguinte, sem ninguem mexer no login dele.
 */
import { createAdminClient } from '@/lib/supabase/admin';

export type PortaId = 'admin' | 'painel' | 'cliente';

export interface Porta {
  id: PortaId;
  titulo: string;
  descricao: string;
  destino: string;
}

export async function portasDoUsuario(userId: string): Promise<Porta[]> {
  const admin = createAdminClient();

  const [{ data: equipe }, { data: ficha }] = await Promise.all([
    admin
      .from('staff')
      .select('display_name, can_manage, atende_clientes, role')
      .eq('profile_id', userId)
      .eq('active', true)
      .is('fired_at', null)
      .maybeSingle(),
    admin
      .from('customers')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('active', true)
      .maybeSingle(),
  ]);

  const portas: Porta[] = [];

  if (equipe?.can_manage === true) {
    portas.push({
      id: 'admin',
      titulo: 'Gestão',
      descricao: 'Agenda da loja, caixa, financeiro, equipe e relatórios.',
      destino: '/admin',
    });
  }

  // Quem so administra nao tem agenda, entao esta porta abriria numa tela vazia
  if (equipe && equipe.atende_clientes !== false) {
    portas.push({
      id: 'painel',
      titulo: 'Meu painel de barbeiro',
      descricao: 'Só o seu dia: sua agenda, suas comandas e o seu acerto.',
      destino: '/painel',
    });
  }

  if (ficha) {
    portas.push({
      id: 'cliente',
      titulo: 'Minha conta de cliente',
      descricao: 'Agendar, ver seu histórico, seus pontos e seus créditos.',
      destino: '/cliente',
    });
  }

  // Quem trabalha aqui sempre tem para onde ir. Sem esta rede, um cadastro
  // marcado como "so administra" mas sem acesso de gestao ficaria sem porta
  // nenhuma e seria mandado para a tela de cadastro de cliente.
  if (equipe && portas.length === 0) {
    portas.push({
      id: 'painel',
      titulo: 'Meu painel',
      descricao: 'Seu dia de trabalho na barbearia.',
      destino: '/painel',
    });
  }

  return portas;
}

/** Para onde mandar quem tem uma porta so, ou nenhuma. */
export function destinoUnico(portas: Porta[]): string | null {
  if (portas.length === 1) return portas[0].destino;
  return null;
}
