import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exigirGestao, getSessionStaff } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

/**
 * Diagnostico de latencia, temporario.
 * Mede no proprio servidor quanto custa cada etapa de uma acao, para separar
 * o que e rede do usuario e o que e o sistema.
 */
export async function GET() {
  const acesso = await exigirGestao();
  if (!acesso.ok) {
    return NextResponse.json({ error: acesso.error }, { status: 403 });
  }

  const marcas: Record<string, number> = {};
  const medir = async (nome: string, fn: () => Promise<unknown>) => {
    const t0 = performance.now();
    await fn();
    marcas[nome] = Math.round(performance.now() - t0);
  };

  const admin = createAdminClient();

  await medir('validar_token_auth', async () => {
    const supabase = await createClient();
    await supabase.auth.getUser();
  });

  await medir('consulta_staff_com_profile', async () => {
    await admin
      .from('staff')
      .select('id, can_manage, permissions, profile:profiles!staff_profile_id_fkey ( full_name, email )')
      .eq('profile_id', acesso.staff.userId)
      .maybeSingle();
  });

  await medir('consulta_simples_1_linha', async () => {
    await admin.from('barbershops').select('id').limit(1);
  });

  await medir('quatro_consultas_em_paralelo', async () => {
    await Promise.all([
      admin.from('comandas').select('id').eq('status', 'open').limit(20),
      admin.from('products').select('id, stock_current, stock_minimum').limit(50),
      admin.from('bills').select('id').eq('status', 'pending').limit(10),
      admin.from('allowances').select('id').eq('status', 'pending').limit(10),
    ]);
  });

  await medir('guarda_completa_getSessionStaff', async () => {
    await getSessionStaff();
  });

  const total = Object.values(marcas).reduce((s, v) => s + v, 0);

  return NextResponse.json({
    regiao: process.env.VERCEL_REGION ?? 'local',
    marcas,
    somaDasEtapas: total,
  });
}
