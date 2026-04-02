import React, { useEffect, useRef } from "react";
import { Link } from "react-router";
import { clsx } from "clsx";
import { ArrowRight, Hash, Network, Code2, GitBranch, Sparkles, CheckCircle2, BookOpen, ClipboardList, FlaskConical, PenTool, Lock } from "lucide-react";

type AnimationType = 'binary' | 'network' | 'code' | 'logic' | 'none';

function detectAnimation(title: string): AnimationType {
  const t = title.toLowerCase();
  if (/счисл|двоич|восьмер|шестнадц|основани|перевод|bit|hex/.test(t)) return 'binary';
  if (/ip|сет|адрес|протокол|маск|коммутац|маршрут|subnet|tcp|udp/.test(t)) return 'network';
  if (/программ|питон|python|алгоритм|цикл|функци|массив|строк|рекурс|сортир|код|файл/.test(t)) return 'code';
  if (/логик|буль|граф|дерево|табл.*истин|предикат|высказ/.test(t)) return 'logic';
  return 'none';
}

const ANIMATION_ICON: Record<AnimationType, React.ElementType> = {
  binary: Hash,
  network: Network,
  code: Code2,
  logic: GitBranch,
  none: Sparkles,
};

function createBinaryAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const fontSize = 11;
  const cols = Math.floor(W / fontSize);
  const drops = Array.from({ length: cols }, () => -(Math.random() * H / fontSize));
  return () => {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `${fontSize}px monospace`;
    for (let i = 0; i < drops.length; i++) {
      const alpha = Math.random() * 0.18 + 0.04;
      ctx.fillStyle = `rgba(63,140,98,${alpha})`;
      ctx.fillText(Math.random() > 0.5 ? '1' : '0', i * fontSize + 2, drops[i] * fontSize);
      if (drops[i] * fontSize > H && Math.random() > 0.97) drops[i] = 0;
      drops[i] += 0.35;
    }
  };
}

function createNetworkAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const nodes = Array.from({ length: 9 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
    label: `${rnd(192)}.${rnd(168)}.${rnd(10)}.${rnd(255)}`,
  }));
  return () => {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          ctx.strokeStyle = `rgba(59,130,246,${0.15 * (1 - dist / 90)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
        }
      }
    for (const n of nodes) {
      ctx.fillStyle = 'rgba(59,130,246,0.2)';
      ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, Math.PI * 2); ctx.fill();
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
  };
}

function createCodeAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const lines = ['def solve(n):', '    if n == 0:', '        return 1', 'for i in range(n):', '    print(i ** 2)', 'a = [int(x) for x in input().split()]', 'while x > 0:', '    x //= 2', 'print(bin(n)[2:])', 'ans = sum(a)', 'def gcd(a, b):', 'n = int(input())'];
  let offset = 0;
  const lineH = 13;
  return () => {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '9px monospace';
    offset = (offset + 0.25) % lineH;
    const total = Math.ceil(H / lineH) + 2;
    for (let i = 0; i < total; i++) {
      const lineIdx = (((Math.floor(i - offset / lineH)) % lines.length) + lines.length) % lines.length;
      ctx.fillStyle = 'rgba(34,197,94,0.1)';
      ctx.fillText(lines[lineIdx], 8, i * lineH - (offset % lineH) + lineH);
    }
  };
}

function createLogicAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const syms = ['∧', '∨', '¬', '→', '↔', '⊕', 'T', 'F', '1', '0', '⇒'];
  const particles = Array.from({ length: 14 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.45, vy: (Math.random() - 0.5) * 0.45,
    sym: syms[Math.floor(Math.random() * syms.length)],
    alpha: Math.random() * 0.12 + 0.04,
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
    let rafId: number, frame = 0;
    const loop = () => { frame++; if (frame % 2 === 0) frameFn!(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [animType]);
  if (animType === 'none') return null;
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none opacity-40" />;
}

// ── Section chip ──────────────────────────────────────────────────────────────
interface SectionChipProps {
  icon: React.ElementType;
  label: string;
  to?: string;
  solved?: number;
  total?: number;
  disabled?: boolean;
  color: 'green' | 'blue' | 'purple' | 'orange';
}

const CHIP_COLORS = {
  green:  'text-[#3F8C62] bg-white border-[#3F8C62]/20',
  blue:   'text-blue-600  bg-white border-blue-200',
  purple: 'text-gray-400  bg-gray-50 border-gray-200',
  orange: 'text-gray-400  bg-gray-50 border-gray-200',
};

function SectionChip({ icon: Icon, label, to, solved, total, disabled, color }: SectionChipProps) {
  const percent = total && total > 0 ? Math.round((solved ?? 0) / total * 100) : 0;
  const isComplete = !disabled && total != null && total > 0 && solved === total;

  const inner = (
    <div className={clsx(
      'flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
      disabled ? 'text-gray-300 bg-gray-50 border-gray-100' : CHIP_COLORS[color],
      !disabled && 'hover:brightness-95',
    )}>
      <div className="flex items-center gap-1.5 min-w-0">
        {isComplete
          ? <CheckCircle2 size={12} className="text-[#3F8C62] shrink-0" />
          : <Icon size={12} className="shrink-0" />
        }
        <span className="truncate">{label}</span>
      </div>
      {disabled
        ? <Lock size={10} className="text-gray-300 shrink-0" />
        : total != null
          ? <span className="tabular-nums text-[10px] opacity-60 shrink-0">{solved}/{total}</span>
          : null
      }
    </div>
  );

  if (disabled || !to) return inner;
  return <Link to={to} onClick={e => e.stopPropagation()} className="block">{inner}</Link>;
}

// ── Main card ─────────────────────────────────────────────────────────────────
export interface SectionInfo {
  id: number;
  solved: number;
  total: number;
}

interface TopicCardProps {
  egeId: string;
  title: string;
  tutorial: SectionInfo | null;
  homework: SectionInfo | null;
}

export function TopicCard({ egeId, title, tutorial, homework }: TopicCardProps) {
  const totalSolved = (tutorial?.solved ?? 0) + (homework?.solved ?? 0);
  const totalTasks = (tutorial?.total ?? 0) + (homework?.total ?? 0);
  const isComplete = totalTasks > 0 && totalSolved === totalTasks;
  const percent = totalTasks > 0 ? Math.round(totalSolved / totalTasks * 100) : 0;

  const animType = detectAnimation(title);
  const Icon = ANIMATION_ICON[animType];
  const mainTo = tutorial ? `/tasks/${tutorial.id}` : homework ? `/homework/${homework.id}` : '#';

  return (
    <div
      className="group relative w-full max-w-[400px] rounded-2xl overflow-hidden bg-[#D6E4DA] border border-[#C4D8C9] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-gray-400/40 transition-all duration-300"
      style={{ minHeight: 210 }}
    >
      {/* Blob shapes */}
      <div className="absolute -bottom-10 -right-10 w-52 h-52 pointer-events-none"
        style={{ background: isComplete ? '#fef9ec' : '#c8ddd0', borderRadius: '60% 40% 55% 45% / 35% 60% 40% 65%' }} />
      <div className="absolute -top-6 left-10 w-36 h-36 pointer-events-none"
        style={{ background: isComplete ? '#fefce8' : '#ccdfd4', borderRadius: '40% 60% 70% 30% / 60% 30% 70% 40%', opacity: 0.8 }} />

      <TopicCanvas title={title} />

      <div className="relative z-10 p-5 flex flex-col" style={{ minHeight: 210 }}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className={clsx(
            "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0",
            isComplete ? "border-amber-300 bg-amber-50" : "border-gray-300/60 bg-white/50"
          )}>
            {isComplete
              ? <CheckCircle2 size={15} className="text-amber-500" />
              : <Icon size={15} className="text-[#3F8C62]" />
            }
          </div>

          <div className={clsx(
            "px-3.5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase",
            isComplete
              ? "bg-amber-50 text-amber-600 border border-amber-200"
              : "bg-white/60 text-[#3F8C62] border border-[#3F8C62]/25"
          )}>
            Задание {egeId}
          </div>

          <div className={clsx(
            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
            isComplete ? "bg-amber-50 text-amber-500" : "bg-white/50 text-gray-500"
          )}>
            {totalSolved}/{totalTasks}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-gray-900 font-bold text-[15px] leading-snug mb-3 group-hover:text-[#3F8C62] transition-colors line-clamp-2">
          {title}
        </h3>

        {/* 4 section chips */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          <SectionChip icon={BookOpen}    label="Разбор"   to={tutorial ? `/tasks/${tutorial.id}` : undefined}     solved={tutorial?.solved}  total={tutorial?.total}  disabled={!tutorial}  color="green"  />
          <SectionChip icon={ClipboardList} label="Домашка" to={homework ? `/homework/${homework.id}` : undefined}  solved={homework?.solved}  total={homework?.total}  disabled={!homework}  color="blue"   />
          <SectionChip icon={FlaskConical} label="Теория"   disabled color="purple" />
          <SectionChip icon={PenTool}      label="Тесты"    disabled color="orange" />
        </div>

        {/* Footer: progress bar + arrow */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2 flex-1 mr-3">
            <div className="flex-1 bg-white/50 h-1.5 rounded-full overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-500",
                  percent >= 80 ? "bg-[#3F8C62]" : percent >= 50 ? "bg-amber-400" : "bg-red-300"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-gray-500 text-[11px] shrink-0 tabular-nums">{percent}%</span>
          </div>

          <Link
            to={mainTo}
            className="w-9 h-9 rounded-full bg-[#3F8C62] flex items-center justify-center shadow-md shadow-[#3F8C62]/20 group-hover:scale-110 group-hover:bg-[#357a55] transition-all duration-200 shrink-0"
          >
            <ArrowRight size={15} className="text-white translate-x-px" />
          </Link>
        </div>
      </div>
    </div>
  );
}
