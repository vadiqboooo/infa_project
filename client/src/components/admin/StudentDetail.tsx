import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Circle, BarChart2, FileText, Paperclip } from "lucide-react";
import { clsx } from "clsx";
import type { StudentDetailOut, StudentTaskResult, StudentTopicDetail } from "../../api/types";
import { AnalysisModal } from "./AnalysisModal";
import { StudentTaskSolutionReviewModal } from "./StudentTaskSolutionReviewModal";

interface Props {
    student: StudentDetailOut;
    onBack: () => void;
    onViewTopicStats: (topicId: number) => void;
    apiKey?: string;
    initialReviewTaskId?: number;
}

type Tab = "tutorial" | "homework" | "control" | "variants" | "mock";

const TAB_OPTIONS: { key: Tab; label: string }[] = [
    { key: "tutorial", label: "Разбор" },
    { key: "homework", label: "Домашка" },
    { key: "control", label: "КР" },
    { key: "variants", label: "Варианты" },
    { key: "mock", label: "Пробники" },
];

function StatusIcon({ status }: { status: string }) {
    if (status === "solved") return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
    if (status === "failed") return <XCircle size={16} className="text-red-400 shrink-0" />;
    return <Circle size={16} className="text-gray-300 shrink-0" />;
}

function WeeklyStatsBlock({ student }: { student: StudentDetailOut }) {
    const stats = student.weekly_stats ?? { total: 0, correct: 0, incorrect: 0, ege_numbers: [] };
    const accuracy = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
    const goodNumbers = stats.ege_numbers.filter(n => n.total > 0 && n.accuracy >= 70);
    const weakNumbers = stats.ege_numbers.filter(n => n.total > 0 && n.accuracy < 70);

    return (
        <div className="px-6 pt-4 shrink-0">
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <div className="text-sm font-bold text-gray-900">Статистика за 7 дней</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">По задачам, которые ученик решал на этой неделе</div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-black text-[#3F8C62] leading-none">{accuracy}%</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">точность</div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <div className="text-lg font-black text-gray-900">{stats.total}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">всего</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2">
                        <div className="text-lg font-black text-emerald-700">{stats.correct}</div>
                        <div className="text-[10px] text-emerald-600 font-bold uppercase">правильно</div>
                    </div>
                    <div className="rounded-xl bg-red-50 px-3 py-2">
                        <div className="text-lg font-black text-red-500">{stats.incorrect}</div>
                        <div className="text-[10px] text-red-400 font-bold uppercase">ошибки</div>
                    </div>
                </div>

                {stats.ege_numbers.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <NumberGroup title="Хорошо получается" items={goodNumbers} tone="good" />
                        <NumberGroup title="Нужно подтянуть" items={weakNumbers} tone="weak" />
                    </div>
                ) : (
                    <div className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                        За последние 7 дней нет решенных задач.
                    </div>
                )}
            </div>
        </div>
    );
}

function NumberGroup({
    title,
    items,
    tone,
}: {
    title: string;
    items: StudentDetailOut["weekly_stats"]["ege_numbers"];
    tone: "good" | "weak";
}) {
    return (
        <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
            {items.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {items.map(item => (
                        <div
                            key={item.ege_number ?? "unknown"}
                            className={clsx(
                                "rounded-xl border px-3 py-2 min-w-[82px]",
                                tone === "good" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                            )}
                        >
                            <div className={clsx(
                                "text-sm font-black",
                                tone === "good" ? "text-emerald-700" : "text-red-500"
                            )}>
                                №{item.ege_number ?? "?"}
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold">
                                {item.correct}/{item.total} · {item.accuracy}%
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">Нет данных</div>
            )}
        </div>
    );
}

function TopicBlock({ topic, onViewStats, onAnalyze, onReviewSolution }: {
    topic: StudentTopicDetail;
    onViewStats: () => void;
    onAnalyze?: () => void;
    onReviewSolution?: (task: StudentTaskResult) => void;
}) {
    const solved = topic.tasks.filter(t => t.status === "solved").length;
    const failed = topic.tasks.filter(t => t.status === "failed").length;
    const total = topic.tasks.length;

    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div>
                    <div className="text-sm font-bold text-gray-900">{topic.topic_name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                        <span className="text-emerald-600 font-bold">{solved}</span> решено ·{" "}
                        <span className="text-red-400 font-bold">{failed}</span> с ошибкой ·{" "}
                        <span className="text-gray-400">{total - solved - failed}</span> не начато
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {onAnalyze && topic.attempt_id && (
                        <button
                            onClick={onAnalyze}
                            title="Проверка и публикация"
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                        >
                            <FileText size={13} />
                            Проверка
                        </button>
                    )}
                    <button
                        onClick={onViewStats}
                        className="flex items-center gap-1.5 text-xs text-[#3F8C62] font-bold hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <BarChart2 size={14} />
                        Статистика
                    </button>
                </div>
            </div>
            <div className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                    {topic.tasks.map(task => {
                        const canReviewSolution = task.has_own_solution;
                        return (
                        <button
                            key={task.task_id}
                            type="button"
                            onClick={() => canReviewSolution && onReviewSolution?.(task)}
                            disabled={!canReviewSolution}
                            title={`Задание ${task.ege_number ?? task.order_index + 1} — ${
                                task.status === "solved" ? "решено" :
                                task.status === "failed" ? "неверно" : "не начато"
                            }${task.attempts_count > 0 ? ` (${task.attempts_count} попыток)` : ""}`}
                            className={clsx(
                                "relative w-10 h-10 rounded-xl border flex items-center justify-center flex-col gap-0.5 text-[10px] font-bold transition-all disabled:cursor-default",
                                task.status === "solved" && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                task.status === "failed" && "bg-red-50 border-red-200 text-red-500",
                                task.status === "not_started" && "bg-gray-50 border-gray-100 text-gray-400",
                                canReviewSolution && "ring-2 ring-[#3F8C62]/25 hover:ring-[#3F8C62]/60 hover:scale-105",
                            )}
                        >
                            <StatusIcon status={task.status} />
                            <span>{task.ege_number ?? task.order_index + 1}</span>
                            {canReviewSolution && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3F8C62] px-1 text-[9px] font-black text-white">
                                    {task.solution_comments_count > 0 ? task.solution_comments_count : <Paperclip size={9} />}
                                </span>
                            )}
                        </button>
                    );
                    })}
                </div>
            </div>
        </div>
    );
}

export function StudentDetail({ student, onBack, onViewTopicStats, apiKey, initialReviewTaskId }: Props) {
    const [tab, setTab] = useState<Tab>("tutorial");
    const [analysisFor, setAnalysisFor] = useState<{ topicName: string; attemptId: number } | null>(null);
    const [reviewFor, setReviewFor] = useState<StudentTaskResult | null>(null);

    const topicsByCategory = student.topics.filter(t => t.category === tab);
    const totalSolved = student.total_solved;
    const totalPct = student.total_tasks === 0 ? 0 : Math.round((totalSolved / student.total_tasks) * 100);

    useEffect(() => {
        if (!initialReviewTaskId) return;
        for (const topic of student.topics) {
            const task = topic.tasks.find((item) => item.task_id === initialReviewTaskId);
            if (task) {
                setTab(topic.category as Tab);
                setReviewFor(task);
                break;
            }
        }
    }, [initialReviewTaskId, student.topics]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 font-bold transition-colors"
                >
                    <ArrowLeft size={18} />
                    Назад
                </button>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-3">
                    {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-100" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                            {student.name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <div className="text-sm font-bold text-gray-900">{student.name}</div>
                        <div className="text-[11px] text-gray-400">@{student.username || `id${student.id}`}</div>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-gray-400">Всего решено</div>
                        <div className="text-sm font-bold text-gray-900">{totalSolved} / {student.total_tasks} ({totalPct}%)</div>
                    </div>
                    <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#3F8C62] rounded-full" style={{ width: `${totalPct}%` }} />
                    </div>
                </div>
            </div>

            <WeeklyStatsBlock student={student} />

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-4 pb-2 shrink-0">
                {TAB_OPTIONS.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setTab(opt.key)}
                        className={clsx(
                            "px-5 py-2 rounded-lg text-sm font-bold transition-all",
                            tab === opt.key
                                ? "bg-[#3F8C62] text-white shadow-md shadow-[#3F8C62]/20"
                                : "text-gray-500 hover:bg-gray-100"
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {topicsByCategory.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Circle size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-gray-700">Нет данных</p>
                        <p className="text-sm">Ученик ещё не начинал задания в этом разделе</p>
                    </div>
                ) : (
                    topicsByCategory.map(topic => (
                        <TopicBlock
                            key={topic.topic_id}
                            topic={topic}
                            onViewStats={() => onViewTopicStats(topic.topic_id)}
                            onReviewSolution={(task) => setReviewFor(task)}
                            onAnalyze={topic.attempt_id ? () => setAnalysisFor({
                                topicName: topic.topic_name,
                                attemptId: topic.attempt_id!,
                            }) : undefined}
                        />
                    ))
                )}
            </div>

            {analysisFor && (
                <AnalysisModal
                    studentName={student.name}
                    attemptId={analysisFor.attemptId}
                    apiKey={apiKey}
                    onClose={() => setAnalysisFor(null)}
                />
            )}

            {reviewFor && (
                <StudentTaskSolutionReviewModal
                    studentId={student.id}
                    taskId={reviewFor.task_id}
                    studentName={student.name}
                    apiKey={apiKey}
                    onClose={() => setReviewFor(null)}
                />
            )}
        </div>
    );
}
