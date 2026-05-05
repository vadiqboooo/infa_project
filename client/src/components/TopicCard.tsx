import React, { useMemo } from "react";
import { Link } from "react-router";
import { clsx } from "clsx";
import { ArrowRight, ImageIcon, Sparkles } from "lucide-react";
import type { TopicImagePosition } from "../api/types";

// ── Шатл внутри картинки карточки ──────────────────────────────────────────
function ShuttleInImage() {
  const cfg = useMemo(
    () => ({
      top: 10 + Math.random() * 70,         // 10-80% от высоты картинки
      duration: 3.5 + Math.random() * 2.5,  // 3.5-6 секунд
      rotate: -12 + Math.random() * 24,     // ±12°
      dir: Math.random() > 0.5 ? "right" : ("left" as "right" | "left"),
    }),
    [],
  );
  const animName = cfg.dir === "right" ? "shuttle-fly-rtl" : "shuttle-fly-ltr";
  const flipX = cfg.dir === "left" ? -1 : 1;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[5] select-none"
      style={{
        top: `${cfg.top}%`,
        animation: `${animName} ${cfg.duration}s linear forwards`,
      }}
    >
      <img
        src="/character/shutle.png"
        alt=""
        draggable={false}
        className="w-12 h-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
        style={{ transform: `rotate(${cfg.rotate}deg) scaleX(${flipX})` }}
      />
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
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
  /** URL фона из админки. Перекрывает legacy `image`. null = админ выбрал «без фона». */
  backgroundUrl?: string | null;
  /** URL персонажа из админки. null = «без персонажа». undefined = детерминированно по egeNum. */
  characterUrl?: string | null;
  /** Если задан — на карточке проигрывается анимация пролёта шатла. Меняй ключ, чтобы перезапустить. */
  shuttleKey?: number | null;
  newTasksCount?: number;
}

// ── Цветовая палитра (по номеру задания) ────────────────────────────────────
type Accent = {
  glow: string;
  soft: string;
};

const PALETTE: Accent[] = [
  { glow: "shadow-emerald-900/10", soft: "from-emerald-50/80" },
  { glow: "shadow-green-900/10", soft: "from-green-50/80" },
  { glow: "shadow-teal-900/10", soft: "from-teal-50/80" },
  { glow: "shadow-lime-900/10", soft: "from-lime-50/70" },
];

function pickAccent(key: number): Accent {
  const n = Number.isFinite(key) ? Math.abs(Math.trunc(key)) : 0;
  return PALETTE[n % PALETTE.length];
}

// Два астронавта из /public/character — детерминированно выбираем по egeNum
const ASTRONAUTS = [
  "/character/cute-astronaut-blowing-gum-with-hoodie-cartoon-vector-icon-illustration-science-fashion-isolated.png",
  "/character/cute-astronaut-dancing-cartoon-vector-icon-illustration-science-technology-icon-concept-isolated.png",
];

// ── Карточка ────────────────────────────────────────────────────────────────
export function TopicCard({ egeId, egeNum, title, tutorial, homework, image, backgroundUrl, characterUrl, shuttleKey, newTasksCount = 0 }: TopicCardProps) {
  const totalSolved = (tutorial?.solved ?? 0) + (homework?.solved ?? 0);
  const totalTasks  = (tutorial?.total  ?? 0) + (homework?.total  ?? 0);
  const pct = totalTasks > 0 ? Math.round((totalSolved / totalTasks) * 100) : 0;

  const cardHref = tutorial
    ? `/tasks/${tutorial.id}`
    : homework
      ? `/homework/${homework.id}`
      : null;

  // Фон: явный backgroundUrl (включая null = «без фона») в приоритете; иначе legacy image
  const bgUrl = backgroundUrl !== undefined
    ? backgroundUrl
    : image
      ? `/api/topics/${image.topicId}/image`
      : null;

  const accentKey = egeNum ?? parseInt(egeId.split("-")[0], 10) ?? 0;
  const accent = pickAccent(accentKey);

  // Для одиночных чисел добавляем ведущий ноль (3 → 03), диапазоны (25-26) оставляем как есть
  const badgeText = !egeId.includes("-") && egeId.length === 1 ? `0${egeId}` : egeId;

  // Персонаж: явный characterUrl (null = «без персонажа») в приоритете; иначе детерминированно по accentKey
  const fallbackAstronaut = ASTRONAUTS[Math.abs(accentKey) % ASTRONAUTS.length];
  const astronautSrc: string | null = characterUrl === null
    ? null
    : (characterUrl ?? fallbackAstronaut);
  // «Танцор» (ASTRONAUTS[1]) — летает по карточке и отталкивается; остальные — парят на месте
  const isBouncing = astronautSrc === ASTRONAUTS[1];
  // Десинхронизируем плавание у разных карточек
  const floatDuration = 5 + (Math.abs(accentKey) % 4);   // 5-8s
  const floatDelay = (Math.abs(accentKey) * 0.37) % 3;   // 0-3s
  // Параметры дрейфа для летающего: разные длительности X и Y → неповторяющийся путь
  const driftXDuration = 11 + (Math.abs(accentKey) % 6); // 11-16s
  const driftYDuration = 7  + (Math.abs(accentKey) % 5); // 7-11s
  const driftXDelay = (Math.abs(accentKey) * 0.41) % 4;
  const driftYDelay = (Math.abs(accentKey) * 0.83) % 4;
  const driftRotDuration = 4 + (Math.abs(accentKey) % 3); // 4-6s
  // Чередуем угол / сторону, чтобы карточки не выглядели одинаково
  const flipX = accentKey % 2 === 0 ? -1 : 1;

  const inner = (
    <div
      className={clsx(
        "group relative w-full overflow-hidden rounded-[18px] border border-[#dfe8df] bg-gradient-to-b to-white",
        "shadow-[0_18px_50px_rgba(15,23,20,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-[#b9d2bd] hover:shadow-2xl",
        accent.glow,
        accent.soft,
        "flex flex-col",
      )}
    >
      {/* Картинка сверху */}
      <div className="relative w-full h-[180px] bg-[#07100f] overflow-hidden">
        {bgUrl ? (
          <img
            src={bgUrl}
            alt=""
            className="w-full h-full object-cover saturate-[0.92] contrast-[1.05] group-hover:scale-[1.035] transition-transform duration-700"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              t.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/25">
            <ImageIcon size={48} />
          </div>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_0%,rgba(98,170,120,0.22),transparent_42%),linear-gradient(180deg,rgba(8,12,16,0.04),rgba(8,12,16,0.24))] pointer-events-none z-[6]" />

        {newTasksCount > 0 && (
          <div className="absolute left-4 top-4 z-30 pointer-events-none">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-[#06140f]/82 px-3.5 py-2 text-white shadow-[0_12px_28px_rgba(6,20,15,0.34)] backdrop-blur-md">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(126,217,141,0.35),transparent_34%),linear-gradient(135deg,rgba(78,140,90,0.5),rgba(6,20,15,0.1))]" />
              <div className="relative flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-300/18 text-emerald-100 ring-1 ring-emerald-200/40">
                  <Sparkles size={14} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] font-black uppercase tracking-wide text-emerald-100">
                    Новые задачи
                  </span>
                  <span className="text-[12px] font-black text-white">
                    +{newTasksCount} в топике
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Номер задания — большое число без фона */}
        <div className="absolute top-3 right-4 z-10 text-white leading-none pointer-events-none">
          <span className="block text-[44px] font-black tabular-nums drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            {badgeText}
          </span>
        </div>

        {/* Астронавт: либо парит на месте, либо летает по карточке и отталкивается от стенок */}
        {astronautSrc && (
          isBouncing ? (
            <div
              aria-hidden="true"
              className="absolute w-[78px] h-[78px] pointer-events-none select-none z-20"
              style={{
                animation: `drift-x ${driftXDuration}s ease-in-out infinite alternate, drift-y ${driftYDuration}s ease-in-out infinite alternate`,
                animationDelay: `${driftXDelay}s, ${driftYDelay}s`,
              }}
            >
              <div className="w-full h-full" style={{ transform: `scaleX(${flipX})` }}>
                <img
                  src={astronautSrc}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
                  style={{
                    animation: `drift-rotate ${driftRotDuration}s ease-in-out infinite`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="absolute bottom-1 left-2 w-[78px] h-[78px] pointer-events-none select-none z-20"
              style={{ transform: `scaleX(${flipX})` }}
            >
              <img
                src={astronautSrc}
                alt=""
                draggable={false}
                className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
                style={{
                  animation: `float-astronaut ${floatDuration}s ease-in-out infinite`,
                  animationDelay: `${floatDelay}s`,
                }}
              />
            </div>
          )
        )}

        {/* Случайно пролетающий шатл (только когда родитель передал ключ) */}
        {shuttleKey != null && <ShuttleInImage key={shuttleKey} />}

        {/* Градиент-затемнение, чтобы белый заголовок читался на любой картинке */}
        <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-[#050807]/90 via-[#050807]/45 to-transparent pointer-events-none z-[8]" />

        {/* Название топика — поверх картинки внизу, слева оставлен отступ под астронавта */}
        <div className="absolute bottom-4 left-[96px] right-5 z-10 pointer-events-none">
          <h3 className="text-white font-black text-[15px] leading-tight line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
            {title}
          </h3>
        </div>
      </div>

      {/* Содержимое */}
      <div className="relative p-5 flex flex-col gap-4 flex-1">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#62aa78]/35 to-transparent" />
        {/* Прогресс-бар + процент */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#e2e8e2] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4e8c5a] to-[#62aa78] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[12px] font-extrabold text-[#25352b] tabular-nums shrink-0 w-10 text-right">
            {pct}%
          </span>
        </div>

        {/* Низ: счётчик и кнопка */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <span className="text-[13px] text-[#667568] font-semibold tabular-nums">
            {totalSolved} / {totalTasks} выполнено
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4e8c5a] px-4 py-2 text-[12px] font-extrabold text-white shadow-[0_10px_22px_rgba(78,140,90,0.22)] transition-all group-hover:bg-[#62aa78] group-hover:shadow-[0_12px_28px_rgba(78,140,90,0.32)]">
            Перейти
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </div>
  );

  return cardHref ? (
    <Link
      to={cardHref}
      className="block rounded-[18px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F8C62]/30"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
