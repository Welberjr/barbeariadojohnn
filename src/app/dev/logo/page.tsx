import { Logo } from '@/components/brand/logo';

/**
 * PÃ¡gina de preview/teste das variantes da logo.
 * Rota: /dev/logo
 *
 * Usada apenas em desenvolvimento para validar a logo SVG.
 */
export default function LogoPreviewPage() {
  return (
    <div className="min-h-screen p-12 space-y-12">
      <h1 className="text-4xl font-serif text-fg">Logo Preview</h1>
      
      <section className="space-y-4">
        <h2 className="text-2xl font-serif text-gold">Variant: full</h2>
        <div className="flex items-end gap-8 p-8 bg-bg-surface rounded-lg border border-border">
          <div className="text-center">
            <Logo variant="full" size="sm" />
            <p className="text-xs text-fg-muted mt-2">sm (h-10)</p>
          </div>
          <div className="text-center">
            <Logo variant="full" size="md" />
            <p className="text-xs text-fg-muted mt-2">md (h-14)</p>
          </div>
          <div className="text-center">
            <Logo variant="full" size="lg" />
            <p className="text-xs text-fg-muted mt-2">lg (h-20)</p>
          </div>
          <div className="text-center">
            <Logo variant="full" size="xl" />
            <p className="text-xs text-fg-muted mt-2">xl (h-32)</p>
          </div>
          <div className="text-center">
            <Logo variant="full" size="2xl" />
            <p className="text-xs text-fg-muted mt-2">2xl (h-48)</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif text-gold">Variant: compact</h2>
        <div className="flex items-center gap-8 p-8 bg-bg-surface rounded-lg border border-border">
          <Logo variant="compact" size="sm" />
          <Logo variant="compact" size="md" />
          <Logo variant="compact" size="lg" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif text-gold">Variant: icon</h2>
        <div className="flex items-center gap-8 p-8 bg-bg-surface rounded-lg border border-border">
          <Logo variant="icon" size="sm" />
          <Logo variant="icon" size="md" />
          <Logo variant="icon" size="lg" />
          <Logo variant="icon" size="xl" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif text-gold">Em contexto: card premium</h2>
        <div className="card-premium p-12 max-w-md mx-auto text-center space-y-6">
          <Logo variant="full" size="xl" className="mx-auto" />
          <p className="text-fg-muted">Sistema de gestÃ£o profissional</p>
        </div>
      </section>
    </div>
  );
}
