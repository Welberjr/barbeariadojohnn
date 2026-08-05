import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatarTelefoneExibicao } from '@/lib/telefone';

/** Fuso horário usado por toda a operação da barbearia. */
export const SHOP_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Em português só a primeira letra sobe. "terça-feira, 4 de agosto" vira
 * "Terça-feira, 4 de agosto". A classe capitalize do Tailwind sobe TODA
 * palavra e produz "Terça-Feira, 4 De Agosto", que não existe no idioma.
 */
export function primeiraMaiuscula(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

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
 * Formata telefone brasileiro.
 *
 * Delega para a forma canonica de lib/telefone: celular gravado pelo sistema
 * antigo sem o nono digito ganha o 9 na exibicao, em vez de aparecer com cara
 * de fixo.
 */
export function formatPhone(phone: string): string {
  return formatarTelefoneExibicao(phone);
}
