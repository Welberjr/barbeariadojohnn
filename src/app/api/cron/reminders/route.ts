/**
 * Cron de lembretes de agendamento.
 *
 * Vercel Cron Jobs chamará este endpoint periodicamente (configurado em vercel.json).
 * Busca appointments que ocorrerão em ~24h e dispara lembretes via WhatsApp.
 *
 * Se WhatsApp ainda não estiver verificado, sendWhatsAppMessage retorna mocked=true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sendWhatsAppMessage,
  reminderTemplate24h,
} from '@/lib/whatsapp';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export async function GET(req: NextRequest) {
  // Vercel Cron envia um Authorization header com CRON_SECRET (se configurado)
  // Em prod, configurar CRON_SECRET no Vercel Env Vars protege esse endpoint
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    // Janela: appointments começando entre 23h e 25h a partir de agora
    // Cron rodará a cada hora — pegamos uma janela de 2h pra garantir cobertura mesmo com pequenos atrasos
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Busca appointments na janela
    const { data: appointments, error: errApp } = await admin
      .from('appointments')
      .select(
        'id, customer_id, staff_id, start_at, status'
      )
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'scheduled')
      .gte('start_at', windowStart.toISOString())
      .lte('start_at', windowEnd.toISOString())
      .limit(100);

    if (errApp) {
      return NextResponse.json(
        { error: errApp.message },
        { status: 500 }
      );
    }

    const apps = appointments ?? [];

    if (apps.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        message: 'Nenhum agendamento dentro da janela 23-25h',
      });
    }

    // Buscar dados auxiliares em batch
    const customerIds = Array.from(
      new Set(apps.map((a) => a.customer_id).filter(Boolean))
    ) as string[];
    const staffIds = Array.from(
      new Set(apps.map((a) => a.staff_id).filter(Boolean))
    ) as string[];
    const appointmentIds = apps.map((a) => a.id);

    const [
      { data: customers },
      { data: staff },
      { data: appServices },
      { data: bs },
    ] = await Promise.all([
      customerIds.length > 0
        ? admin
            .from('customers')
            .select('id, full_name, phone')
            .in('id', customerIds)
        : Promise.resolve({ data: [] }),
      staffIds.length > 0
        ? admin.from('staff').select('id, display_name').in('id', staffIds)
        : Promise.resolve({ data: [] }),
      admin
        .from('appointment_services')
        .select('appointment_id, service_id')
        .in('appointment_id', appointmentIds),
      admin
        .from('barbershops')
        .select('name')
        .eq('id', BARBERSHOP_ID)
        .maybeSingle(),
    ]);

    // Buscar nomes dos serviços
    const serviceIds = Array.from(
      new Set((appServices ?? []).map((s) => s.service_id).filter(Boolean))
    ) as string[];
    const { data: services } =
      serviceIds.length > 0
        ? await admin
            .from('services')
            .select('id, name')
            .in('id', serviceIds)
        : { data: [] };

    const customerMap = new Map(
      (customers ?? []).map((c) => [
        c.id as string,
        {
          name: c.full_name as string,
          phone: (c.phone as string) ?? null,
        },
      ])
    );
    const staffMap = new Map(
      (staff ?? []).map((s) => [s.id as string, s.display_name as string])
    );
    const serviceMap = new Map(
      (services ?? []).map((s) => [s.id as string, s.name as string])
    );

    // Mapa: appointment_id -> [service_names]
    const appServiceMap = new Map<string, string[]>();
    for (const as of appServices ?? []) {
      const list = appServiceMap.get(as.appointment_id as string) ?? [];
      const name = serviceMap.get(as.service_id as string);
      if (name) list.push(name);
      appServiceMap.set(as.appointment_id as string, list);
    }

    const barbershopName = (bs?.name as string) ?? 'Barbearia';

    // Disparar lembretes
    let sent = 0;
    let mocked = 0;
    let failed = 0;
    const results: Array<{
      appointmentId: string;
      ok: boolean;
      mocked: boolean;
      error?: string;
    }> = [];

    for (const app of apps) {
      const customer = app.customer_id
        ? customerMap.get(app.customer_id as string)
        : null;

      if (!customer || !customer.phone) {
        failed++;
        results.push({
          appointmentId: app.id as string,
          ok: false,
          mocked: false,
          error: 'Cliente sem telefone',
        });
        continue;
      }

      const staffName = app.staff_id
        ? staffMap.get(app.staff_id as string)
        : undefined;
      const serviceNames = appServiceMap.get(app.id as string) ?? [];
      const serviceName =
        serviceNames.length > 0
          ? serviceNames.join(' + ')
          : 'seu atendimento';

      const message = reminderTemplate24h({
        customerName: customer.name.split(' ')[0],
        serviceName,
        dateTime: new Date(app.start_at as string),
        barbershopName,
      });
      // staffName usado em outros templates; aqui no 24h não precisa
      void staffName;

      const result = await sendWhatsAppMessage(customer.phone, message);

      if (result.ok) {
        if (result.mocked) mocked++;
        else sent++;
      } else {
        failed++;
      }

      results.push({
        appointmentId: app.id as string,
        ok: result.ok,
        mocked: result.mocked,
        error: result.error,
      });
    }

    return NextResponse.json({
      ok: true,
      processed: apps.length,
      sent,
      mocked,
      failed,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      results,
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
