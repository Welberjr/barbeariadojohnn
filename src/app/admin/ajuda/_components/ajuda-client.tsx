'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  icon: string;
  content: React.ReactNode;
}

export function AjudaClient({ articles }: { articles: HelpArticle[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(articles[0]?.id ?? null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        a.category.toLowerCase().includes(term) ||
        String(a.content).toLowerCase().includes(term)
    );
  }, [articles, query]);

  const categories = useMemo(() => {
    const map = new Map<string, HelpArticle[]>();
    for (const a of filtered) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function toggleCat(cat: string) {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function isCatOpen(cat: string) {
    return openCategories[cat] !== false;
  }

  const currentArticle = articles.find((a) => a.id === selected) ?? null;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-160px)]">
      {/* SIDEBAR */}
      <aside className="w-64 flex-shrink-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            type="text"
            placeholder="Buscar na central..."
            className="input pl-10 py-2 text-sm w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {categories.length === 0 && (
          <p className="text-sm text-fg-subtle text-center py-6">
            Nenhum artigo encontrado.
          </p>
        )}

        <div className="space-y-1">
          {categories.map(([cat, arts]) => (
            <div key={cat}>
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider text-fg-dim hover:text-gold hover:bg-bg-elevated transition-colors"
              >
                {cat}
                {isCatOpen(cat) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              {isCatOpen(cat) && (
                <div className="ml-2 space-y-0.5">
                  {arts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelected(a.id)}
                      className={cn(
                        'w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                        selected === a.id
                          ? 'bg-gold/10 text-gold border-l-2 border-gold font-medium'
                          : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
                      )}
                    >
                      <span>{a.icon}</span>
                      <span className="truncate">{a.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* CONTEUDO */}
      <main className="flex-1 min-w-0">
        {currentArticle ? (
          <article className="card p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-border/60">
              <span className="text-2xl">{currentArticle.icon}</span>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-fg-dim">{currentArticle.category}</p>
                <h2
                  className="text-xl font-bold text-fg"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {currentArticle.title}
                </h2>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-fg-muted space-y-4 leading-relaxed">
              {currentArticle.content}
            </div>
          </article>
        ) : (
          <div className="card p-12 text-center">
            <BookOpen className="w-10 h-10 text-gold mx-auto mb-3" />
            <p className="text-lg font-semibold text-fg">Selecione um artigo</p>
            <p className="text-sm text-fg-subtle mt-1">Escolha um item no menu lateral para ler.</p>
          </div>
        )}
      </main>
    </div>
  );
}