/**
 * Foto de uma tela do sistema no tamanho que o cliente usa.
 *
 * O `--window-size` do Chrome sem cabeca nao muda a largura de layout, entao a
 * foto saia com a tela montada para computador e cortada na largura do celular,
 * o que engana quem esta conferindo. Aqui a largura e imposta pelo proprio
 * protocolo do navegador, do mesmo jeito que o modo celular das ferramentas de
 * desenvolvedor faz, e a foto sai igual ao que a pessoa ve na mao.
 *
 * Uso: node scripts/foto-tela.mjs <url> <arquivo.png> [largura] [altura]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

const [, , url, saida, larguraArg, alturaArg] = process.argv;

if (!url || !saida) {
  console.error('uso: node scripts/foto-tela.mjs <url> <arquivo.png> [largura] [altura]');
  process.exit(1);
}

const largura = Number(larguraArg ?? 390);
const altura = Number(alturaArg ?? 900);
const PORTA = 9333;

const CAMINHOS_CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
];

const caminhoChrome = CAMINHOS_CHROME.find((c) => c && existsSync(c));
if (!caminhoChrome) {
  console.error('não achei o Chrome instalado nos caminhos conhecidos');
  process.exit(1);
}

const chrome = spawn(
  caminhoChrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORTA}`,
    '--user-data-dir=' + (process.env.TEMP ?? '.') + '\\chrome-foto-tela',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false }
);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectar() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/json/list`);
      const abas = await r.json();
      const alvo = abas.find((a) => a.type === 'page');
      if (alvo?.webSocketDebuggerUrl) return alvo.webSocketDebuggerUrl;
    } catch {
      // navegador ainda subindo
    }
    await esperar(250);
  }
  throw new Error('o navegador não respondeu');
}

const ws = new WebSocket(await conectar());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pendentes = new Map();

ws.onmessage = (evento) => {
  const msg = JSON.parse(evento.data);
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg.result);
    pendentes.delete(msg.id);
  }
};

function comando(method, params = {}) {
  const meuId = ++id;
  ws.send(JSON.stringify({ id: meuId, method, params }));
  return new Promise((r) => pendentes.set(meuId, r));
}

await comando('Page.enable');
await comando('Emulation.setDeviceMetricsOverride', {
  width: largura,
  height: altura,
  deviceScaleFactor: 2,
  mobile: true,
});

await comando('Page.navigate', { url });
await esperar(4000);

const { data } = await comando('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
});

writeFileSync(saida, Buffer.from(data, 'base64'));
console.log(`foto salva: ${saida} (${largura} de largura)`);

ws.close();
chrome.kill();
process.exit(0);
