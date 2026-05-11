import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background base (preto profundo)
        bg: {
          DEFAULT: '#0A0A0A',
          surface: '#121212',
          elevated: '#1A1A1A',
          overlay: '#000000',
        },
        // Borda
        border: {
          DEFAULT: '#1F1F1F',
          subtle: '#161616',
          strong: '#2A2A2A',
        },
        // Dourado premium (cor da logo)
        gold: {
          DEFAULT: '#D4A04F',
          50: '#FCF8F0',
          100: '#F8EFD9',
          200: '#F0DDA8',
          300: '#E5C677',
          400: '#DBB256',
          500: '#D4A04F',
          600: '#B8862A',
          700: '#8F6720',
          800: '#5C4214',
          900: '#3D2C0E',
          shimmer: '#F5C518',
        },
        // Primary alias = gold
        primary: {
          DEFAULT: '#D4A04F',
          50: '#FCF8F0',
          100: '#F8EFD9',
          200: '#F0DDA8',
          300: '#E5C677',
          400: '#DBB256',
          500: '#D4A04F',
          600: '#B8862A',
          700: '#8F6720',
          800: '#5C4214',
          900: '#3D2C0E',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        fg: {
          DEFAULT: '#FAFAFA',
          muted: '#A1A1A1',
          subtle: '#6B6B6B',
          dim: '#404040',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #D4A04F 0%, #F5C518 50%, #D4A04F 100%)',
        'gradient-gold-subtle': 'linear-gradient(135deg, rgba(212, 160, 79, 0.1) 0%, rgba(245, 197, 24, 0.05) 100%)',
        'gradient-radial-gold': 'radial-gradient(ellipse at center, rgba(212, 160, 79, 0.15) 0%, transparent 70%)',
        'gradient-bg-elegant': 'radial-gradient(ellipse at top, #1A1A1A 0%, #0A0A0A 70%)',
      },
      boxShadow: {
        gold: '0 0 30px rgba(212, 160, 79, 0.15)',
        'gold-lg': '0 0 60px rgba(212, 160, 79, 0.25)',
        'gold-glow': '0 0 20px rgba(212, 160, 79, 0.4), 0 0 40px rgba(212, 160, 79, 0.2)',
        premium: '0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 160, 79, 0.1)',
        'premium-lg': '0 8px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(212, 160, 79, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        shimmer: 'shimmer 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 160, 79, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(212, 160, 79, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
