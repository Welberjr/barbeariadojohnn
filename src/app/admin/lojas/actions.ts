'use server';

/**
 * Abrir e cuidar das unidades da rede.
 *
 * Quem mexe aqui e quem tem gestao. Isso e proposital e um pouco mais forte do
 * que parece: criar unidade e criar um lugar onde vai entrar dinheiro, e quem
 * cria ja entra dentro como gestor.
 */
import { canManageStore, createManagerClient } from '@/lib/supabase/manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionStaff } from '@/lib/staff-auth';
import { lojaAtual, COOKIE_DA_LOJA } from '@/lib/loja';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

/** Vira "barbearia-do-johnn-taguatinga" a partir do nome. */
function apelidoDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export interface DadosDaUnidade {
  nome: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  bairro?: string;
  rua?: string;
  numero?: string;
}

/**
 * Abre uma unidade nova.
 *
 * A unidade nasce com o horario, as taxas e as regras da unidade de onde a
 * pessoa esta criando. E o que ela espera: uma segunda loja da mesma rede
 * comeca parecida com a primeira, e o que for diferente ela ajusta depois. Bem
 * melhor do que abrir uma loja em branco, sem horario de funcionamento, e
 * descobrir isso quando o primeiro cliente tentar marcar.
 */
export async function abrirUnidade(dados: DadosDaUnidade) {
  const admin = await createManagerClient();
  const staff = await getSessionStaff();

  const nome = dados.nome?.trim();
  if (!nome || nome.length < 3) {
    return { ok: false, error: 'Escreva o nome da unidade.' };
  }

  const apelido = apelidoDoNome(nome);
  if (!apelido) {
    return { ok: false, error: 'Esse nome não gera um endereço válido. Use letras e números.' };
  }

  const { data: repetida } = await admin
    .from('barbershops')
    .select('id')
    .eq('slug', apelido)
    .maybeSingle();

  if (repetida) {
    return { ok: false, error: 'Já existe uma unidade com esse nome. Diferencie pelo bairro ou pela cidade.' };
  }

  // Copia as regras da unidade de onde ele esta criando
  const origemId = await lojaAtual();
  const { data: origem } = await admin
    .from('barbershops')
    .select(
      'business_hours, debit_fee_percent, credit_fee_percent, default_appointment_duration_minutes, primary_color, logo_url, loyalty_enabled, loyalty_points_per_brl, loyalty_points_per_real, loyalty_redemption_rate, vip_total_spent_threshold, no_show_fee_enabled, no_show_fee_percent, confirmation_hours_before, staff_default_view'
    )
    .eq('id', origemId)
    .maybeSingle();

  const { data: criada, error } = await admin
    .from('barbershops')
    .insert({
      ...(origem ?? {}),
      name: nome,
      slug: apelido,
      phone: dados.telefone?.trim() || null,
      address_city: dados.cidade?.trim() || null,
      address_state: dados.estado?.trim() || null,
      address_neighborhood: dados.bairro?.trim() || null,
      address_street: dados.rua?.trim() || null,
      address_number: dados.numero?.trim() || null,
      active: true,
    })
    .select('id, name')
    .single();

  if (error) return { ok: false, error: error.message };

  // Quem abriu entra como gestor da unidade nova. Sem isto ele criaria uma
  // loja que nao consegue abrir, e teria que mexer no banco para entrar nela.
  if (staff?.profileId) {
    const { error: erroEquipe } = await admin.from('staff').insert({
      barbershop_id: criada.id,
      profile_id: staff.profileId,
      display_name: staff.displayName,
      role: 'owner',
      active: true,
      can_manage: true,
      // Quem abre a unidade nao vira barbeiro dela: entra para administrar. Se
      // for atender tambem, marca isso no cadastro depois.
      atende_clientes: false,
      default_commission_percent: 0,
      permissions: {},
    });
    if (erroEquipe) {
      // A loja existe mas ninguem entra nela: melhor desfazer do que deixar
      // uma unidade orfa aparecendo na lista.
      await admin.from('barbershops').delete().eq('id', criada.id);

      // Banco que ainda tem a trava antiga, de um cadastro ativo por pessoa na
      // rede inteira. Ela impede exatamente o que a franquia precisa.
      if (/staff_one_active_per_profile/.test(erroEquipe.message)) {
        return {
          ok: false,
          error:
            'O banco ainda está travado para uma loja só. Rode a migração franquia-uma-pessoa-varias-lojas.sql e tente de novo. Nada foi salvo.',
        };
      }

      return {
        ok: false,
        error: 'Criei a unidade mas não consegui te dar acesso a ela. Nada foi salvo.',
      };
    }
  }

  revalidatePath('/admin/lojas');
  return { ok: true, id: criada.id as string, nome: criada.name as string };
}

/** Muda o nome e o endereco de uma unidade. */
export async function salvarUnidade(id: string, dados: DadosDaUnidade) {
  const admin = await createManagerClient();
  if (!(await canManageStore(id))) return { ok: false, error: 'Você não pode alterar esta unidade.' };

  const nome = dados.nome?.trim();
  if (!nome || nome.length < 3) return { ok: false, error: 'Escreva o nome da unidade.' };

  const { error } = await admin
    .from('barbershops')
    .update({
      name: nome,
      phone: dados.telefone?.trim() || null,
      address_city: dados.cidade?.trim() || null,
      address_state: dados.estado?.trim() || null,
      address_neighborhood: dados.bairro?.trim() || null,
      address_street: dados.rua?.trim() || null,
      address_number: dados.numero?.trim() || null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/lojas');
  return { ok: true };
}

/**
 * Fecha uma unidade.
 *
 * Nao apaga nada: o historico de faturamento, comanda e cliente continua de pe,
 * porque fechar uma loja nao apaga o que aconteceu nela. Ela some das listas e
 * ninguem consegue mais entrar.
 */
export async function fecharUnidade(id: string) {
  const admin = await createManagerClient();
  if (!(await canManageStore(id))) return { ok: false, error: 'Você não pode fechar esta unidade.' };

  const { data: ativas } = await admin
    .from('barbershops')
    .select('id')
    .eq('active', true);

  if ((ativas ?? []).length <= 1) {
    return { ok: false, error: 'Esta é a única unidade aberta. Fechar ela deixaria o sistema sem loja nenhuma.' };
  }

  const { count: agendados } = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('barbershop_id', id)
    .in('status', ['scheduled', 'confirmed'])
    .gte('start_at', new Date().toISOString());

  if ((agendados ?? 0) > 0) {
    return {
      ok: false,
      error: `Esta unidade tem ${agendados} horário(s) marcado(s) para frente. Avise os clientes e desmarque antes de fechar.`,
    };
  }

  const { error } = await admin.from('barbershops').update({ active: false }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/lojas');
  return { ok: true };
}

/** Reabre uma unidade fechada. */
export async function reabrirUnidade(id: string) {
  const admin = await createManagerClient();
  if (!(await canManageStore(id))) return { ok: false, error: 'Você não pode reabrir esta unidade.' };
  const { error } = await admin.from('barbershops').update({ active: true }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/lojas');
  return { ok: true };
}

/**
 * Troca a unidade que a pessoa esta vendo.
 *
 * O cookie sozinho nao da acesso a nada: toda tela confere no banco se ela
 * trabalha ali. Ainda assim conferimos aqui tambem, para a troca nao "funcionar"
 * e depois a tela aparecer vazia sem explicacao.
 */
export async function trocarDeUnidade(id: string) {
  const staff = await getSessionStaff();
  if (!staff) return { ok: false, error: 'Entre na sua conta de novo.' };

  const banco = createAdminClient();
  const { data: trabalhaLa } = await banco
    .from('staff')
    .select('id')
    .eq('profile_id', staff.profileId)
    .eq('barbershop_id', id)
    .eq('active', true)
    .is('fired_at', null)
    .maybeSingle();

  if (!trabalhaLa) return { ok: false, error: 'Você não trabalha nesta unidade.' };

  (await cookies()).set(COOKIE_DA_LOJA, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true };
}
