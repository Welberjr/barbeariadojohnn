'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { awardBonusPoints } from '@/app/cliente/actions';

const PRIZES = [5, 10, 15, 20, 30, 50];

function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `raspadinha-${now.getFullYear()}-${week}`;
}

export function Raspadinha({ customerId }: { customerId: string }) {
  const [state, setState] = useState<'idle' | 'scratching' | 'revealed' | 'used'>('idle');
  const [prize, setPrize] = useState<number>(0);
  const [scratched, setScratched] = useState(0); // % raspado
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const totalPixels = useRef(0);
  const weekKey = getWeekKey();

  useEffect(() => {
    const used = localStorage.getItem(weekKey);
    if (used) setState('used');
  }, [weekKey]);

  function startScratching() {
    if (state !== 'idle') return;
    const p = PRIZES[Math.floor(Math.random() * PRIZES.length)];
    setPrize(p);
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
    // Textura
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
    }
    const pct = Math.round((transparent / totalPixels.current) * 100);
    setScratched(pct);
    if (pct >= 55 && state === 'scratching') {
      reveal();
    }
  }

  async function reveal() {
    setState('revealed');
    localStorage.setItem(weekKey, prize.toString());
    await awardBonusPoints(customerId, prize, 'raspadinha_semanal');
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
          <button
            type="button"
            onClick={startScratching}
            className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-3"
          >
            <Sparkles className="w-4 h-4" />
            Revelar meu prêmio
          </button>
        </div>
      )}

      {state === 'scratching' && (
        <div className="px-5 pb-5 space-y-2">
          <div className="relative rounded-xl overflow-hidden" style={{ height: 96 }}>
            {/* Prize (revealed underneath) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-elevated">
              <p className="text-3xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                +{prize}
              </p>
              <p className="text-[11px] text-fg-muted">pontos bônus</p>
            </div>
            {/* Scratch overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              onPointerDown={(e) => { isDrawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }}
              onPointerMove={scratch}
              onPointerUp={() => { isDrawing.current = false; }}
            />
          </div>
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gold/60 rounded-full transition-all"
              style={{ width: `${scratched}%` }}
            />
          </div>
          <p className="text-[10px] text-fg-subtle text-center">
            {scratched < 55 ? 'Continue raspando...' : 'Quase lá!'}
          </p>
        </div>
      )}

      {state === 'revealed' && (
        <div className="px-5 pb-5 space-y-3">
          <div className="rounded-xl bg-gold/10 border border-gold/30 p-5 text-center animate-fade-in">
            <Sparkles className="w-6 h-6 text-gold mx-auto mb-2" />
            <p className="text-3xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              +{prize} pts
            </p>
            <p className="text-sm text-fg-muted mt-1">creditados na sua conta!</p>
          </div>
          <p className="text-[10px] text-fg-subtle text-center">
            Próxima raspadinha disponível na semana que vem.
          </p>
        </div>
      )}
    </div>
  );
}