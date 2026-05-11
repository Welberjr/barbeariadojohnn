import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'compact' | 'icon' | 'mono';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const sizeMap = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-20',
  xl: 'h-32',
  '2xl': 'h-48',
  '3xl': 'h-64',
};

/**
 * Logo da Barbearia do Johnn — SVG nativo.
 *
 * Elementos da logo original do cliente:
 * - BIGODE em dourado (gold mustache) no topo
 * - "BARBEARIA D[o]" em serifa (Playfair) branca
 * - "JOHNN" em destaque (italic, gigante, branco)
 * - TESOURA dourada decorativa na lateral
 *
 * Variantes:
 * - full: completa (default) — login, hero, autenticação
 * - compact: bigode + texto horizontal — sidebars largas, headers
 * - icon: só o bigode + tesoura, sem texto — favicons, sidebars colapsadas
 * - mono: tudo em uma cor (currentColor) — uso especial em badges/print
 */
export function Logo({ className, variant = 'full', size = 'md' }: LogoProps) {
  const heightClass = sizeMap[size];

  // ============ ICON ONLY (bigode + tesoura) ============
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(heightClass, 'w-auto', className)}
        aria-label="Barbearia do Johnn"
      >
        {/* Bigode dourado estilizado */}
        <g transform="translate(50, 40)">
          {/* Curva principal do bigode (estilo handlebar/curly) */}
          <path
            d="M -30 -2
               C -28 -10, -22 -14, -16 -11
               C -12 -9, -8 -8, -4 -7
               C -2 -7, -1 -6, 0 -5
               C 1 -6, 2 -7, 4 -7
               C 8 -8, 12 -9, 16 -11
               C 22 -14, 28 -10, 30 -2
               C 28 -4, 24 -5, 20 -3
               C 16 -1, 12 1, 8 2
               C 4 3, 2 3, 0 2
               C -2 3, -4 3, -8 2
               C -12 1, -16 -1, -20 -3
               C -24 -5, -28 -4, -30 -2 Z"
            fill="#D4A04F"
          />
          {/* Pontas estilizadas (handlebar curls) */}
          <path
            d="M -30 -2 C -32 0, -33 3, -32 5 C -30 4, -29 1, -28 -1 Z"
            fill="#D4A04F"
          />
          <path
            d="M 30 -2 C 32 0, 33 3, 32 5 C 30 4, 29 1, 28 -1 Z"
            fill="#D4A04F"
          />
        </g>
        {/* Tesoura abaixo */}
        <g transform="translate(50, 75)">
          <circle cx="-9" cy="0" r="6" fill="none" stroke="#D4A04F" strokeWidth="2" />
          <circle cx="9" cy="0" r="6" fill="none" stroke="#D4A04F" strokeWidth="2" />
          <line x1="-4" y1="-3" x2="14" y2="-15" stroke="#D4A04F" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="-3" x2="-14" y2="-15" stroke="#D4A04F" strokeWidth="2" strokeLinecap="round" />
          <circle cx="0" cy="-1" r="1.2" fill="#D4A04F" />
        </g>
      </svg>
    );
  }

  // ============ COMPACT (sidebar com largura razoável) ============
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <svg
          viewBox="0 0 60 60"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(heightClass, 'w-auto shrink-0')}
        >
          {/* Bigode compacto */}
          <g transform="translate(30, 22)">
            <path
              d="M -22 -1
                 C -20 -8, -16 -11, -12 -9
                 C -8 -7, -4 -6, -2 -5
                 C -1 -5, 0 -4, 0 -4
                 C 0 -4, 1 -5, 2 -5
                 C 4 -6, 8 -7, 12 -9
                 C 16 -11, 20 -8, 22 -1
                 C 18 -3, 14 -3, 10 -2
                 C 6 -1, 3 0, 0 0
                 C -3 0, -6 -1, -10 -2
                 C -14 -3, -18 -3, -22 -1 Z"
              fill="#D4A04F"
            />
            <path d="M -22 -1 C -24 1, -25 3, -24 5 C -22 4, -21 2, -20 0 Z" fill="#D4A04F" />
            <path d="M 22 -1 C 24 1, 25 3, 24 5 C 22 4, 21 2, 20 0 Z" fill="#D4A04F" />
          </g>
          {/* Tesoura mini */}
          <g transform="translate(30, 47)">
            <circle cx="-7" cy="0" r="4.5" fill="none" stroke="#D4A04F" strokeWidth="1.6" />
            <circle cx="7" cy="0" r="4.5" fill="none" stroke="#D4A04F" strokeWidth="1.6" />
            <line x1="-3" y1="-2" x2="11" y2="-12" stroke="#D4A04F" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="3" y1="-2" x2="-11" y2="-12" stroke="#D4A04F" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </svg>
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'text-fg-muted font-medium tracking-widest uppercase',
              size === 'sm' && 'text-[8px]',
              size === 'md' && 'text-[10px]',
              size === 'lg' && 'text-xs'
            )}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Barbearia do
          </span>
          <span
            className={cn(
              'text-fg font-extrabold italic tracking-tight',
              size === 'sm' && 'text-base',
              size === 'md' && 'text-xl',
              size === 'lg' && 'text-2xl'
            )}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            JOHNN
          </span>
        </div>
      </div>
    );
  }

  // ============ MONO (uma cor só) ============
  if (variant === 'mono') {
    return (
      <svg
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(heightClass, 'w-auto', className)}
        aria-label="Barbearia do Johnn"
        fill="currentColor"
      >
        <g transform="translate(200, 90)">
          <path
            d="M -90 -5
               C -84 -25, -68 -32, -50 -25
               C -36 -19, -22 -16, -10 -14
               C -5 -13, -2 -12, 0 -12
               C 2 -12, 5 -13, 10 -14
               C 22 -16, 36 -19, 50 -25
               C 68 -32, 84 -25, 90 -5
               C 80 -10, 68 -10, 56 -7
               C 42 -3, 26 3, 12 5
               C 6 6, 2 6, 0 6
               C -2 6, -6 6, -12 5
               C -26 3, -42 -3, -56 -7
               C -68 -10, -80 -10, -90 -5 Z"
          />
        </g>
        <g transform="translate(200, 160)">
          <text
            textAnchor="middle"
            fontFamily="Playfair Display, Georgia, serif"
            fontSize="34"
            fontWeight="500"
            letterSpacing="3"
          >
            BARBEARIA DO
          </text>
        </g>
        <g transform="translate(200, 270)">
          <text
            textAnchor="middle"
            fontFamily="Playfair Display, Georgia, serif"
            fontSize="115"
            fontWeight="800"
            fontStyle="italic"
          >
            JOHNN
          </text>
        </g>
      </svg>
    );
  }

  // ============ FULL (versão completa) ============
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(heightClass, 'w-auto', className)}
      aria-label="Barbearia do Johnn"
    >
      <defs>
        {/* Gradiente dourado pro bigode */}
        <linearGradient id="goldMustache" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4A04F" />
          <stop offset="50%" stopColor="#F5C518" />
          <stop offset="100%" stopColor="#D4A04F" />
        </linearGradient>
        {/* Gradiente dourado pra tesoura */}
        <linearGradient id="goldScissors" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D4A04F" />
          <stop offset="100%" stopColor="#F5C518" />
        </linearGradient>
      </defs>

      {/* ========== BIGODE (handlebar mustache style) ========== */}
      <g transform="translate(200, 90)">
        {/* Corpo principal do bigode */}
        <path
          d="M -88 -5
             C -82 -28, -65 -34, -48 -27
             C -34 -21, -22 -17, -12 -15
             C -6 -14, -2 -13, 0 -13
             C 2 -13, 6 -14, 12 -15
             C 22 -17, 34 -21, 48 -27
             C 65 -34, 82 -28, 88 -5
             C 78 -12, 66 -12, 54 -8
             C 40 -3, 24 4, 10 6
             C 5 7, 2 7, 0 6
             C -2 7, -5 7, -10 6
             C -24 4, -40 -3, -54 -8
             C -66 -12, -78 -12, -88 -5 Z"
          fill="url(#goldMustache)"
        />
        {/* Pontas curvadas (handlebar curls) */}
        <path
          d="M -88 -5
             C -94 -2, -97 3, -96 8
             C -93 9, -90 6, -87 2
             C -85 -1, -86 -3, -88 -5 Z"
          fill="url(#goldMustache)"
        />
        <path
          d="M 88 -5
             C 94 -2, 97 3, 96 8
             C 93 9, 90 6, 87 2
             C 85 -1, 86 -3, 88 -5 Z"
          fill="url(#goldMustache)"
        />
        {/* Brilhos / highlights pra dar profundidade */}
        <path
          d="M -60 -18 C -45 -22, -30 -22, -15 -18"
          stroke="#F5C518"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
          strokeLinecap="round"
        />
        <path
          d="M 60 -18 C 45 -22, 30 -22, 15 -18"
          stroke="#F5C518"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
          strokeLinecap="round"
        />
      </g>

      {/* ========== BARBEARIA DO ========== */}
      <g transform="translate(200, 165)">
        <text
          textAnchor="middle"
          fontFamily="Playfair Display, Georgia, serif"
          fontSize="32"
          fontWeight="500"
          fill="#FAFAFA"
          letterSpacing="4"
        >
          BARBEARIA DO
        </text>
      </g>

      {/* ========== JOHNN (DESTAQUE) ========== */}
      <g transform="translate(200, 275)">
        <text
          textAnchor="middle"
          fontFamily="Playfair Display, Georgia, serif"
          fontSize="118"
          fontWeight="800"
          fontStyle="italic"
          fill="#FAFAFA"
          letterSpacing="-1"
        >
          JOHNN
        </text>
      </g>

      {/* ========== TESOURA DECORATIVA (lateral inferior) ========== */}
      <g transform="translate(60, 320) rotate(-25) scale(0.9)">
        {/* Lâminas */}
        <path d="M 0 0 L 42 -16 L 46 -8 L 6 8 Z" fill="url(#goldScissors)" />
        <path d="M 0 0 L 42 16 L 46 8 L 6 -8 Z" fill="url(#goldScissors)" />
        {/* Cabos */}
        <circle cx="-10" cy="-12" r="10" fill="none" stroke="#D4A04F" strokeWidth="2.5" />
        <circle cx="-10" cy="12" r="10" fill="none" stroke="#D4A04F" strokeWidth="2.5" />
        {/* Parafuso central */}
        <circle cx="3" cy="0" r="2.5" fill="#F5C518" />
      </g>

      {/* ========== ORNAMENTO DECORATIVO INFERIOR ========== */}
      <g transform="translate(200, 350)">
        <line x1="-40" y1="0" x2="-8" y2="0" stroke="#D4A04F" strokeWidth="1" opacity="0.6" />
        <circle cx="0" cy="0" r="2" fill="#D4A04F" />
        <line x1="8" y1="0" x2="40" y2="0" stroke="#D4A04F" strokeWidth="1" opacity="0.6" />
      </g>
    </svg>
  );
}
