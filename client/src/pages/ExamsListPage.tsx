import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, Trophy, ChevronRight, Inbox, ClipboardCheck, BookMarked, GraduationCap } from 'lucide-react';
import { useNavigation } from '../hooks/useApi';
import { cn } from '@/lib/utils';
import type { TopicNav } from '../api/types';

const SECTION_CONFIG = [
    {
        key: 'control',
        title: 'Контрольные работы',
        subtitle: 'Проверь знания по пройденным темам',
        icon: ClipboardCheck,
        color: 'bg-blue-100 text-blue-600',
        badge: 'КР',
        badgeClass: 'bg-blue-100 text-blue-700',
    },
    {
        key: 'variants',
        title: 'Варианты',
        subtitle: 'Тренировка полного варианта ЕГЭ',
        icon: BookMarked,
        color: 'bg-emerald-100 text-emerald-600',
        badge: 'Вариант',
        badgeClass: 'bg-emerald-100 text-emerald-700',
    },
    {
        key: 'mock',
        title: 'Пробники',
        subtitle: 'Результаты проверяются преподавателем',
        icon: GraduationCap,
        color: 'bg-violet-100 text-violet-600',
        badge: 'Пробник',
        badgeClass: 'bg-violet-100 text-violet-700',
    },
] as const;

function ExamCard({ variant, badge, badgeClass }: { variant: TopicNav; badge: string; badgeClass: string }) {
    const navigate = useNavigate();
    const isSolved = variant.latest_score !== undefined && variant.latest_score !== null;
    const isMock = String(variant.category) === 'mock';
    const solvedTasksCount = variant.tasks.filter(t => t.status === 'solved').length;
    const totalTasksCount = variant.tasks.length;

    const currentPoints = variant.tasks.reduce((sum, task) => {
        if (task.status === 'solved') {
            const num = task.ege_number || 0;
            return sum + (num >= 26 ? 2 : 1);
        }
        return sum;
    }, 0);

    const maxPoints = variant.tasks.reduce((sum, task) => {
        const num = task.ege_number || 0;
        return sum + (num >= 26 ? 2 : 1);
    }, 0) || 29;

    const progressPercent = Math.min(100, Math.round((currentPoints / maxPoints) * 100));

    return (
        <button
            onClick={() => navigate(`/exams/${variant.id}`)}
            className="group bg-white border border-gray-200 rounded-2xl p-6 text-left hover:border-[#3F8C62]/40 hover:shadow-xl hover:shadow-gray-200/40 transition-all hover:-translate-y-1 relative overflow-hidden flex flex-col w-full max-w-[400px] h-full min-h-[200px]"
        >
            {/* Large Score for non-mock solved */}
            {isSolved && !isMock && (
                <div className="absolute right-4 bottom-2 select-none pointer-events-none z-0 transition-transform group-hover:scale-105 duration-700">
                    <span className="text-[120px] font-black text-[#3F8C62] leading-none tracking-tighter">
                        {variant.latest_score?.toFixed(0)}
                    </span>
                </div>
            )}

            {/* Top row */}
            <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                        isSolved
                            ? 'bg-[#3F8C62] text-white shadow-lg shadow-[#3F8C62]/20'
                            : 'bg-gray-100 text-gray-400 group-hover:bg-[#3F8C62]/10 group-hover:text-[#3F8C62]'
                    )}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <div className={cn('inline-block text-[10px] font-bold uppercase tracking-widest mb-0.5 px-2 py-0.5 rounded-md', badgeClass)}>
                            {badge}
                        </div>
                        <div className="font-bold text-gray-900 group-hover:text-[#3F8C62] transition-colors">
                            {variant.title}
                        </div>
                    </div>
                </div>
                <ChevronRight size={20} className="text-gray-300 group-hover:text-[#3F8C62] transition-all group-hover:translate-x-1" />
            </div>

            {/* Footer */}
            <div className="relative z-10 mt-auto w-full">
                {!isSolved && (
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mb-4">
                        <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                            <Clock size={14} className="text-gray-300" />
                            {variant.time_limit_minutes || 235} мин
                        </span>
                        <span className="bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">{totalTasksCount} задач</span>
                    </div>
                )}

                {isMock && isSolved ? (
                    <div className="flex items-center gap-1.5 text-violet-600 text-[10px] font-bold uppercase pt-1">
                        <Trophy size={12} />
                        Ответы записаны
                    </div>
                ) : (
                    <div className="space-y-2 w-full relative z-20">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                            <span className="text-gray-400">Прогресс</span>
                        </div>
                        <div className="relative flex items-center h-6">
                            <div className="w-full bg-gray-100/60 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full rounded-full bg-[#3F8C62] transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-sm font-black text-gray-900 bg-white/60 backdrop-blur-md px-2 rounded-md shadow-sm">
                                    {currentPoints} / {maxPoints}
                                </span>
                            </div>
                        </div>
                        {isSolved ? (
                            <div className="flex items-center gap-1.5 text-[#3F8C62] text-[10px] font-bold uppercase pt-1">
                                <Trophy size={12} />
                                Завершено
                            </div>
                        ) : (
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] font-bold text-gray-300 uppercase">
                                    {solvedTasksCount > 0 ? "В процессе" : "Не начат"}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-[#3F8C62] font-bold">
                                    {solvedTasksCount > 0 ? "Продолжить" : "Начать"}
                                    <ChevronRight size={14} />
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </button>
    );
}

function Section({ sectionKey, title, subtitle, icon: Icon, color, badge, badgeClass, topics }: typeof SECTION_CONFIG[number] & { topics: TopicNav[] }) {
    if (topics.length === 0) return null;

    return (
        <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color)}>
                    <Icon size={18} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-gray-900">{title}</h2>
                    <p className="text-xs text-gray-400">{subtitle}</p>
                </div>
            </div>
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),380px))] justify-start">
                {topics.map(variant => (
                    <ExamCard key={variant.id} variant={variant} badge={badge} badgeClass={badgeClass} />
                ))}
            </div>
        </div>
    );
}

export default function ExamsListPage() {
    const { data: topics, isLoading } = useNavigation();

    const grouped = useMemo(() => {
        if (!topics) return { control: [], variants: [], mock: [] };
        return {
            control: topics.filter(t => String(t.category) === 'control'),
            variants: topics.filter(t => String(t.category) === 'variants'),
            mock: topics.filter(t => String(t.category) === 'mock'),
        };
    }, [topics]);

    const totalCount = grouped.control.length + grouped.variants.length + grouped.mock.length;

    if (isLoading && !topics) {
        return (
            <div className="p-8 space-y-6">
                <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
                <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),380px))]">
                    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Варианты ЕГЭ</h1>
                <p className="text-gray-500 text-sm">Контрольные работы, варианты и пробники</p>
            </div>

            {totalCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Inbox size={32} className="opacity-20" />
                    </div>
                    <p className="font-bold text-lg text-gray-900">Вариантов пока нет</p>
                    <p className="text-sm">Администратор ещё не добавил контрольные варианты</p>
                </div>
            ) : (
                <>
                    {SECTION_CONFIG.map(cfg => (
                        <Section key={cfg.key} {...cfg} topics={grouped[cfg.key]} />
                    ))}
                </>
            )}
        </div>
    );
}
