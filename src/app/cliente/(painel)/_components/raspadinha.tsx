'use client';

import { useRef, useState } from 'react';
import { Sparkles, Gift } from 'lucide-react';

export function Raspadinha({
  initialBonus,
}: {
  initialBonus: { used: boolean; points: number | null };
}) {
  const [state, setState] = useState<'idle' | 'scratching' | 'revealed' | 'used'>(
    initialBonus.used ? 'used' : 'idle'
  );
  const [prize, setPrize] = useState<number>(initialBonus.points ?? 0);
  const [scratched, setScratched] = useState(0);
  const [creditError, setCreditError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const totalPixels = useRef(0);

  function startScratching() {
    if (state !== 'idle') return;
    // O servidor define o valor ao revelar. Isso impede que alguém altere a
    // requisição no celular para escolher quantos pontos recebe.
    setPrize(0);
    setState('scratching');
    setTimeout(() => initCanvas(), 50);
  }

  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    totalPixels.current = canvas.width * canvas.height;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(212,160,79,0.15)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 8 + 2,
        Math.random() * 3 + 1
      );
    }
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#B8862A';
    ctx.textAlign = 'center';
    ctx.fillText('✦ RASPE AQUI ✦', canvas.width / 2, canvas.height / 2 - 6);
    ctx.fillText('para revelar seu prêmio', canvas.width / 2, canvas.height / 2 + 14);
  }

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || state !== 'scratching' || !isDrawing.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 22, 0, Math.PI * 2);
    ctx.fill();

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
    const pct = Math.round((transparent / totalPixels.current) * 100);
    setScratched(pct);
    if (pct >= 55 && state === 'scratching') void reveal();
  }

  async function reveal() {
    setState('revealed');
    setCreditError(false);
    try {
      const response = await fetch('/api/bonus-points', { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as
        | { points?: number }
        | null;
      if (typeof payload?.points === 'number') {
        setPrize(payload.points);
      } else {
        setCreditError(true);
      }
    } catch {
      setCreditError(true);
    }
  }

  if (state === 'used') {
    return (
      <div className="card p-5 text-center space-y-2 border-border/40">
        <Gift className="w-7 h-7 text-fg-dim mx-auto" />
        <p className="text-sm text-fg-muted font-medium">Raspadinha da semana usada</p>
        <p className="text-[11px] text-fg-subtle">Volta disponível na semana que vem!</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-gold/20">
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-fg">Raspadinha da Semana</p>
          <p className="text-[11px] text-fg-subtle">Raspe e ganhe pontos bônus grátis!</p>
        </div>
      </div>

      {state === 'idle' && (
        <div className="px-5 pb-5">
          <button type="button" onClick={startScratching} className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-3">
            <Sparkles className="w-4 h-4" /> Revelar meu prêmio
          </button>
        </div>
      )}

      {state === 'scratching' && (
        <div className="px-5 pb-5 space-y-2">
          <div className="relative rounded-xl overflow-hidden" style={{ height: 96 }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-elevated">
              <p className="text-3xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>+?</p>
              <p className="text-[11px] text-fg-muted">pontos bônus</p>
            </div>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" onPointerDown={(e) => { isDrawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }} onPointerMove={scratch} onPointerUp={() => { isDrawing.current = false; }} />
          </div>
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden"><div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${scratched}%` }} /></div>
          <p className="text-[10px] text-fg-subtle text-center">{scratched < 55 ? 'Continue raspando...' : 'Quase lá!'}</p>
        </div>
      )}

      {state === 'revealed' && (
        <div className="px-5 pb-5 space-y-3">
          <div className="rounded-xl bg-gold/10 border border-gold/30 p-5 text-center animate-fade-in">
            <Sparkles className="w-6 h-6 text-gold mx-auto mb-2" />
            {creditError ? (
              <p className="text-sm text-fg-muted">Não foi possível confirmar seus pontos. Atualize a página e tente novamente.</p>
            ) : (
              <>
                <p className="text-3xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>+{prize} pts</p>
                <p className="text-sm text-fg-muted mt-1">creditados na sua conta!</p>
              </>
            )}
          </div>
          <p className="text-[10px] text-fg-subtle text-center">Próxima raspadinha disponível na semana que vem.</p>
        </div>
      )}
    </div>
  );
}
