'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { getSessionStaff } from '@/lib/staff-auth';
import { lojaAtual } from '@/lib/loja';
import { revalidatePath } from 'next/cache';
const PHOTO_BUCKET = 'customer-photos';

export interface CustomerFormData {
  full_name: string;
  phone: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  notes?: string;
  allergies?: string;
  preferred_barber_id?: string;
  accepts_marketing: boolean;
  active: boolean;
  photo_url?: string | null;
}

export async function createCustomer(data: CustomerFormData) {
  const admin = await createManagerClient();

  const { data: created, error } = await admin
    .from('customers')
    .insert({
      barbershop_id: (await lojaAtual()),
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      cpf: data.cpf || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
      allergies: data.allergies || null,
      preferred_barber_id: data.preferred_barber_id || null,
      accepts_marketing: data.accepts_marketing,
      active: data.active,
      photo_url: data.photo_url || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes');
  return { ok: true, customerId: created?.id as string | undefined };
}

export async function updateCustomer(id: string, data: CustomerFormData) {
  const admin = await createManagerClient();

  const { error } = await admin
    .from('customers')
    .update({
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      cpf: data.cpf || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
      allergies: data.allergies || null,
      preferred_barber_id: data.preferred_barber_id || null,
      accepts_marketing: data.accepts_marketing,
      active: data.active,
      photo_url: data.photo_url || null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes');
  revalidatePath(`/admin/clientes/${id}`);
  return { ok: true };
}

export async function deactivateCustomer(id: string) {
  const admin = await createManagerClient();
  const { error } = await admin
    .from('customers')
    .update({ active: false })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes');
  return { ok: true };
}

// =============================================================================
// FOTO DO CLIENTE (Supabase Storage, bucket publico customer-photos)
// =============================================================================

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Sobe a foto do cliente e retorna a URL publica.
 * A foto aparece para a equipe (lista/comanda) e para o proprio cliente
 * no painel dele.
 */
export async function uploadCustomerPhoto(formData: FormData) {
  const file = formData.get('photo');
  if (!file || !(file instanceof File)) {
    return { ok: false as const, error: 'Nenhum arquivo enviado' };
  }
  const ext = ALLOWED_PHOTO_TYPES[file.type];
  if (!ext) {
    return { ok: false as const, error: 'Formato inválido. Use JPG, PNG ou WEBP.' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false as const, error: 'Arquivo muito grande (máximo 5MB)' };
  }

  const admin = await createManagerClient();
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) return { ok: false as const, error: error.message };

  const { data: pub } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { ok: true as const, url: pub.publicUrl };
}

// =============================================================================
// ACESSO AO PAINEL DO CLIENTE (Supabase Auth)
// =============================================================================

/**
 * Cria o login do cliente no painel (/cliente).
 * O barbeiro define e-mail + senha e entrega ao cliente.
 */
export async function createCustomerAccess(
  customerId: string,
  email: string,
  password: string
) {
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Informe um e-mail válido' };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: 'A senha precisa ter no mínimo 6 caracteres' };
  }

  const admin = await createManagerClient();

  const { data: customer } = await admin
    .from('customers')
    .select('id, auth_user_id, full_name')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return { ok: false, error: 'Cliente não encontrado' };
  if (customer.auth_user_id) {
    return {
      ok: false,
      error: 'Este cliente já tem acesso. Use "Redefinir senha".',
    };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'customer',
      customer_id: customerId,
      full_name: customer.full_name,
    },
  });

  if (error || !created?.user) {
    const msg = error?.message ?? 'Erro ao criar acesso';
    if (msg.toLowerCase().includes('already')) {
      return { ok: false, error: 'Já existe um usuário com este e-mail' };
    }
    return { ok: false, error: msg };
  }

  const { error: errLink } = await admin
    .from('customers')
    .update({ auth_user_id: created.user.id, email: cleanEmail })
    .eq('id', customerId);

  if (errLink) {
    // rollback para nao deixar usuario orfao
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: errLink.message };
  }

  revalidatePath(`/admin/clientes/${customerId}`);
  return { ok: true };
}

/**
 * Redefine a senha do acesso do cliente.
 */
export async function resetCustomerPassword(
  customerId: string,
  newPassword: string
) {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'A senha precisa ter no mínimo 6 caracteres' };
  }

  const admin = await createManagerClient();

  const { data: customer } = await admin
    .from('customers')
    .select('auth_user_id')
    .eq('id', customerId)
    .maybeSingle();

  if (!customer?.auth_user_id) {
    return { ok: false, error: 'Este cliente ainda não tem acesso ao painel' };
  }

  const { error } = await admin.auth.admin.updateUserById(
    customer.auth_user_id as string,
    { password: newPassword }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Da credito para um cliente gastar na barbearia.
 *
 * E o caso da permuta: alguem presta um servico e recebe em atendimento em vez
 * de dinheiro. Fica gravado quem deu, por que, e ate quando vale.
 */
export async function concederCredito(dados: {
  customerId: string;
  valor: number;
  motivo: string;
  inicio: string;
  vencimento: string | null;
}) {
  const admin = await createManagerClient();

  const valor = Number(dados.valor);
  if (!(valor > 0)) {
    return { ok: false, error: 'O valor do crédito precisa ser maior que zero.' };
  }
  if (!dados.motivo?.trim()) {
    return { ok: false, error: 'Escreva o motivo do crédito.' };
  }
  if (dados.vencimento && dados.vencimento < dados.inicio) {
    return { ok: false, error: 'O vencimento não pode ser antes do início.' };
  }

  const staff = await getSessionStaff();

  const { error } = await admin.from('customer_credits').insert({
    barbershop_id: (await lojaAtual()),
    customer_id: dados.customerId,
    amount: valor,
    reason: dados.motivo.trim(),
    starts_at: dados.inicio,
    expires_at: dados.vencimento,
    // Mesmo autor que o resto da auditoria do sistema: o profile de quem agiu
    granted_by: staff?.profileId ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clientes/${dados.customerId}`);
  return { ok: true };
}

/**
 * Cancela um credito.
 *
 * Nao apaga: some do saldo mas continua no historico, com o motivo. O que ja
 * foi gasto antes do cancelamento continua gasto.
 */
export async function cancelarCredito(creditoId: string, motivo: string) {
  const admin = await createManagerClient();

  const { data: credito } = await admin
    .from('customer_credits')
    .select('customer_id, cancelled_at')
    .eq('id', creditoId)
    .maybeSingle();

  if (!credito) return { ok: false, error: 'Crédito não encontrado.' };
  if (credito.cancelled_at) return { ok: false, error: 'Este crédito já está cancelado.' };

  const { error } = await admin
    .from('customer_credits')
    .update({
      cancelled_at: new Date().toISOString(),
      cancellation_reason: motivo?.trim() || null,
    })
    .eq('id', creditoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clientes/${credito.customer_id}`);
  return { ok: true };
}
