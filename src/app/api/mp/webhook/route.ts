export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Webhook do Mercado Pago.
 *
 * MP envia notificações quando um pagamento muda de status.
 * Esperamos eventos type=payment com data.id = payment_id.
 *
 * Workflow:
 * 1. Recebe notificação
 * 2. Busca detalhes do pagamento via fetchMPPayment
 * 3. Se status=approved, atualiza comanda (mp_payment_id, payment_method, etc.)
 *
 * Para teste, MP envia eventos de teste no Sandbox.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchMPPayment } from '@/lib/mercadopago';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json().catch(() => ({}));
    const searchParams = req.nextUrl.searchParams;

    // MP envia query params também (type, data.id)
    const eventType = body.type ?? searchParams.get('type');
    const paymentId =
      body.data?.id ?? searchParams.get('data.id') ?? body.id;

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[MP Webhook]', { eventType, paymentId, body });
    }

    if (eventType !== 'payment' || !paymentId) {
      return NextResponse.json({ ok: true, skipped: 'not_payment_event' });
    }

    // Busca detalhes do pagamento via API
    const result = await fetchMPPayment(String(paymentId));

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }

    const payment = result.data;
    const status = payment.status as string;
    const externalReference = payment.external_reference as
      | string
      | undefined;

    // Esperamos external_reference no formato "comanda:UUID"
    if (!externalReference || !externalReference.startsWith('comanda:')) {
      return NextResponse.json({ ok: true, skipped: 'no_comanda_ref' });
    }

    const comandaId = externalReference.replace('comanda:', '');
    const admin = createAdminClient();

    if (status === 'approved') {
      // Marca a comanda como paga e registra pagamento
      const { data: comanda } = await admin
        .from('comandas')
        .select('id, total, status, customer_id, appointment_id')
        .eq('id', comandaId)
        .maybeSingle();

      if (!comanda) {
        return NextResponse.json({
          ok: true,
          skipped: 'comanda_not_found',
        });
      }

      // Se já estava fechada, idempotência: só registra pagamento se ainda não existe
      const { data: existingPayment } = await admin
        .from('comanda_payments')
        .select('id')
        .eq('comanda_id', comandaId)
        .eq('mp_payment_id', String(paymentId))
        .maybeSingle();

      if (existingPayment) {
        return NextResponse.json({ ok: true, skipped: 'already_processed' });
      }

      // Cria registro de pagamento
      const total = Number(comanda.total ?? payment.transaction_amount ?? 0);
      await admin.from('comanda_payments').insert({
        barbershop_id: BARBERSHOP_ID,
        comanda_id: comandaId,
        method: 'mp_online',
        amount: total,
        installments: 1,
        fee_percent: 0,
        fee_value: 0,
        net_amount: total,
        mp_payment_id: String(paymentId),
        mp_status: status,
      });

      // Fecha a comanda se ainda estava aberta
      if (comanda.status === 'open') {
        await admin
          .from('comandas')
          .update({
            status: 'closed',
            total,
            net_total: total,
            closed_at: new Date().toISOString(),
          })
          .eq('id', comandaId);

        // Marca appointment como completed se houver
        if (comanda.appointment_id) {
          await admin
            .from('appointments')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              comanda_id: comandaId,
            })
            .eq('id', comanda.appointment_id);
        }
      }

      return NextResponse.json({
        ok: true,
        processed: 'approved',
        comandaId,
        paymentId: String(paymentId),
      });
    }

    // Outros status (pending, rejected, in_process, etc.): apenas registra o status
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[MP Webhook] Payment ${paymentId} status=${status}, comanda=${comandaId}`);
    }

    return NextResponse.json({
      ok: true,
      processed: status,
      comandaId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Internal error',
      },
      { status: 500 }
    );
  }
}

// GET pra teste rápido (verificar se endpoint está vivo)
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'mp/webhook',
    method: 'POST expected with type=payment',
  });
}
