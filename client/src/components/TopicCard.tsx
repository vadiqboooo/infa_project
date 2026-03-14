import { Link } from "react-router";
import { clsx } from "clsx";
import { useEffect, useRef } from "react";

type AnimationType = 'binary' | 'network' | 'code' | 'logic' | 'none';

function detectAnimation(title: string): AnimationType {
  const t = title.toLowerCase();
  if (/счисл|двоич|восьмер|шестнадц|основани|перевод|bit|hex/.test(t)) return 'binary';
  if (/ip|сет|адрес|протокол|маск|коммутац|маршрут|subnet|tcp|udp/.test(t)) return 'network';
  if (/программ|питон|python|алгоритм|цикл|функци|массив|строк|рекурс|сортир|код|файл/.test(t)) return 'code';
  if (/логик|буль|граф|дерево|табл.*истин|предикат|высказ/.test(t)) return 'logic';
  return 'none';
}

// ── Binary/Matrix rain ──────────────────────────────────────────────────────
function createBinaryAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const fontSize = 11;
  const cols = Math.floor(W / fontSize);
  const drops = Array.from({ length: cols }, () => -(Math.random() * H / fontSize));

  return () => {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `${fontSize}px monospace`;
    for (let i = 0; i < drops.length; i++) {
      const char = Math.random() > 0.5 ? '1' : '0';
      const alpha = Math.random() * 0.18 + 0.04;
      ctx.fillStyle = `rgba(63,140,98,${alpha})`;
      ctx.fillText(char, i * fontSize + 2, drops[i] * fontSize);
      if (drops[i] * fontSize > H && Math.random() > 0.97) drops[i] = 0;
      drops[i] += 0.35;
    }
  };
}

// ── Network nodes ────────────────────────────────────────────────────────────
function createNetworkAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const nodes = Array.from({ length: 9 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    label: `${rnd(192)}.${rnd(168)}.${rnd(10)}.${rnd(255)}`,
  }));

  return () => {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          ctx.strokeStyle = `rgba(59,130,246,${0.18 * (1 - dist / 90)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = 'rgba(59,130,246,0.25)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(59,130,246,0.14)';
      ctx.font = '7px monospace';
      ctx.fillText(n.label, n.x + 5, n.y - 2);
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
  };
}

// ── Scrolling code ───────────────────────────────────────────────────────────
function createCodeAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const lines = [
    'def solve(n):', '    if n == 0:', '        return 1',
    'for i in range(n):', '    print(i ** 2)',
    'a = [int(x) for x in input().split()]',
    'while x > 0:', '    x //= 2', 'print(bin(n)[2:])',
    'ans = sum(a)', 'def gcd(a, b):', '    return a if b==0',
    '    else gcd(b, a%b)', 'n = int(input())',
    'result = sorted(a, key=lambda x: -x)',
  ];
  let offset = 0;
  const lineH = 13;

  return () => {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '9px monospace';
    offset = (offset + 0.25) % lineH;
    const total = Math.ceil(H / lineH) + 2;
    for (let i = 0; i < total; i++) {
      const rawIdx = Math.floor((i - offset / lineH));
      const lineIdx = ((rawIdx % lines.length) + lines.length) % lines.length;
      const y = i * lineH - (offset % lineH) + lineH;
      ctx.fillStyle = 'rgba(34,197,94,0.13)';
      ctx.fillText(lines[lineIdx], 8, y);
    }
  };
}

// ── Logic symbols ─────────────────────────────────────────────────────────────
function createLogicAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const syms = ['∧', '∨', '¬', '→', '↔', '⊕', 'T', 'F', '1', '0', '⇒', '∀', '∃', '⊤', '⊥'];
  const particles = Array.from({ length: 14 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.45,
    vy: (Math.random() - 0.5) * 0.45,
    sym: syms[Math.floor(Math.random() * syms.length)],
    alpha: Math.random() * 0.14 + 0.05,
    size: Math.random() * 7 + 10,
  }));

  return () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.font = `bold ${p.size}px serif`;
      ctx.fillStyle = `rgba(124,58,237,${p.alpha})`;
      ctx.fillText(p.sym, p.x, p.y);
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20 || p.x > W + 20) p.vx *= -1;
      if (p.y < -20 || p.y > H + 20) p.vy *= -1;
    }
  };
}

// ── Canvas component ─────────────────────────────────────────────────────────
function TopicCanvas({ title }: { title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animType = detectAnimation(title);

  useEffect(() => {
    if (animType === 'none' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    let frameFn: (() => void) | null = null;
    if (animType === 'binary') frameFn = createBinaryAnimation(canvas);
    else if (animType === 'network') frameFn = createNetworkAnimation(canvas);
    else if (animType === 'code') frameFn = createCodeAnimation(canvas);
    else if (animType === 'logic') frameFn = createLogicAnimation(canvas);
    if (!frameFn) return;

    let rafId: number;
    let frame = 0;
    const loop = () => {
      frame++;
      if (frame % 2 === 0) frameFn!(); // ~30fps
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [animType]);

  if (animType === 'none') return null;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
    />
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
interface TopicCardProps {
  id: string;
  egeId: string;
  title: string;
  description: string;
  progress: { solved: number; total: number };
}

export function TopicCard({ id, egeId, title, description, progress }: TopicCardProps) {
  const isComplete = progress.solved === progress.total;
  const percent = progress.total > 0 ? Math.round((progress.solved / progress.total) * 100) : 0;

  const barColor =
    percent >= 80 ? 'bg-[#3F8C62]' : percent >= 50 ? 'bg-amber-400' : 'bg-red-300';

  return (
    <Link
      to={`${id}`}
      className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1 block relative w-full max-w-[400px] overflow-hidden"
    >
      <TopicCanvas title={title} />

      {/* Card content above canvas */}
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={clsx(
            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
            isComplete ? "bg-green-100 text-green-700" : "bg-[#3F8C62] text-white"
          )}>
            {egeId}
          </div>
          <div className={clsx(
            "px-2 py-1 rounded-full text-xs font-medium",
            isComplete ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          )}>
            {progress.solved}/{progress.total}
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 mb-4 group-hover:text-[#3F8C62] transition-colors">
          {title}
        </h3>

        <div className="flex items-center gap-2.5">
          <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={clsx(barColor, 'h-full rounded-full transition-all duration-500 ease-out')}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{percent}%</span>
        </div>
      </div>
    </Link>
  );
}
