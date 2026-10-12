import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Hourglass, Inbox, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigation } from '../hooks/useApi';
import type { TopicNav } from '../api/types';
import { useTheme } from '../context/ThemeContext';

type ExamType = 'ege' | 'oge';
type SubjectTone = 'emerald' | 'sky' | 'amber' | 'rose';
type SubjectMeta = { id: string; name: string; glyph: string; tone: SubjectTone };

const SUBJECTS: SubjectMeta[] = [
    { id: 'informatics', name: 'Информатика', glyph: '</>', tone: 'emerald' },
    { id: 'math', name: 'Математика', glyph: '∑', tone: 'sky' },
    { id: 'physics', name: 'Физика', glyph: 'φ', tone: 'amber' },
    { id: 'russian', name: 'Русский язык', glyph: 'Аа', tone: 'rose' },
];

const SUBJECT_TONES = {
    emerald: {
        dark: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
        light: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
    },
    sky: {
        dark: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
        light: 'border-sky-500/25 bg-sky-500/10 text-sky-700',
    },
    amber: {
        dark: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
        light: 'border-amber-500/25 bg-amber-500/10 text-amber-700',
    },
    rose: {
        dark: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
        light: 'border-rose-500/25 bg-rose-500/10 text-rose-700',
    },
} as const;

function getSubjectId(topic: TopicNav): string {
    if (String(topic.category) === 'math') return 'math';
    return topic.subject || 'informatics';
}

function getSubjectMeta(subjectId: string): SubjectMeta {
    return SUBJECTS.find(subject => subject.id === subjectId) ?? {
        id: subjectId,
        name: subjectId,
        glyph: subjectId.slice(0, 2).toUpperCase(),
        tone: 'emerald',
    };
}

function getExamType(topic: TopicNav): ExamType {
    return topic.exam_type === 'oge' ? 'oge' : 'ege';
}

function examTypeLabel(examType: ExamType): string {
    return examType === 'oge' ? 'ОГЭ' : 'ЕГЭ';
}

function pluralTasks(count: number): string {
    const last = count % 10;
    const lastTwo = count % 100;
    if (last === 1 && lastTwo !== 11) return `${count} задание`;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} задания`;
    return `${count} заданий`;
}

function isPendingReview(topic: TopicNav): boolean {
    return String(topic.category) === 'mock' && topic.latest_score != null && !topic.analysis_published;
}

function isFinished(topic: TopicNav): boolean {
    return topic.latest_score != null && !isPendingReview(topic);
}

function isTraining(topic: TopicNav): boolean {
    return ['variants', 'math'].includes(String(topic.category));
}

function formatDuration(minutes?: number): string {
    const value = minutes || 235;
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    if (!hours) return `${rest} мин`;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function surfaceClasses(isLight: boolean): string {
    return isLight
        ? 'border-[rgba(57,79,66,0.14)] bg-white shadow-[0_12px_32px_rgba(22,52,35,0.07)]'
        : 'border-white/10 bg-[#202020] shadow-[0_12px_32px_rgba(0,0,0,0.25)]';
}

function SubjectCard({
    subjectId,
    examType,
    topics,
    isLight,
    onOpen,
}: {
    subjectId: string;
    examType: ExamType;
    topics: TopicNav[];
    isLight: boolean;
    onOpen: () => void;
}) {
    const meta = getSubjectMeta(subjectId);
    const tone = SUBJECT_TONES[meta.tone];
    const pending = topics.filter(isPendingReview).length;
    const completed = topics.filter(isFinished).length;
    const assigned = topics.length - pending - completed;
    const progress = topics.length ? Math.round((completed / topics.length) * 100) : 0;
    const typicalTaskCount = Math.max(0, ...topics.map(topic => topic.tasks.length));

    return (
        <button
            type="button"
            onClick={onOpen}
            className={clsx(
                'group flex min-h-[220px] flex-col gap-[18px] rounded-[22px] border p-[22px] text-left transition duration-200 hover:-translate-y-0.5',
                surfaceClasses(isLight),
                isLight ? 'hover:border-emerald-500/25' : 'hover:border-white/20',
            )}
        >
            <span className="flex items-center gap-3.5">
                <span className={clsx(
                    'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-black',
                    isLight ? tone.light : tone.dark,
                )}>
                    {meta.glyph}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={clsx('block text-xl font-bold', isLight ? 'text-[#13231B]' : 'text-slate-50')}>{meta.name}</span>
                    <span className={clsx('mt-0.5 block text-[13px]', isLight ? 'text-[#607064]' : 'text-slate-400')}>
                        {examTypeLabel(examType)} · {pluralTasks(typicalTaskCount)}
                    </span>
                </span>
                <ChevronRight size={19} className={clsx('transition group-hover:translate-x-0.5', isLight ? 'text-[#607064]' : 'text-slate-500')} />
            </span>

            <span className="flex min-h-7 flex-wrap gap-2">
                {assigned > 0 && (
                    <span className={clsx(
                        'rounded-full border px-3 py-1 text-[13px] font-bold',
                        isLight
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
                            : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
                    )}>
                        Назначено: {assigned}
                    </span>
                )}
                {pending > 0 && (
                    <span className={clsx(
                        'rounded-full border px-3 py-1 text-[13px] font-bold',
                        isLight
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-700'
                            : 'border-amber-300/25 bg-amber-400/10 text-amber-200',
                    )}>
                        На проверке: {pending}
                    </span>
                )}
                {assigned === 0 && pending === 0 && (
                    <span className={clsx(
                        'rounded-full border px-3 py-1 text-[13px] font-semibold',
                        isLight ? 'border-[#394F4224] bg-[#23473112] text-[#607064]' : 'border-white/10 bg-white/[0.06] text-slate-400',
                    )}>
                        Нет назначенных
                    </span>
                )}
            </span>

            <span className="mt-auto block">
                <span className={clsx('block h-1.5 overflow-hidden rounded-full', isLight ? 'bg-[#E2E8E4]' : 'bg-white/[0.08]')}>
                    <span className="block h-full rounded-full bg-[#00AD50]" style={{ width: `${progress}%` }} />
                </span>
                <span className={clsx('mt-1.5 block text-xs', isLight ? 'text-[#607064]' : 'text-slate-400')}>
                    Пройдено {completed} из {topics.length}
                </span>
            </span>
        </button>
    );
}

function VariantCard({ topic, isLight }: { topic: TopicNav; isLight: boolean }) {
    const navigate = useNavigate();
    const locked = !!topic.is_locked;
    const training = isTraining(topic);
    const control = String(topic.category) === 'control';
    const mock = String(topic.category) === 'mock';
    const pending = isPendingReview(topic);
    const finished = isFinished(topic);
    const activeMode = topic.active_exam_mode ?? null;
    const hasActive = topic.has_active_attempt ?? false;
    const answered = topic.draft_count ?? 0;
    const total = topic.tasks.length;
    const progress = finished
        ? Math.min(100, Math.round(((topic.latest_primary_score ?? 0) / Math.max(1, topic.max_score ?? total)) * 100))
        : Math.min(100, Math.round((answered / Math.max(1, total)) * 100));

    const kind = control ? 'Контрольная' : mock ? 'Пробный' : 'Тренировочный';
    const mode = training && activeMode === 'practice'
        ? 'Тренировка'
        : training && activeMode === 'exam'
            ? 'Пробник'
            : null;
    const rule = control
        ? `${formatDuration(topic.time_limit_minutes)} · результат после завершения`
        : mock
            ? `${formatDuration(topic.time_limit_minutes)} · результат после проверки преподавателем`
            : activeMode === 'practice'
                ? 'Без времени · проверка сразу'
                : activeMode === 'exam'
                    ? `${formatDuration(topic.time_limit_minutes)} · ответы после завершения`
                    : 'Режим выбирается при запуске: тренировка или пробник';
    const action = locked
        ? 'Недоступно'
        : pending
            ? 'Результат на проверке'
            : finished
                ? 'Посмотреть результат'
                : hasActive && activeMode
                    ? 'Продолжить'
                    : training
                        ? 'Выбрать режим и начать'
                        : 'Начать';

    return (
        <article className={clsx('flex min-h-[260px] flex-col gap-3 rounded-[18px] border p-[18px]', surfaceClasses(isLight))}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                    <span className={clsx(
                        'rounded-full border px-2.5 py-1 text-xs font-bold',
                        mock
                            ? isLight ? 'border-amber-500/25 bg-amber-500/10 text-amber-700' : 'border-amber-300/25 bg-amber-400/10 text-amber-200'
                            : isLight ? 'border-[#394F4224] bg-[#23473112] text-[#2D3E34]' : 'border-white/10 bg-white/[0.06] text-slate-200',
                    )}>
                        {kind}
                    </span>
                    {mode && (
                        <span className={clsx(
                            'rounded-full border px-2.5 py-1 text-xs font-bold',
                            activeMode === 'exam'
                                ? isLight ? 'border-sky-500/25 bg-sky-500/10 text-sky-700' : 'border-sky-300/20 bg-sky-400/10 text-sky-200'
                                : isLight ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700' : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
                        )}>
                            {mode}
                        </span>
                    )}
                </div>
                <span className={clsx('shrink-0 text-xs', pending ? 'text-amber-400' : isLight ? 'text-[#607064]' : 'text-slate-400')}>
                    {pending ? 'на проверке' : finished ? 'завершён' : hasActive ? 'в процессе' : 'без срока'}
                </span>
            </div>

            <div>
                <h3 className={clsx('line-clamp-2 text-lg font-bold', isLight ? 'text-[#13231B]' : 'text-slate-50')}>{topic.title}</h3>
                <p className={clsx('mt-0.5 text-sm', isLight ? 'text-[#607064]' : 'text-slate-400')}>Полный вариант · {pluralTasks(total)}</p>
            </div>

            <p className={clsx('text-[13px] leading-5', isLight ? 'text-[#607064]' : 'text-slate-400')}>{rule}</p>

            {pending && (
                <div className={clsx(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold',
                    isLight
                        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700'
                        : 'border-amber-300/25 bg-amber-400/10 text-amber-200',
                )}>
                    <Hourglass size={16} />
                    Результат на проверке
                </div>
            )}

            {(hasActive || finished) && !pending && (
                <div>
                    <div className={clsx('h-1.5 overflow-hidden rounded-full', isLight ? 'bg-[#E2E8E4]' : 'bg-white/[0.08]')}>
                        <div className="h-full rounded-full bg-[#00AD50]" style={{ width: `${progress}%` }} />
                    </div>
                    <p className={clsx('mt-1.5 text-xs', isLight ? 'text-[#607064]' : 'text-slate-400')}>
                        {finished
                            ? `Первичный балл ${topic.latest_primary_score ?? 0} из ${topic.max_score ?? total}`
                            : `Отвечено ${answered} из ${total}`}
                    </p>
                </div>
            )}

            <button
                type="button"
                disabled={locked || pending}
                onClick={() => navigate(`/exams/${topic.id}`)}
                className={clsx(
                    'mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
                    locked
                        ? 'cursor-not-allowed border-white/10 bg-white/[0.04] text-slate-500'
                        : pending
                            ? isLight
                                ? 'cursor-default border-amber-500/25 bg-amber-500/10 text-amber-700'
                                : 'cursor-default border-amber-300/25 bg-amber-400/10 text-amber-200'
                            : finished
                                ? isLight
                                    ? 'border-[#394F4224] bg-transparent text-[#2D3E34] hover:bg-[#23473112]'
                                    : 'border-white/10 bg-transparent text-slate-200 hover:bg-white/[0.06]'
                                : 'border-[#00AD50] bg-[#00AD50] text-white hover:bg-[#009f49]',
                )}
            >
                {locked && <Lock size={15} />}
                {action}
            </button>
        </article>
    );
}

function LoadingState({ isLight }: { isLight: boolean }) {
    return (
        <div className="mx-auto max-w-[1600px] p-4 md:p-8 lg:px-10">
            <div className={clsx('mb-3 h-9 w-40 animate-pulse rounded-lg', isLight ? 'bg-black/[0.06]' : 'bg-white/[0.06]')} />
            <div className={clsx('mb-8 h-5 w-80 animate-pulse rounded', isLight ? 'bg-black/[0.05]' : 'bg-white/[0.05]')} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {[1, 2, 3, 4].map(item => (
                    <div key={item} className={clsx('h-[220px] animate-pulse rounded-[22px] border', surfaceClasses(isLight))} />
                ))}
            </div>
        </div>
    );
}

export default function ExamsListPage() {
    const { data: navigation, isLoading } = useNavigation();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [searchParams, setSearchParams] = useSearchParams();
    const selection = useMemo(() => {
        const subjectId = searchParams.get('subject');
        const exam = searchParams.get('exam');
        if (!subjectId || (exam !== 'ege' && exam !== 'oge')) return null;
        return { subjectId, examType: exam as ExamType };
    }, [searchParams]);
    const setSelection = (next: { subjectId: string; examType: ExamType } | null) => {
        const params = new URLSearchParams(searchParams);
        if (next) {
            params.set('subject', next.subjectId);
            params.set('exam', next.examType);
        } else {
            params.delete('subject');
            params.delete('exam');
        }
        setSearchParams(params);
    };

    const examTopics = useMemo(
        () => (navigation ?? []).filter(topic => ['control', 'variants', 'math', 'mock'].includes(String(topic.category))),
        [navigation],
    );

    const subjectGroups = useMemo(() => {
        const groups = new Map<string, TopicNav[]>();
        examTopics.forEach(topic => {
            const key = `${getExamType(topic)}:${getSubjectId(topic)}`;
            const current = groups.get(key) ?? [];
            current.push(topic);
            groups.set(key, current);
        });
        return groups;
    }, [examTopics]);

    const examSections = useMemo(() => (['ege', 'oge'] as ExamType[]).map(examType => ({
        examType,
        label: examTypeLabel(examType),
        grade: examType === 'ege' ? '11 класс' : '9 класс',
        subjects: Array.from(subjectGroups.entries())
            .filter(([key]) => key.startsWith(`${examType}:`))
            .map(([key, topics]) => ({ subjectId: key.split(':')[1], topics }))
            .sort((a, b) => {
                const orderA = SUBJECTS.findIndex(subject => subject.id === a.subjectId);
                const orderB = SUBJECTS.findIndex(subject => subject.id === b.subjectId);
                return (orderA < 0 ? 99 : orderA) - (orderB < 0 ? 99 : orderB);
            }),
    })).filter(section => section.subjects.length > 0), [subjectGroups]);

    const selectedTopics = selection
        ? subjectGroups.get(`${selection.examType}:${selection.subjectId}`) ?? []
        : [];
    const selectedMeta = selection ? getSubjectMeta(selection.subjectId) : null;
    const subjectSwitcher = selection
        ? examSections.find(section => section.examType === selection.examType)?.subjects ?? []
        : [];

    const groups = selection ? [
        { title: 'Назначено', topics: selectedTopics.filter(topic => !isPendingReview(topic) && !isFinished(topic)) },
        { title: 'На проверке', topics: selectedTopics.filter(isPendingReview) },
        { title: 'Пройденные', topics: selectedTopics.filter(isFinished) },
    ].filter(group => group.topics.length > 0) : [];

    if (isLoading && !navigation) return <LoadingState isLight={isLight} />;

    return (
        <div className="exams-list-page mx-auto flex max-w-[1600px] flex-col gap-[22px] p-4 animate-in fade-in duration-300 md:p-8 lg:px-10">
            {!selection ? (
                <>
                    <header className="flex flex-col gap-1.5">
                        <h1 className={clsx('text-3xl font-bold tracking-[-0.01em]', isLight ? 'text-[#13231B]' : 'text-slate-50')}>Варианты</h1>
                        <p className={clsx('text-[15px]', isLight ? 'text-[#607064]' : 'text-slate-400')}>
                            Сначала ЕГЭ, ниже ОГЭ — выберите предмет
                        </p>
                    </header>

                    {examSections.length === 0 ? (
                        <div className={clsx('flex flex-col items-center justify-center rounded-[22px] border border-dashed py-20', isLight ? 'border-[#394F4224] text-[#607064]' : 'border-white/10 text-slate-400')}>
                            <Inbox size={40} className="mb-3 opacity-40" />
                            <p className="font-semibold">Вариантов пока нет</p>
                        </div>
                    ) : examSections.map(section => (
                        <section key={section.examType} className="flex flex-col gap-3.5">
                            <div className="flex items-baseline gap-3">
                                <h2 className={clsx('text-[22px] font-bold', isLight ? 'text-[#13231B]' : 'text-slate-50')}>{section.label}</h2>
                                <span className={clsx('text-sm', isLight ? 'text-[#607064]' : 'text-slate-400')}>{section.grade}</span>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {section.subjects.map(subject => (
                                    <SubjectCard
                                        key={`${section.examType}:${subject.subjectId}`}
                                        subjectId={subject.subjectId}
                                        examType={section.examType}
                                        topics={subject.topics}
                                        isLight={isLight}
                                        onOpen={() => setSelection({ subjectId: subject.subjectId, examType: section.examType })}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            ) : (
                <>
                    <header className="flex flex-col gap-3.5">
                        <button
                            type="button"
                            onClick={() => setSelection(null)}
                            className={clsx(
                                'flex min-h-9 w-fit items-center gap-1 rounded-full border px-3.5 pl-2 text-sm font-semibold transition',
                                isLight
                                    ? 'border-[#394F4224] text-[#607064] hover:bg-[#23473112]'
                                    : 'border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200',
                            )}
                        >
                            <ArrowLeft size={18} />
                            {examTypeLabel(selection.examType)} · все предметы
                        </button>

                        <div className="flex gap-2 overflow-x-auto py-0.5 scrollbar-hide">
                            {subjectSwitcher.map(subject => {
                                const meta = getSubjectMeta(subject.subjectId);
                                const active = subject.subjectId === selection.subjectId;
                                const tone = SUBJECT_TONES[meta.tone];
                                return (
                                    <button
                                        key={subject.subjectId}
                                        type="button"
                                        onClick={() => setSelection({ ...selection, subjectId: subject.subjectId })}
                                        className={clsx(
                                            'flex min-h-10 shrink-0 items-center gap-2 rounded-full border py-1 pl-2 pr-4 text-sm font-bold transition',
                                            active
                                                ? isLight
                                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                                                    : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
                                                : isLight
                                                    ? 'border-[#394F4224] text-[#2D3E34] hover:bg-[#23473112]'
                                                    : 'border-white/10 text-slate-200 hover:bg-white/[0.06]',
                                        )}
                                    >
                                        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-black', isLight ? tone.light : tone.dark)}>
                                            {meta.glyph}
                                        </span>
                                        {meta.name}
                                    </button>
                                );
                            })}
                        </div>

                        <div>
                            <h1 className={clsx('text-3xl font-bold tracking-[-0.01em]', isLight ? 'text-[#13231B]' : 'text-slate-50')}>{selectedMeta?.name}</h1>
                            <p className={clsx('mt-1 text-sm', isLight ? 'text-[#607064]' : 'text-slate-400')}>
                                {examTypeLabel(selection.examType)} · {pluralTasks(Math.max(0, ...selectedTopics.map(topic => topic.tasks.length)))} · {formatDuration(Math.max(0, ...selectedTopics.map(topic => topic.time_limit_minutes ?? 0)) || undefined)}
                            </p>
                        </div>
                    </header>

                    {groups.length === 0 ? (
                        <div className={clsx('rounded-[22px] border border-dashed py-14 text-center', isLight ? 'border-[#394F4224] text-[#607064]' : 'border-white/10 text-slate-400')}>
                            По этому предмету пока нет вариантов
                        </div>
                    ) : groups.map(group => (
                        <section key={group.title} className="flex flex-col gap-3">
                            <h2 className={clsx('text-base font-semibold', isLight ? 'text-[#13231B]' : 'text-slate-50')}>
                                {group.title} <span className={clsx('font-normal', isLight ? 'text-[#607064]' : 'text-slate-400')}>{group.topics.length}</span>
                            </h2>
                            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                {group.topics.map(topic => <VariantCard key={topic.id} topic={topic} isLight={isLight} />)}
                            </div>
                        </section>
                    ))}
                </>
            )}
        </div>
    );
}
