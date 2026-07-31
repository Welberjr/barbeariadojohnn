/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig = {
  poweredByHeader: false,
  experimental: {
    /**
     * Tela ja visitada volta na hora.
     *
     * Por padrao o Next joga fora a tela dinamica assim que ela sai do ar, e
     * toda volta refaz o caminho inteiro ate o banco. Medido em producao, isso
     * dava de 160 a 290 milissegundos parado a cada troca de aba. Guardando por
     * vinte segundos, ir e voltar entre agenda, comandas e financeiro acontece
     * no mesmo quadro do clique.
     *
     * O dado nao envelhece escondido: toda acao do sistema chama refresh, que
     * derruba esta guarda na hora. Vinte segundos e menos que o intervalo entre
     * dois clientes na cadeira.
     */
    staleTimes: {
      dynamic: 20,
    },
  },
  eslint: {
    // ESLint warnings won't fail the production build.
    // `npm run lint` still works manually pra catch issues durante dev.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
