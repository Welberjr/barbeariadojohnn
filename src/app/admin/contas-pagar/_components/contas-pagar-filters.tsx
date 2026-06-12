'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Search } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface ContasPagarFiltersProps {
  currentStatus: string;
  currentCategory: string;
  currentQuery: string;
  categories: Category[];
}

export function ContasPagarFilters({
  currentStatus,
  currentCategory,
  currentQuery,
  categories,
}: ContasPagarFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(currentQuery);

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === 'all' || value === '') {
      sp.delete(key);
    } else {
      sp.set(key, value);
    }
    sp.delete('pagina'); // qualquer filtro novo volta pra página 1
    router.push(`/admin/contas-pagar?${sp.toString()}`);
  }

  // Busca ao vivo com debounce de 400ms
  useEffect(() => {
    const term = query.trim();
    if (term === currentQuery.trim()) return;
    const handle = setTimeout(() => updateParam('q', term), 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    setQuery(currentQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuery]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter className="w-4 h-4 text-fg-subtle" />

      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
        <input
          type="text"
          placeholder="Buscar por descrição ou fornecedor..."
          className="input pl-10 py-1.5 text-sm w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateParam('q', query.trim());
          }}
        />
      </div>

      <select
        value={currentStatus}
        onChange={(e) => updateParam('status', e.target.value)}
        className="input py-1.5 text-sm w-auto"
      >
        <option value="all">Todos os status</option>
        <option value="pending">Pendentes</option>
        <option value="paid">Pagas</option>
        <option value="cancelled">Canceladas</option>
      </select>

      <select
        value={currentCategory}
        onChange={(e) => updateParam('category', e.target.value)}
        className="input py-1.5 text-sm w-auto"
      >
        <option value="all">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}