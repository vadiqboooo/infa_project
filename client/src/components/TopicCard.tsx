import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import type { TopicImagePosition } from "../api/types";

function ShuttleInImage() {
  const cfg = useMemo(
    () => ({
      top: 12 + Math.random() * 58,
      duration: 3.5 + Math.random() * 2.5,
      rotate: -12 + Math.random() * 24,
      dir: Math.random() > 0.5 ? "right" : ("left" as "right" | "left"),
    }),
    [],
  );
  const animName = cfg.dir === "right" ? "shuttle-fly-rtl" : "shuttle-fly-ltr";
  const flipX = cfg.dir === "left" ? -1 : 1;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 select-none"
      style={{
        top: `${cfg.top}%`,
        animation: `${animName} ${cfg.duration}s linear forwards`,
      }}
    >
      <img
        src="/character/shutle.png"
        alt=""
        draggable={false}
        className="h-auto w-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
        style={{ transform: `rotate(${cfg.rotate}deg) scaleX(${flipX})` }}
      />
    </div>
  );
}

export interface SectionInfo {
  id: number;
  solved: number;
  total: number;
}

export interface TopicImage {
  topicId: number;
  position: TopicImagePosition;
  size: number;
}

interface TopicCardProps {
  egeId: string;
  egeNum?: number;
  title: string;
  tutorial: SectionInfo | null;
  homework: SectionInfo | null;
  image?: TopicImage | null;
  backgroundUrl?: string | null;
  characterUrl?: string | null;
  shuttleKey?: number | null;
  newTasksCount?: number;
  planCurrent?: boolean;
  locked?: boolean;
  trial?: boolean;
}

type Accent = {
  background: string;
  border: string;
  glow: string;
  progress: string;
  button: string;
  buttonText: string;
  dot: string;
};

const PALETTE: Accent[] = [
  {
    background: "linear-gradient(135deg, rgba(8,47,44,0.98) 0%, rgba(7,18,28,0.98) 58%, rgba(9,14,24,0.98) 100%)",
    border: "border-emerald-400/15",
    glow: "rgba(16,185,129,0.18)",
    progress: "from-emerald-400 to-green-500",
    button: "bg-emerald-400/10 ring-1 ring-emerald-300/15 group-hover:bg-emerald-400/18",
    buttonText: "text-emerald-200",
    dot: "bg-emerald-400",
  },
  {
    background: "linear-gradient(135deg, rgba(35,18,64,0.98) 0%, rgba(13,17,34,0.98) 58%, rgba(7,13,24,0.98) 100%)",
    border: "border-violet-400/15",
    glow: "rgba(139,92,246,0.2)",
    progress: "from-violet-400 to-purple-500",
    button: "bg-violet-400/10 ring-1 ring-violet-300/15 group-hover:bg-violet-400/18",
    buttonText: "text-violet-200",
    dot: "bg-violet-400",
  },
  {
    background: "linear-gradient(135deg, rgba(67,22,45,0.98) 0%, rgba(23,18,36,0.98) 58%, rgba(8,13,24,0.98) 100%)",
    border: "border-rose-400/15",
    glow: "rgba(244,63,94,0.18)",
    progress: "from-rose-400 to-pink-500",
    button: "bg-rose-400/10 ring-1 ring-rose-300/15 group-hover:bg-rose-400/18",
    buttonText: "text-rose-200",
    dot: "bg-rose-400",
  },
  {
    background: "linear-gradient(135deg, rgba(58,38,11,0.98) 0%, rgba(29,23,20,0.98) 58%, rgba(8,13,24,0.98) 100%)",
    border: "border-amber-400/15",
    glow: "rgba(245,158,11,0.2)",
    progress: "from-amber-300 to-orange-500",
    button: "bg-amber-400/10 ring-1 ring-amber-300/15 group-hover:bg-amber-400/18",
    buttonText: "text-amber-200",
    dot: "bg-amber-400",
  },
];

function pickAccent(key: number): Accent {
  const n = Number.isFinite(key) ? Math.abs(Math.trunc(key)) : 0;
  return PALETTE[n % PALETTE.length];
}

const ASTRONAUTS = [
  "/character/cute-astronaut-blowing-gum-with-hoodie-cartoon-vector-icon-illustration-science-fashion-isolated.png",
  "/character/cute-astronaut-dancing-cartoon-vector-icon-illustration-science-technology-icon-concept-isolated.png",
];

export function TopicCard({
  egeId,
  egeNum,
  title,
  tutorial,
  homework,
  image,
  backgroundUrl,
  characterUrl,
  shuttleKey,
  newTasksCount = 0,
  planCurrent = false,
  locked = false,
  trial = false,
}: TopicCardProps) {
  const totalSolved = (tutorial?.solved ?? 0) + (homework?.solved ?? 0);
  const totalTasks = (tutorial?.total ?? 0) + (homework?.total ?? 0);
  const pct = totalTasks > 0 ? Math.round((totalSolved / totalTasks) * 100) : 0;

  const cardHref = tutorial
    ? `/tasks/${tutorial.id}`
    : homework
      ? `/homework/${homework.id}`
      : null;

  const bgUrl = backgroundUrl !== undefined
    ? backgroundUrl
    : image
      ? `/api/topics/${image.topicId}/image`
      : null;

  const accentKey = egeNum ?? parseInt(egeId.split("-")[0], 10) ?? 0;
  const accent = pickAccent(accentKey);
  const badgeText = !egeId.includes("-") && egeId.length === 1 ? `0${egeId}` : egeId;
  const fallbackAstronaut = ASTRONAUTS[Math.abs(accentKey) % ASTRONAUTS.length];
  const astronautSrc = characterUrl === null ? null : (characterUrl ?? fallbackAstronaut);
  const floatDuration = 5 + (Math.abs(accentKey) % 4);
  const floatDelay = (Math.abs(accentKey) * 0.37) % 3;
  const flipX = accentKey % 2 === 0 ? -1 : 1;

  const inner = (
    <div
      className={clsx(
        "group relative flex min-h-[194px] overflow-hidden rounded-[18px] border p-5",
        "shadow-[0_18px_48px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.03]",
        "transition duration-300",
        locked
          ? "cursor-not-allowed opacity-70"
          : "hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_22px_60px_rgba(0,0,0,0.34)]",
        accent.border,
      )}
      style={{ background: accent.background }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-3xl"
        style={{ background: accent.glow }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.24) 0 1px, transparent 2px), radial-gradient(circle at 43% 8%, rgba(255,255,255,0.16) 0 1px, transparent 2px), radial-gradient(circle at 82% 28%, rgba(255,255,255,0.13) 0 1px, transparent 2px), radial-gradient(circle at 70% 78%, rgba(255,255,255,0.10) 0 1px, transparent 2px)",
        }}
      />
      {bgUrl && (
        <img
          src={bgUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10] mix-blend-screen"
          draggable={false}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
      )}

      <span className={clsx("absolute left-5 top-5 h-1.5 w-1.5 rounded-full shadow-[0_0_12px_currentColor]", accent.dot)} />

      <div className="absolute right-5 top-4 z-20 text-[28px] font-black leading-none tracking-normal text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.65)]">
        {badgeText}
      </div>

      {(locked || trial || planCurrent || newTasksCount > 0) && (
        <div className="absolute right-5 top-12 z-20">
          <span className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ring-1",
            locked
              ? "bg-slate-950/70 text-slate-200 ring-white/10"
              : trial
                ? "bg-sky-400/18 text-sky-100 ring-sky-300/20"
                : "bg-emerald-400/18 text-emerald-100 ring-emerald-300/20",
          )}>
            {locked ? <Lock size={11} /> : <Sparkles size={11} />}
            {locked ? "Подписка" : trial ? "Пробный доступ" : planCurrent ? "по плану" : `+${newTasksCount}`}
          </span>
        </div>
      )}

      {astronautSrc && (
        <div
          aria-hidden="true"
          className="absolute left-5 top-9 z-20 h-[68px] w-[68px] pointer-events-none select-none"
          style={{ transform: `scaleX(${flipX})` }}
        >
          <img
            src={astronautSrc}
            alt=""
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.45)]"
            style={{
              animation: `float-astronaut ${floatDuration}s ease-in-out infinite`,
              animationDelay: `${floatDelay}s`,
            }}
          />
        </div>
      )}

      {shuttleKey != null && <ShuttleInImage key={shuttleKey} />}

      <div className="relative z-10 mt-[88px] flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 min-h-[40px] pr-4 text-[15px] font-black leading-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
          {title}
        </h3>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={clsx("h-full rounded-full bg-gradient-to-r transition-all duration-500", accent.progress)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-400">
            {pct}%
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[12px] font-semibold tabular-nums text-slate-400">
            {totalSolved} / {totalTasks} выполнено
          </span>
          <span className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition", accent.button, accent.buttonText)}>
            {locked ? "Закрыто" : "Перейти"}
            {locked ? <Lock size={13} /> : <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />}
          </span>
        </div>
      </div>
    </div>
  );

  return cardHref && !locked ? (
    <Link
      to={cardHref}
      className="block rounded-[18px] focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
