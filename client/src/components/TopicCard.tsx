import React from "react";
import { Link } from "react-router";
import { clsx } from "clsx";
import { BookOpen, Home } from "lucide-react";
import type { TopicImagePosition } from "../api/types";

// ── Types ────────────────────────────────────────────────────────────────────
export interface SectionInfo {
  id: number;
  solved: number;
  total: number;
}

export interface TopicImage {
  topicId: number;
  position: TopicImagePosition;
  size: number; // px
}

interface TopicCardProps {
  egeId: string;
  title: string;
  tutorial: SectionInfo | null;
  homework: SectionInfo | null;
  image?: TopicImage | null;
}

// ── Stat row: just info, not interactive ────────────────────────────────────
function StatRow({
  label,
  icon: Icon,
  section,
  variant = "light",
}: {
  label: string;
  icon: React.ElementType;
  section: SectionInfo | null;
  variant?: "light" | "dark";
}) {
  const total = section?.total ?? 0;
  const solved = section?.solved ?? 0;
  const pct = total > 0 ? solved / total : 0;
  const enabled = section != null && total > 0;

  const dark = variant === "dark";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={12} className={enabled
            ? (dark ? "text-white/90" : "text-[#3F8C62]")
            : (dark ? "text-white/40" : "text-gray-400")} />
          <span className={clsx(
            "text-[11px] font-bold uppercase tracking-wide truncate",
            enabled
              ? (dark ? "text-white/90" : "text-gray-700")
              : (dark ? "text-white/50" : "text-gray-400"),
          )}>{label}</span>
        </div>
        <span className={clsx(
          "text-[11px] font-bold tabular-nums shrink-0",
          enabled
            ? (dark ? "text-white" : "text-gray-900")
            : (dark ? "text-white/50" : "text-gray-400"),
        )}>{solved}/{total}</span>
      </div>
      <div className={clsx(
        "h-1.5 w-full rounded-full overflow-hidden",
        dark ? "bg-white/25" : "bg-gray-200/80",
      )}>
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500",
            dark ? "bg-white" : "bg-[#3F8C62]",
          )}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main card ────────────────────────────────────────────────────────────────
export function TopicCard({ egeId, title, tutorial, homework, image }: TopicCardProps) {
  const totalSolved = (tutorial?.solved ?? 0) + (homework?.solved ?? 0);
  const totalTasks = (tutorial?.total ?? 0) + (homework?.total ?? 0);

  // Whole card → goes to tutorial by default; falls back to homework
  const cardHref = tutorial
    ? `/tasks/${tutorial.id}`
    : homework
      ? `/homework/${homework.id}`
      : null;

  const imgUrl = image ? `/api/topics/${image.topicId}/image` : null;
  const pos = image?.position ?? null;
  const size = image?.size ?? 120;

  // ── Background variant: image fills the card, content overlays ──────────
  if (imgUrl && pos === "background") {
    const inner = (
      <div className="group relative w-full h-full rounded-2xl overflow-hidden border border-[#C4D8C9] hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-400/30 transition-all duration-300 min-h-[240px]">
        <img
          src={imgUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15" />
        <div className="relative z-10 p-5 flex flex-col h-full min-h-[240px]">
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1.5 rounded-lg bg-white/95 text-[11px] font-bold text-gray-800 tracking-wider uppercase">
              Задание {egeId}
            </span>
            <span className="px-2 py-1.5 rounded-lg bg-white/95 text-[11px] font-bold text-gray-700 tabular-nums">
              {totalSolved}/{totalTasks}
            </span>
          </div>
          <h3 className="text-white font-bold text-[16px] leading-snug mb-auto drop-shadow-md">{title}</h3>
          <div className="mt-4 space-y-2.5">
            <StatRow label="Разбор" icon={BookOpen} section={tutorial} variant="dark" />
            <StatRow label="Домашка" icon={Home} section={homework} variant="dark" />
          </div>
        </div>
      </div>
    );
    return cardHref ? <Link to={cardHref} className="block">{inner}</Link> : inner;
  }

  // ── Side variants (left / right) ────────────────────────────────────────
  if (imgUrl && (pos === "left" || pos === "right")) {
    const sideWidth = Math.max(60, Math.min(220, size));
    const imgPanel = (
      <div className="shrink-0 bg-gray-100" style={{ width: sideWidth }}>
        <img
          src={imgUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
    const inner = (
      <div className="group relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#D6E4DA] to-[#C4D8C9] border border-[#C4D8C9] hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-400/30 transition-all duration-300 flex min-h-[200px]">
        {pos === "left" && imgPanel}
        <div className="relative z-10 p-5 flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1.5 rounded-lg bg-white/70 text-[11px] font-bold text-gray-700 tracking-wider uppercase">
              Задание {egeId}
            </span>
            <span className="px-2 py-1.5 rounded-lg bg-white/70 text-[11px] font-bold text-gray-500 tabular-nums">
              {totalSolved}/{totalTasks}
            </span>
          </div>
          <h3 className="text-gray-900 font-bold text-[15px] leading-snug mb-auto group-hover:text-[#3F8C62] transition-colors">
            {title}
          </h3>
          <div className="mt-4 space-y-2.5">
            <StatRow label="Разбор" icon={BookOpen} section={tutorial} />
            <StatRow label="Домашка" icon={Home} section={homework} />
          </div>
        </div>
        {pos === "right" && imgPanel}
      </div>
    );
    return cardHref ? <Link to={cardHref} className="block">{inner}</Link> : inner;
  }

  // ── Cover variant (default with image): image on top ────────────────────
  const coverHeight = Math.max(60, Math.min(260, size));
  const inner = (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#D6E4DA] to-[#C4D8C9] border border-[#C4D8C9] hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-400/30 transition-all duration-300">
      {imgUrl && (
        <div className="w-full bg-gray-100 overflow-hidden" style={{ height: coverHeight }}>
          <img
            src={imgUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="relative z-10 p-5 flex flex-col min-h-[200px]">
        <div className="flex items-center justify-between mb-3">
          <span className="px-3 py-1.5 rounded-lg bg-white/70 text-[11px] font-bold text-gray-700 tracking-wider uppercase">
            Задание {egeId}
          </span>
          <span className="px-2 py-1.5 rounded-lg bg-white/70 text-[11px] font-bold text-gray-500 tabular-nums">
            {totalSolved}/{totalTasks}
          </span>
        </div>
        <h3 className="text-gray-900 font-bold text-[15px] leading-snug mb-auto group-hover:text-[#3F8C62] transition-colors">
          {title}
        </h3>
        <div className="mt-4 space-y-2.5">
          <StatRow label="Разбор" icon={BookOpen} section={tutorial} />
          <StatRow label="Домашка" icon={Home} section={homework} />
        </div>
      </div>
    </div>
  );
  return cardHref ? <Link to={cardHref} className="block">{inner}</Link> : inner;
}
