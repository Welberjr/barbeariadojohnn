/** @type {import('next').NextConfig} */

// Os cabecalhos de seguranca sairam daqui em 31/07/2026 e agora nascem no
// middleware, em src/lib/seguranca-headers.ts. Aqui eles valiam para o build
// inteiro e, sem nonce, barravam o pedaco de script que revela a segunda parte
// da pagina: quem abria o painel pela URL ficava com a tela presa no carregando.

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
};

export default nextConfig;
