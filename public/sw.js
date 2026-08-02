/**
 * O programa que fica de plantao no aparelho.
 *
 * Ele continua rodando com o aplicativo fechado: e por isso que o aviso chega
 * mesmo com o celular no bolso. Recebe a mensagem, mostra na tela e, quando a
 * pessoa toca, abre a tela certa em vez de abrir o aplicativo do zero.
 *
 * Este arquivo e servido como esta, sem passar pelo empacotador. Nada de
 * import: o que estiver aqui tem que rodar sozinho.
 */

self.addEventListener('install', (evento) => {
  // Assume o posto na hora, sem esperar a pessoa fechar as abas antigas
  evento.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { title: 'Barbearia do Johnn', body: evento.data ? evento.data.text() : '' };
  }

  const titulo = dados.title || 'Barbearia do Johnn';
  const opcoes = {
    body: dados.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Aviso da mesma etiqueta substitui o anterior, para nao empilhar
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag),
    data: { url: dados.url || '/' },
    vibrate: [80, 40, 80],
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/';

  evento.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => {
        // Se o aplicativo ja estiver aberto, leva a janela existente para a
        // tela certa em vez de abrir uma segunda
        for (const janela of janelas) {
          if ('focus' in janela) {
            janela.navigate(destino);
            return janela.focus();
          }
        }
        return self.clients.openWindow(destino);
      })
  );
});
