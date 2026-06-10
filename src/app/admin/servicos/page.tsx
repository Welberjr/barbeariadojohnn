import { createAdminClient } from '@/lib/supabase/admin';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ServicesAccordion } from './_components/services-accordion';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = { title: 'Serviços' };

export default async function ServicosPage() {
  const admin = createAdminClient();

  const [{ data: servicesRaw }, { data: staffRaw }, { data: staffServicesRaw }, { data: promosRaw }] =
    await Promise.all([
      admin
        .from('services')
        .select('id, name, category, base_price, base_duration_minutes, base_commission_percent, active, display_order, show_on_public_menu')
        .eq('barbershop_id', BARBERSHOP_ID)
        .order('category', { ascending: true })
        .order('display_order', { ascending: true }),
      admin
        .from('staff')
        .select('id, display_name')
        .eq('barbershop_id', BARBERSHOP_ID)
        .eq('active', true)
        .order('display_name'),
      admin
        .from('staff_services')
        .select('staff_id, service_id, custom_price, custom_duration_minutes, custom_commission_percent, active')
        .eq('barbershop_id', BARBERSHOP_ID),
      admin
        .from('service_promotions')
        .select('service_id, day_of_week, promotional_price')
        .eq('barbershop_id', BARBERSHOP_ID)
        .eq('active', true),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services = (servicesRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staff = (staffRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffServices = (staffServicesRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promos = (promosRaw ?? []) as any[];

  const staffMap = new Map(staff.map((s) => [s.id as string, s.display_name as string]));

  // Montar por categoria
  const categoryMap = new Map<string, typeof services>();
  for (const svc of services) {
    const cat = svc.category || 'Outros';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(svc);
  }

  const servicesByCategory = Array.from(categoryMap.entries()).map(([category, items]) => ({
    category,
    items: items.map((svc) => {
      const svcStaff = staffServices.filter((ss) => ss.service_id === svc.id);
      const svcPromos = promos.filter((p) => p.service_id === svc.id);

      return {
        id: svc.id,
        name: svc.name,
        active: svc.active,
        base_price: Number(svc.base_price),
        base_duration_minutes: Number(svc.base_duration_minutes),
        base_commission_percent: Number(svc.base_commission_percent ?? 0),
        staffCount: staff.length,
        staff_services: staff.map((s) => {
          const custom = svcStaff.find((ss) => ss.staff_id === s.id);
          return {
            staff_id: s.id,
            staff_name: s.display_name,
            price: custom?.custom_price != null ? Number(custom.custom_price) : null,
            duration: custom?.custom_duration_minutes != null ? Number(custom.custom_duration_minutes) : null,
            commission: custom?.custom_commission_percent != null ? Number(custom.custom_commission_percent) : null,
          };
        }),
        promos: svcPromos.map((p) => ({
          dow: Number(p.day_of_week),
          price: p.promotional_price != null ? Number(p.promotional_price) : null,
        })),
      };
    }),
  }));

  const totalAtivos = services.filter((s) => s.active).length;
  // Servicos unicos = nomes sem duplicata
  const uniqueNames = new Set(services.map((s) => s.name as string));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Operação
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Serviços
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Gerencie os serviços de todos os profissionais
          </p>
        </div>
        <Link href="/admin/servicos/novo" className="btn-gold-shimmer flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Novo Serviço</span>
        </Link>
      </div>

      <div className="divider-gold" />

      <ServicesAccordion
        servicesByCategory={servicesByCategory}
        totalServices={services.length}
        totalAtivos={totalAtivos}
        totalCategorias={categoryMap.size}
        totalUnicos={uniqueNames.size}
      />
    </div>
  );
}
