'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  Image as ImageIcon,
  Type,
  Hash,
  Plus,
  X,
  AtSign,
  Link2,
  MapPin,
} from 'lucide-react';
import { updateSiteConfig } from '../actions';
import type { SiteConfig } from '../actions';

interface SiteFormProps {
  defaultValues?: Partial<SiteConfig>;
}

export function SiteForm({ defaultValues }: SiteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [heroTitle, setHeroTitle] = useState(defaultValues?.hero_title ?? '');
  const [heroSubtitle, setHeroSubtitle] = useState(defaultValues?.hero_subtitle ?? '');
  const [heroCta, setHeroCta] = useState(defaultValues?.hero_cta ?? '');
  const [aboutTitle, setAboutTitle] = useState(defaultValues?.about_title ?? '');
  const [aboutText, setAboutText] = useState(defaultValues?.about_text ?? '');
  const [showHours, setShowHours] = useState(defaultValues?.show_hours ?? true);
  const [showGallery, setShowGallery] = useState(defaultValues?.show_gallery ?? true);
  const [gallery, setGallery] = useState<string[]>(defaultValues?.gallery_urls ?? []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [instagram, setInstagram] = useState(defaultValues?.instagram_url ?? '');
  const [facebook, setFacebook] = useState(defaultValues?.facebook_url ?? '');
  const [maps, setMaps] = useState(defaultValues?.google_maps_url ?? '');
  const [customMessage, setCustomMessage] = useState(defaultValues?.custom_message ?? '');

  function addGalleryUrl() {
    const trimmed = newGalleryUrl.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//.test(trimmed)) {
      toast.error('URL deve começar com http:// ou https://');
      return;
    }
    setGallery([...gallery, trimmed]);
    setNewGalleryUrl('');
  }

  function removeGalleryUrl(index: number) {
    setGallery(gallery.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setIsLoading(true);
    const result = await updateSiteConfig({
      hero_title: heroTitle,
      hero_subtitle: heroSubtitle,
      hero_cta: heroCta,
      about_title: aboutTitle,
      about_text: aboutText,
      show_hours: showHours,
      show_gallery: showGallery,
      gallery_urls: gallery,
      instagram_url: instagram,
      facebook_url: facebook,
      google_maps_url: maps,
      custom_message: customMessage,
    });
    if (result.ok) {
      toast.success('Site atualizado!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Topo do Site (Hero)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Título principal</label>
            <input
              type="text"
              placeholder="Ex: Tradição em estilo desde 2020"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              className="input"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              Aparece em destaque no topo da página pública.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="label">Subtítulo</label>
            <input
              type="text"
              placeholder="Ex: Corte clássico, atendimento premium."
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">Texto do botão (CTA)</label>
            <input
              type="text"
              placeholder='Ex: "Agendar agora"'
              value={heroCta}
              onChange={(e) => setHeroCta(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Seção &quot;Sobre&quot;
          </h2>
        </div>

        <div>
          <label className="label">Título da seção</label>
          <input
            type="text"
            placeholder='Ex: "Nossa história"'
            value={aboutTitle}
            onChange={(e) => setAboutTitle(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Texto descritivo</label>
          <textarea
            rows={5}
            placeholder="Conte um pouco sobre a barbearia, valores, equipe..."
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            className="input resize-none"
          />
        </div>
      </section>

      {/* GALERIA */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gold" />
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Galeria de Fotos
            </h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showGallery}
              onChange={(e) => setShowGallery(e.target.checked)}
              className="w-3.5 h-3.5 accent-gold"
            />
            Exibir no site
          </label>
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://... (URL da imagem)"
            value={newGalleryUrl}
            onChange={(e) => setNewGalleryUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addGalleryUrl();
              }
            }}
            className="input flex-1"
          />
          <button
            type="button"
            onClick={addGalleryUrl}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </div>

        {gallery.length === 0 ? (
          <p className="text-xs text-fg-subtle italic py-2">
            Nenhuma foto adicionada. Cole URLs de imagens (ex: do Imgur, Unsplash ou seu hospedagem).
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {gallery.map((url, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-md overflow-hidden border border-border bg-bg-elevated group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Galeria ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => removeGalleryUrl(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-bg/80 text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* REDES SOCIAIS */}
      <section className="card p-6 space-y-4">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Redes Sociais e Localização
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <AtSign className="w-3 h-3" />
              Instagram
            </label>
            <input
              type="url"
              placeholder="https://instagram.com/sua-barbearia"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              Facebook
            </label>
            <input
              type="url"
              placeholder="https://facebook.com/sua-barbearia"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              className="input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              Link do Google Maps
            </label>
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/..."
              value={maps}
              onChange={(e) => setMaps(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </section>

      {/* OUTROS */}
      <section className="card p-6 space-y-4">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Outras Opções
        </h2>

        <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
            checked={showHours}
            onChange={(e) => setShowHours(e.target.checked)}
          />
          <div>
            <p className="text-sm text-fg font-medium">
              Mostrar horários de funcionamento
            </p>
            <p className="text-[11px] text-fg-subtle">
              Exibe os horários configurados em <strong>Configurações &gt; Disponibilidade</strong>.
            </p>
          </div>
        </label>

        <div>
          <label className="label">Mensagem personalizada (opcional)</label>
          <textarea
            rows={3}
            placeholder="Aviso, promoção ou mensagem especial..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="input resize-none"
          />
          <p className="text-[10px] text-fg-subtle mt-1">
            Aparece em destaque no site (útil para promoções, avisos de feriado, etc.).
          </p>
        </div>
      </section>

      <div className="flex justify-end gap-3 sticky bottom-4 z-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="btn-gold-shimmer flex items-center gap-2 shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar site</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
