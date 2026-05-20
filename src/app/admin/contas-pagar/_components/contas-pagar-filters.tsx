'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface ContasPagarFiltersProps {
  currentStatus: string;
  currentCategory: string;
  categories: Category[];
}

export function ContasPagarFilters({
  currentStatus,
  currentCategory,
  categories,
}: ContasPagarFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === 'all') {
      sp.delete(key);
    } else {
      sp.set(key, value);
    }
    router.push(`/admin/contas-pagar?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter className="w-4 h-4 text-fg-subtle" />

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
