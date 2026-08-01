'use server';

/**
 * Cadastro rapido de cliente pelo painel do barbeiro.
 *
 * O caso e o da porta da rua: chegou alguem que nunca veio, quer cortar agora.
 * Antes o barbeiro travava aqui, porque cliente novo so nascia pela recepcao ou
 * pelo aplicativo. Este cadastro pede o minimo para o atendimento acontecer:
 * nome e, quando tiver, telefone. O resto a gestao completa depois.
 *
 * O cliente nasce sem login: quem cria conta e o proprio cliente pelo
 * aplicativo. Aqui e so a ficha, para poder encaixar na agenda e abrir comanda.
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionStaff } from '@/lib/staff-auth';
import { podeModulo } from '@/lib/staff-permissions';
import { BARBERSHOP_ID } from '@/lib/painel/dados';
import { normalizarTelefone, variantesDoTelefone } from '@/lib/telefone';


export async function cadastrarClienteRapido(dados: {
  nome: string;
  telefone?: string;
}) {
  const staff = await getSessionStaff();
  if (!staff) return { ok: false as const, error: 'Sessão expirada. Entre de novo.' };
  if (staff.mustChangePassword) {
    return { ok: false as const, error: 'Troque a senha antes de usar o painel.' };
  }

  // Quem encaixa na agenda ou abre comanda precisa poder cadastrar: sao os dois
  // lugares onde o cliente novo aparece na frente do barbeiro.
  const podeCadastrar =
    podeModulo(staff, 'agenda_operar') || podeModulo(staff, 'comanda');
  if (!podeCadastrar) {
    return { ok: false as const, error: 'Você não tem acesso a esta função.' };
  }

  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  if (nome.length < 3) {
    return { ok: false as const, error: 'Escreva o nome completo do cliente.' };
  }
  if (nome.length > 80) {
    return { ok: false as const, error: 'Nome muito longo.' };
  }

  const telefone = dados.telefone?.trim() ? normalizarTelefone(dados.telefone) : null;
  if (dados.telefone?.trim() && !telefone) {
    return { ok: false as const, error: 'Telefone incompleto. Use DDD e número.' };
  }

  const admin = createAdminClient();

  // Telefone repetido quase sempre e o mesmo cliente cadastrado de novo com o
  // nome escrito de outro jeito. Em vez de criar a segunda ficha, devolve a que
  // ja existe: e o que evita o cadastro da barbearia virar uma lista com o
  // mesmo cliente tres vezes.
  if (telefone) {
    // Procura por todas as formas do mesmo numero: 399 dos 415 clientes estao
    // gravados sem o nono digito, e quase todos com o 55 na frente.
    const { data: encontradas } = await admin
      .from('customers')
      .select('id, full_name, phone, active')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('phone', variantesDoTelefone(telefone))
      .limit(1);

    const existente = (encontradas ?? [])[0] ?? null;

    if (existente) {
      if (!existente.active) {
        await admin.from('customers').update({ active: true }).eq('id', existente.id);
      }
      return {
        ok: true as const,
        jaExistia: true,
        cliente: {
          id: existente.id as string,
          full_name: existente.full_name as string,
          phone: (existente.phone as string) ?? null,
        },
      };
    }
  }

  const { data: criado, error } = await admin
    .from('customers')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      full_name: nome,
      phone: telefone,
      active: true,
      source: 'painel_barbeiro',
    })
    .select('id, full_name, phone')
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/painel/clientes');
  return {
    ok: true as const,
    jaExistia: false,
    cliente: {
      id: criado.id as string,
      full_name: criado.full_name as string,
      phone: (criado.phone as string) ?? null,
    },
  };
}
