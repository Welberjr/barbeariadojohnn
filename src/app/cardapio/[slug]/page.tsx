import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Logo } from '@/components/brand/logo';
import { MapPin, Phone, Clock, Scissors, Star } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CardapioPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CardapioPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('name, address_city')
    .eq('slug', slug)
    .maybeSingle();

  if (!barbershop) return { title: 'Cardápio' };

  return {
    title: `Cardápio | ${barbershop.name}`,
    description: `Serviços e preços da ${barbershop.name} em ${barbershop.address_city}. Cabelo, barba e visagismo com padrão premium.`,
  };
}

export default async function CardapioPage({ params }: CardapioPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!barbershop) {
    notFound();
  }

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .eq('active', true)
    .eq('show_on_public_menu', true)
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });

  // Agrupar por categoria
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped = (services ?? []).reduce<Record<string, any[]>>((acc, svc) => {
    const cat = svc.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-bg relative overflow-x-hidden">
      {/* ========= BACKGROUND DECORATIVO ========= */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212, 160, 79, 0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212, 160, 79, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212, 160, 79, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* ========= HEADER ========= */}
      <header className="relative z-10 pt-12 pb-8 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <Logo
              variant="full"
              size="2xl"
              className="drop-shadow-[0_0_40px_rgba(212,160,79,0.2)]"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-gold tracking-[0.4em] uppercase font-semibold">
              Cardápio · Preços · Serviços
            </p>
            <h1
              className="text-3xl md:text-4xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {barbershop.name}
            </h1>
            {barbershop.address_city && (
              <p className="text-sm text-fg-muted flex items-center justify-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gold" />
                {barbershop.address_city}
                {barbershop.address_state ? `, ${barbershop.address_state}` : ''}
              </p>
            )}
          </div>

          {/* Linha decorativa */}
          <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <Scissors className="w-4 h-4 text-gold" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          </div>
        </div>
      </header>

      {/* ========= CARDÁPIO ========= */}
      <main className="relative z-10 px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-10">
          {Object.keys(grouped).length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-fg-muted">Nenhum serviço disponível no momento.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <section key={category} className="animate-fade-in">
                {/* Categoria header */}
                <div className="flex items-center gap-3 mb-5">
                  <h2
                    className="text-xl md:text-2xl font-bold text-fg"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {category}
                  </h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-gold/30 to-transparent" />
                  <span className="text-[10px] text-fg-dim uppercase tracking-widest">
                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {items.map((svc) => (
                    <div
                      key={svc.id}
                      className="card-premium p-5 flex items-start justify-between gap-4 hover:border-gold/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                            <Scissors className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3
                              className="text-base md:text-lg font-bold text-fg"
                              style={{ fontFamily: 'var(--font-playfair), serif' }}
                            >
                              {svc.name}
                            </h3>
                            {svc.description && (
                              <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                                {svc.description}
                              </p>
                            )}
                            <p className="text-[11px] text-fg-subtle mt-2 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {svc.base_duration_minutes} min
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                          A partir de
                        </p>
                        <p
                          className="text-xl md:text-2xl font-bold text-gold leading-none"
                          style={{ fontFamily: 'var(--font-playfair), serif' }}
                        >
                          {formatCurrency(Number(svc.base_price))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* ========= CTA AGENDAR ========= */}
      <section className="relative z-10 px-4 pb-12">
        <div className="max-w-3xl mx-auto">
          <div
            className="card-premium p-8 text-center relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(212, 160, 79, 0.1) 0%, rgba(10, 10, 10, 1) 100%)',
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <Star className="w-6 h-6 text-gold mx-auto mb-3 fill-current" />
            <h3
              className="text-2xl font-bold text-fg mb-2"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Pronto para um corte de respeito?
            </h3>
            <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
              Agende seu horário pelo WhatsApp e garanta atendimento premium na{' '}
              {barbershop.name}.
            </p>

            {barbershop.whatsapp_number && (
              <a
                href={`https://wa.me/${barbershop.whatsapp_number}?text=${encodeURIComponent(
                  `Olá! Vim do cardápio e quero agendar um horário.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-shimmer inline-flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Agendar pelo WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ========= FOOTER ========= */}
      <footer className="relative z-10 border-t border-border/40 py-8 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          {(barbershop.address_street || barbershop.phone) && (
            <div className="text-xs text-fg-muted space-y-1 mb-2">
              {barbershop.address_street && (
                <p className="flex items-center justify-center gap-1.5">
                  <MapPin className="w-3 h-3 text-gold" />
                  {[
                    barbershop.address_street,
                    barbershop.address_number,
                    barbershop.address_neighborhood,
                    barbershop.address_city,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {barbershop.phone && (
                <p className="flex items-center justify-center gap-1.5">
                  <Phone className="w-3 h-3 text-gold" />
                  {barbershop.phone}
                </p>
              )}
            </div>
          )}

          <p className="text-[10px] text-fg-dim tracking-[0.3em] uppercase">
            Cabelo · Barba · Visagismo · Padrão Premium
          </p>
          <p className="text-[10px] text-fg-dim">
            © {new Date().getFullYear()} {barbershop.name} ·{' '}
            {barbershop.address_city ?? 'Brasília'}
          </p>
        </div>
      </footer>
    </div>
  );
}
