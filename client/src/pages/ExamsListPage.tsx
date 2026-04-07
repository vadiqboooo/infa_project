import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trophy, ChevronRight, Inbox, ClipboardCheck, BookMarked, GraduationCap, CheckCircle2 } from 'lucide-react';
import { useNavigation } from '../hooks/useApi';
import { clsx } from 'clsx';
import type { TopicNav } from '../api/types';

// ── Per-category visual config ─────────────────────────────────────────────────
const CATEGORY_STYLE = {
    control: {
        bg: '#D4DCE8',
        border: '#C0CDD8',
        blob1: '#c0cde0',
        blob2: '#c8d4e8',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
        badgeBg: 'bg-white/60 border-blue-300/40 text-blue-700',
        icon: ClipboardCheck,
        label: 'КР',
    },
    variants: {
        bg: '#D6E4DA',
        border: '#C4D8C9',
        blob1: '#c8ddd0',
        blob2: '#ccdfd4',
        iconBg: 'bg-[#3F8C62]/10',
        iconText: 'text-[#3F8C62]',
        badgeBg: 'bg-white/60 border-[#3F8C62]/25 text-[#3F8C62]',
        icon: BookMarked,
        label: 'Вариант',
    },
    mock: {
        bg: '#DDD4EC',
        border: '#CFC4DC',
        blob1: '#d0c8e4',
        blob2: '#d8d0ec',
        iconBg: 'bg-violet-100',
        iconText: 'text-violet-600',
        badgeBg: 'bg-white/60 border-violet-300/40 text-violet-700',
        icon: GraduationCap,
        label: 'Пробник',
    },
} as const;

type CategoryKey = keyof typeof CATEGORY_STYLE;

// ── Exam card ──────────────────────────────────────────────────────────────────
function ExamCard({ variant, categoryKey }: { variant: TopicNav; categoryKey: CategoryKey }) {
    const navigate = useNavigate();
    const style = CATEGORY_STYLE[categoryKey];
    const CatIcon = style.icon;

    const isSolved = variant.latest_score != null;
    const isMock = categoryKey === 'mock';
    const isVariant = categoryKey === 'variants';
    const isControl = categoryKey === 'control';
    const isPublished = isMock && !!(variant as any).analysis_published;

    const totalTasks = variant.tasks.length;
    const draftCount = variant.draft_count ?? 0;
    const solvedCount = variant.tasks.filter(t => t.status === 'solved').length;
    // For in-progress exams use draft count, for finished use solved count
    const answeredCount = isSolved ? solvedCount : draftCount;
    const progressPercent = totalTasks > 0 ? Math.min(100, Math.round(answeredCount / totalTasks * 100)) : 0;

    const score = variant.latest_score;
    const primaryScore = variant.latest_primary_score;
    // For control works: percentage and correct/total instead of EGE scores
    const correctCount = primaryScore ?? 0;
    const pctScore = totalTasks > 0 ? Math.round((correctCount / totalTasks) * 100) : 0;

    return (
        <button
            onClick={() => navigate(`/exams/${variant.id}`)}
            className="group relative w-full rounded-2xl overflow-hidden text-left hover:-translate-y-1.5 hover:shadow-xl hover:shadow-gray-400/40 transition-all duration-300"
            style={{ background: style.bg, border: `1px solid ${style.border}`, minHeight: 200 }}
        >
            {/* Blob shapes */}
            <div className="absolute -bottom-10 -right-10 w-52 h-52 pointer-events-none"
                style={{ background: isSolved ? '#fef9ec' : style.blob1, borderRadius: '60% 40% 55% 45% / 35% 60% 40% 65%' }} />
            <div className="absolute -top-6 left-10 w-36 h-36 pointer-events-none"
                style={{ background: isSolved ? '#fefce8' : style.blob2, borderRadius: '40% 60% 70% 30% / 60% 30% 70% 40%', opacity: 0.8 }} />

            {/* Large background score */}
            {isSolved && (!isMock || isPublished) && (
                <div className="absolute right-3 bottom-1 select-none pointer-events-none z-0 transition-transform group-hover:scale-105 duration-700">
                    <span className={clsx(
                        'text-[120px] font-black leading-none tracking-tighter',
                        isPublished ? 'text-violet-400/40' : isControl ? 'text-blue-400/35' : 'text-[#3F8C62]/35'
                    )}>
                        {isControl ? `${pctScore}%` : score?.toFixed(0)}
                    </span>
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col min-h-[200px]">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                    {/* Icon */}
                    <div className={clsx(
                        'w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0',
                        isSolved ? 'border-amber-300 bg-amber-50' : clsx('border-white/40', style.iconBg)
                    )}>
                        {isSolved
                            ? <CheckCircle2 size={15} className="text-amber-500" />
                            : <CatIcon size={15} className={style.iconText} />
                        }
                    </div>

                    {/* Center badge */}
                    <div className={clsx(
                        'px-3.5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border',
                        isSolved ? 'bg-amber-50 text-amber-600 border-amber-200' : style.badgeBg
                    )}>
                        {style.label}
                    </div>

                    {/* Right info */}
                    <div className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0',
                        isSolved ? 'bg-amber-50 text-amber-500' : 'bg-white/50 text-gray-500'
                    )}>
                        {isSolved ? (isControl ? `${pctScore}%` : `${score?.toFixed(0)} б`) : `${totalTasks} зад`}
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-gray-900 font-bold text-[15px] leading-snug mb-3 group-hover:text-gray-700 transition-colors line-clamp-2">
                    {variant.title}
                </h3>

                {/* Status block */}
                <div className="mt-auto">
                    {isMock && isSolved ? (
                        /* Mock solved */
                        isPublished ? (
                            <div className="flex items-center gap-3 mb-3">
                                <div className="bg-white/60 rounded-xl px-3 py-2 text-center">
                                    <div className="text-lg font-black text-violet-600 leading-none">{score?.toFixed(0)}</div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">балл</div>
                                </div>
                                <div className="bg-white/60 rounded-xl px-3 py-2 text-center">
                                    <div className="text-base font-bold text-gray-900 leading-none">{primaryScore}<span className="text-gray-300 font-normal text-sm">/29</span></div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">первичный</div>
                                </div>
                                <div className="flex items-center gap-1 text-violet-600 text-[10px] font-bold ml-auto">
                                    <Trophy size={11} />
                                    Проверено
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-violet-600 text-[10px] font-bold uppercase mb-3">
                                <Trophy size={12} />
                                Ответы записаны
                            </div>
                        )
                    ) : isSolved ? (
                        /* Regular solved */
                        <div className="mb-3">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="flex-1 bg-white/50 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#3F8C62] rounded-full" style={{ width: `${progressPercent}%` }} />
                                </div>
                                <div className={clsx("flex items-center gap-1 text-[10px] font-bold", isControl ? "text-blue-600" : "text-[#3F8C62]")}>
                                    <Trophy size={11} />
                                    {isControl ? `${pctScore}%` : `${score?.toFixed(0)} / 100`}
                                </div>
                            </div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                {isControl ? `${correctCount}/${totalTasks} заданий` : `Первичный: ${primaryScore}/29`}
                            </div>
                        </div>
                    ) : (
                        /* Not started / in progress */
                        <div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex-1 bg-white/50 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className={clsx('h-full rounded-full transition-all duration-500',
                                            progressPercent >= 80 ? 'bg-[#3F8C62]' : progressPercent > 0 ? 'bg-amber-400' : 'bg-gray-300'
                                        )}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <span className="text-gray-500 text-[11px] tabular-nums shrink-0">{answeredCount}/{totalTasks}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-lg text-[10px] font-bold text-gray-500 border border-white/40">
                                    <Clock size={11} className="text-gray-400" />
                                    {variant.time_limit_minutes || 235} мин
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                    {answeredCount > 0 ? 'В процессе' : 'Не начат'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Arrow */}
                <div className="flex justify-end mt-1">
                    <div className="w-7 h-7 rounded-full bg-white/60 border border-white/80 flex items-center justify-center transition-all duration-200 group-hover:bg-white/90 group-hover:translate-x-0.5">
                        <ChevronRight size={15} className={clsx(
                            'transition-colors',
                            isSolved ? 'text-amber-400' : 'text-gray-400 group-hover:text-[#3F8C62]'
                        )} />
                    </div>
                </div>
            </div>
        </button>
    );
}

// ── Section block ──────────────────────────────────────────────────────────────
function Section({ categoryKey, topics }: { categoryKey: CategoryKey; topics: TopicNav[] }) {
    if (topics.length === 0) return null;
    const cfg = CATEGORY_STYLE[categoryKey];
    const Icon = cfg.icon;
    const titles: Record<CategoryKey, { title: string; subtitle: string }> = {
        control:  { title: 'Контрольные работы', subtitle: 'Проверь знания по пройденным темам' },
        variants: { title: 'Варианты',           subtitle: 'Тренировка полного варианта ЕГЭ' },
        mock:     { title: 'Пробники',            subtitle: 'Результаты проверяются преподавателем' },
    };
    const { title, subtitle } = titles[categoryKey];

    return (
        <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.iconBg)}>
                    <Icon size={18} className={cfg.iconText} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-gray-900">{title}</h2>
                    <p className="text-xs text-gray-400">{subtitle}</p>
                </div>
            </div>
            <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {topics.map(variant => (
                    <ExamCard key={variant.id} variant={variant} categoryKey={categoryKey} />
                ))}
            </div>
        </div>
    );
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS: { key: CategoryKey; label: string }[] = [
    { key: 'control',  label: 'Контрольные' },
    { key: 'variants', label: 'Варианты' },
    { key: 'mock',     label: 'Пробники' },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ExamsListPage() {
    const { data: topics, isLoading } = useNavigation();
    const [activeTab, setActiveTab] = useState<CategoryKey>('control');

    const grouped = useMemo(() => {
        if (!topics) return { control: [], variants: [], mock: [] };
        return {
            control:  topics.filter(t => String(t.category) === 'control'),
            variants: topics.filter(t => String(t.category) === 'variants'),
            mock:     topics.filter(t => String(t.category) === 'mock'),
        };
    }, [topics]);

    const activeTopics = grouped[activeTab] ?? [];

    const unfinished = useMemo(() => ({
        control:  grouped.control.filter(t => t.latest_score == null).length,
        variants: grouped.variants.filter(t => t.latest_score == null).length,
        mock:     grouped.mock.filter(t => t.latest_score == null).length,
    }), [grouped]);

    if (isLoading && !topics) {
        return (
            <div className="p-4 md:p-8 space-y-6">
                <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
                <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            {/* Tabs */}
            <div className="flex gap-6 mb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const count = unfinished[tab.key];
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={clsx(
                                'flex items-center gap-1.5 pb-2.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 border-b-2 -mb-px',
                                isActive
                                    ? 'border-[#3F8C62] text-gray-900'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                            )}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className={clsx(
                                    'text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                                    isActive ? 'bg-[#3F8C62] text-white' : 'bg-gray-200 text-gray-500'
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {activeTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Inbox size={40} className="opacity-20 mb-3" />
                    <p className="font-semibold text-gray-500">В этой категории пока ничего нет</p>
                </div>
            ) : (
                <Section categoryKey={activeTab} topics={activeTopics} />
            )}
        </div>
    );
}
