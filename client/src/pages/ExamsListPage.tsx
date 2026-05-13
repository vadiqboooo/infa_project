import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookMarked,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    Clock,
    GraduationCap,
    Inbox,
    Lock,
    Trophy,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigation } from '../hooks/useApi';
import type { TopicNav } from '../api/types';

const CATEGORY_STYLE = {
    control: {
        background: 'linear-gradient(135deg, rgba(9,32,54,0.98) 0%, rgba(8,18,31,0.98) 58%, rgba(6,11,20,0.98) 100%)',
        border: 'border-sky-400/15',
        glow: 'rgba(56,189,248,0.18)',
        progress: 'from-sky-400 to-blue-500',
        iconBg: 'bg-sky-400/12',
        iconText: 'text-sky-200',
        badge: 'bg-sky-400/10 text-sky-100 ring-sky-300/20',
        label: 'КР',
        title: 'Контрольные работы',
        subtitle: 'Проверь знания по пройденным темам',
        icon: ClipboardCheck,
    },
    variants: {
        background: 'linear-gradient(135deg, rgba(8,47,36,0.98) 0%, rgba(7,19,30,0.98) 58%, rgba(6,11,20,0.98) 100%)',
        border: 'border-emerald-400/15',
        glow: 'rgba(16,185,129,0.18)',
        progress: 'from-emerald-400 to-green-500',
        iconBg: 'bg-emerald-400/12',
        iconText: 'text-emerald-200',
        badge: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/20',
        label: 'Вариант',
        title: 'Варианты',
        subtitle: 'Тренировка полного варианта ЕГЭ',
        icon: BookMarked,
    },
    mock: {
        background: 'linear-gradient(135deg, rgba(40,23,76,0.98) 0%, rgba(14,18,35,0.98) 58%, rgba(6,11,20,0.98) 100%)',
        border: 'border-violet-400/15',
        glow: 'rgba(139,92,246,0.2)',
        progress: 'from-violet-400 to-purple-500',
        iconBg: 'bg-violet-400/12',
        iconText: 'text-violet-200',
        badge: 'bg-violet-400/10 text-violet-100 ring-violet-300/20',
        label: 'Пробник',
        title: 'Пробники',
        subtitle: 'Результаты проверяются преподавателем',
        icon: GraduationCap,
    },
} as const;

type CategoryKey = keyof typeof CATEGORY_STYLE;

const TABS: { key: CategoryKey; label: string }[] = [
    { key: 'control', label: 'Контрольные' },
    { key: 'variants', label: 'Варианты' },
    { key: 'mock', label: 'Пробники' },
];

function ExamCard({ variant, categoryKey }: { variant: TopicNav; categoryKey: CategoryKey }) {
    const navigate = useNavigate();
    const style = CATEGORY_STYLE[categoryKey];
    const Icon = style.icon;
    const isLocked = !!variant.is_locked;

    const isMock = categoryKey === 'mock';
    const isControl = categoryKey === 'control';
    const isPublished = isMock && !!(variant as any).analysis_published;

    const totalTasks = variant.tasks.length;
    const draftCount = variant.draft_count ?? 0;
    const hasStarted = draftCount > 0;
    const isSolved = variant.latest_score != null;
    const hasCurrentScore = !isSolved && !isMock && hasStarted && variant.current_score != null;
    const showScore = isSolved || hasCurrentScore;
    const solvedCount = variant.tasks.filter(t => t.status === 'solved').length;
    const answeredCount = isSolved ? solvedCount : draftCount;
    const progressPercent = totalTasks > 0 ? Math.min(100, Math.round(answeredCount / totalTasks * 100)) : 0;

    const score = isSolved ? variant.latest_score : variant.current_score;
    const primaryScore = isSolved ? variant.latest_primary_score : variant.current_primary_score;
    const correctCount = primaryScore ?? 0;
    const pctScore = totalTasks > 0 ? Math.round((correctCount / totalTasks) * 100) : 0;
    const visibleScore = isControl ? `${pctScore}%` : `${score?.toFixed(0) ?? 0}`;
    const showLargeScore = showScore && (!isMock || isPublished);

    return (
        <button
            disabled={isLocked}
            onClick={() => {
                if (!isLocked) navigate(`/exams/${variant.id}`);
            }}
            className={clsx(
                'group relative min-h-[194px] w-full overflow-hidden rounded-[18px] border p-5 text-left',
                'shadow-[0_18px_48px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.03]',
                'transition duration-300',
                isLocked
                    ? 'cursor-not-allowed opacity-70'
                    : 'hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_22px_60px_rgba(0,0,0,0.34)]',
                style.border,
            )}
            style={{ background: style.background }}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-3xl"
                style={{ background: style.glow }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                    background:
                        'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.24) 0 1px, transparent 2px), radial-gradient(circle at 46% 10%, rgba(255,255,255,0.13) 0 1px, transparent 2px), radial-gradient(circle at 83% 30%, rgba(255,255,255,0.12) 0 1px, transparent 2px), radial-gradient(circle at 72% 78%, rgba(255,255,255,0.10) 0 1px, transparent 2px)',
                }}
            />

            {showLargeScore && (
                <div className="pointer-events-none absolute bottom-1 right-4 z-0 select-none text-[82px] font-black leading-none tracking-normal text-white/[0.08] transition-transform duration-700 group-hover:scale-105">
                    {visibleScore}
                </div>
            )}

            <div className="relative z-10 flex min-h-[154px] flex-col">
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1', style.iconBg, style.badge)}>
                        {isLocked
                            ? <Lock size={17} className="text-slate-300" />
                            : isSolved
                            ? <CheckCircle2 size={17} className="text-amber-200" />
                            : <Icon size={17} className={style.iconText} />}
                    </div>

                    <span className={clsx('rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ring-1', style.badge)}>
                        {isLocked ? 'Подписка' : style.label}
                    </span>

                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-slate-300 ring-1 ring-white/10">
                        {showScore ? (isControl ? `${pctScore}%` : `${score?.toFixed(0)} б`) : `${totalTasks} зад`}
                    </span>
                </div>

                <h3 className="line-clamp-2 pr-8 text-[15px] font-black leading-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                    {variant.title}
                </h3>

                <div className="mt-auto">
                    {isMock && isSolved && !isPublished ? (
                        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-400/10 px-3 py-1.5 text-[11px] font-bold text-violet-100 ring-1 ring-violet-300/15">
                            <Trophy size={12} />
                            Ответы записаны
                        </div>
                    ) : (
                        <div className="mb-4">
                            <div className="mb-2 flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-500', style.progress)}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-400">
                                    {progressPercent}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-[12px] font-semibold tabular-nums text-slate-400">
                                    {answeredCount}/{totalTasks} выполнено
                                </span>
                                {showLargeScore && (
                                    <span className={clsx('inline-flex items-center gap-1 text-[11px] font-bold', style.iconText)}>
                                        <Trophy size={12} />
                                        {isControl ? `${correctCount}/${totalTasks}` : `${primaryScore ?? 0}/29`}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 ring-1 ring-white/10">
                            <Clock size={12} />
                            {variant.time_limit_minutes || 235} мин
                        </span>
                        <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition group-hover:bg-white/[0.10]', style.badge)}>
                            Перейти
                            <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function Section({ categoryKey, topics }: { categoryKey: CategoryKey; topics: TopicNav[] }) {
    if (topics.length === 0) return null;
    const cfg = CATEGORY_STYLE[categoryKey];
    const Icon = cfg.icon;

    return (
        <div className="mb-10">
            <div className="mb-5 flex items-center gap-3">
                <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', cfg.iconBg, cfg.badge)}>
                    <Icon size={18} className={cfg.iconText} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-white">{cfg.title}</h2>
                    <p className="text-xs text-slate-500">{cfg.subtitle}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
                {topics.map(variant => (
                    <ExamCard key={variant.id} variant={variant} categoryKey={categoryKey} />
                ))}
            </div>
        </div>
    );
}

export default function ExamsListPage() {
    const { data: topics, isLoading } = useNavigation();
    const [activeTab, setActiveTab] = useState<CategoryKey>('control');

    const grouped = useMemo(() => {
        if (!topics) return { control: [], variants: [], mock: [] };
        return {
            control: topics.filter(t => String(t.category) === 'control'),
            variants: topics.filter(t => String(t.category) === 'variants'),
            mock: topics.filter(t => String(t.category) === 'mock'),
        };
    }, [topics]);

    const activeTopics = grouped[activeTab] ?? [];

    const unfinished = useMemo(() => ({
        control: grouped.control.filter(t => t.latest_score == null).length,
        variants: grouped.variants.filter(t => t.latest_score == null).length,
        mock: grouped.mock.filter(t => t.latest_score == null).length,
    }), [grouped]);

    if (isLoading && !topics) {
        return (
            <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
                <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-[194px] animate-pulse rounded-[18px] border border-white/10 bg-white/[0.04]" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px] p-4 animate-in fade-in duration-500 md:p-8">
            <div className="mb-6 flex gap-6 overflow-x-auto border-b border-white/10 scrollbar-hide">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const count = unfinished[tab.key];
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={clsx(
                                'flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 text-sm font-semibold transition-all duration-200 -mb-px',
                                isActive
                                    ? 'border-[#21B66F] text-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-300',
                            )}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className={clsx(
                                    'min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold',
                                    isActive ? 'bg-[#21B66F] text-[#03100B]' : 'bg-white/10 text-slate-300',
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {activeTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] py-20 text-slate-400">
                    <Inbox size={40} className="mb-3 opacity-30" />
                    <p className="font-semibold text-slate-300">В этой категории пока ничего нет</p>
                </div>
            ) : (
                <Section categoryKey={activeTab} topics={activeTopics} />
            )}
        </div>
    );
}
