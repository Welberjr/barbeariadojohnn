import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fuso horário usado por toda a operação da barbearia. */
export const SHOP_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Combina classes Tailwind sem conflitos.
 * Usado em todos os componentes Shadcn.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata valor monetário em BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data brasileira
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'datetime' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'long') {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: SHOP_TIME_ZONE,
    }).format(d);
  }
  
  if (format === 'datetime') {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: SHOP_TIME_ZONE,
    }).format(d);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SHOP_TIME_ZONE,
  }).format(d);
}

/**
 * Formata telefone brasileiro
 */
export function formatPhone(phone: string): string {
  // Os telefones que vieram do sistema antigo tem o 55 do Brasil na frente.
  // Sem tirar, o numero caia no fim da funcao e aparecia cru na tela, colado,
  // do jeito que ninguem le telefone.
  const cleaned = phone
    .replace(/\D/g, '')
    .replace(/^55(?=\d{10,11}$)/, '');

  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}
