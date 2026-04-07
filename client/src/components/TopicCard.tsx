import React from "react";
import { Link } from "react-router";
import { clsx } from "clsx";
import { BookOpen, ClipboardCheck, FileText, Home, Users } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
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

type StepState = "completed" | "active" | "locked";

// ── Sizes ────────────────────────────────────────────────────────────────────
const SM = 42;
const LG = 68;
const LG_R = 28;

// ── Step circles ─────────────────────────────────────────────────────────────
function SmallCircle({ icon: Icon, done }: { icon: React.ElementType; done: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-full flex items-center justify-center shrink-0",
        done ? "bg-[#3F8C62] shadow-sm shadow-[#3F8C62]/20" : "bg-white border-2 border-gray-200",
      )}
      style={{ width: SM, height: SM }}
    >
      <Icon size={17} className={done ? "text-white" : "text-gray-300"} />
    </div>
  );
}

function ActiveCircle({ icon: Icon, pct }: { icon: React.ElementType; pct: number }) {
  const circ = 2 * Math.PI * LG_R;
  const offset = circ * (1 - pct);

  return (
    <div className="relative shrink-0" style={{ width: LG, height: LG }}>
      <svg width={LG} height={LG} className="-rotate-90">
        <circle cx={LG / 2} cy={LG / 2} r={LG_R} fill="white" stroke="#e5e7eb" strokeWidth={3} />
        <circle
          cx={LG / 2} cy={LG / 2} r={LG_R}
          fill="none" stroke="#3F8C62" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Icon size={18} className="text-[#3F8C62]" />
        <span className="text-[10px] font-bold text-[#3F8C62] mt-0.5">
          {Math.round(pct * 100)}%
        </span>
      </div>
    </div>
  );
}

// ── Step config ──────────────────────────────────────────────────────────────
const STEP_ICONS: React.ElementType[] = [BookOpen, ClipboardCheck, FileText, ClipboardCheck, Home];
const STEP_LABELS = ["Теория", "Тест", "Разбор", "Тест", "Домашка"];

// ── Main card ────────────────────────────────────────────────────────────────
export function TopicCard({ egeId, title, tutorial, homework }: TopicCardProps) {
  const totalSolved = (tutorial?.solved ?? 0) + (homework?.solved ?? 0);
  const totalTasks = (tutorial?.total ?? 0) + (homework?.total ?? 0);

  const tutDone = tutorial != null && tutorial.total > 0 && tutorial.solved === tutorial.total;
  const hwDone = homework != null && homework.total > 0 && homework.solved === homework.total;
  const allDone = totalTasks > 0 && totalSolved === totalTasks;

  const tutPct = tutorial && tutorial.total > 0 ? tutorial.solved / tutorial.total : 0;
  const hwPct = homework && homework.total > 0 ? homework.solved / homework.total : 0;

  // Each step is independent: available if it has data, locked otherwise
  // Step 2 = Разбор (tutorial), Step 4 = Домашка (homework), rest = locked (no data yet)
  function state(i: number): StepState {
    if (i === 2) return tutorial ? (tutDone ? "completed" : "active") : "locked";
    if (i === 4) return homework ? (hwDone ? "completed" : "active") : "locked";
    return "locked";
  }

  function pct(i: number): number {
    if (i === 2) return tutPct;
    if (i === 4) return hwPct;
    return 0;
  }

  function stepLink(i: number): string | undefined {
    if (i === 2 && tutorial) return `/tasks/${tutorial.id}`;
    if (i === 4 && homework) return `/homework/${homework.id}`;
    return undefined;
  }

  function lineGreen(rightIdx: number): boolean {
    // Line is green if BOTH its left and right steps are completed or active
    const leftIdx = rightIdx - 1;
    const ls = state(leftIdx);
    const rs = state(rightIdx);
    return ls !== "locked" && rs !== "locked";
  }

  return (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#D6E4DA] to-[#C4D8C9] border border-[#C4D8C9] hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-400/30 transition-all duration-300">
      <div className="relative z-10 p-5 flex flex-col min-h-[220px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <Users size={16} className="text-[#3F8C62]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-white/70 text-[11px] font-bold text-gray-700 tracking-wider uppercase">
              Задание {egeId}
            </span>
            <span className="px-2 py-1.5 rounded-lg bg-white/70 text-[11px] font-bold text-gray-500 tabular-nums">
              {totalSolved}/{totalTasks}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-gray-900 font-bold text-[15px] leading-snug mb-auto group-hover:text-[#3F8C62] transition-colors">
          {title}
        </h3>

        {/* Stepper */}
        <div className="mt-4 flex items-start">
          {STEP_ICONS.map((Icon, i) => {
            const s = state(i);
            const isActive = s === "active";
            const w = isActive ? LG : SM;
            const to = stepLink(i);
            const navigable = !!to && s !== "locked";

            const circle = isActive
              ? <ActiveCircle icon={Icon} pct={pct(i)} />
              : <SmallCircle icon={Icon} done={s === "completed"} />;

            const wrapped = navigable
              ? <Link to={to!} onClick={e => e.stopPropagation()} className="contents">{circle}</Link>
              : circle;

            return (
              <React.Fragment key={i}>
                {/* Connecting line */}
                {i > 0 && (
                  <div className="flex-1 flex items-center" style={{ height: LG }}>
                    <div className={clsx("w-full h-0.5 rounded-full", lineGreen(i) ? "bg-[#3F8C62]" : "bg-gray-200")} />
                  </div>
                )}
                {/* Step column */}
                <div
                  className={clsx("flex flex-col items-center", navigable && "cursor-pointer hover:scale-105 transition-transform")}
                  style={{ width: w }}
                >
                  <div className="flex items-center justify-center" style={{ height: LG }}>
                    {wrapped}
                  </div>
                  <span className={clsx(
                    "text-[10px] font-semibold mt-1",
                    s === "locked" ? "text-gray-400" : "text-gray-600",
                  )}>
                    {STEP_LABELS[i]}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
