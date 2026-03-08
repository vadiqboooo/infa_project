import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Circle, BarChart2 } from "lucide-react";
import { clsx } from "clsx";
import type { StudentDetailOut, StudentTopicDetail } from "../../api/types";

interface Props {
    student: StudentDetailOut;
    onBack: () => void;
    onViewTopicStats: (topicId: number) => void;
}

type Tab = "tutorial" | "homework" | "variants";

const TAB_OPTIONS: { key: Tab; label: string }[] = [
    { key: "tutorial", label: "Разбор" },
    { key: "homework", label: "Домашка" },
    { key: "variants", label: "Варианты" },
];

function StatusIcon({ status }: { status: string }) {
    if (status === "solved") return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
    if (status === "failed") return <XCircle size={16} className="text-red-400 shrink-0" />;
    return <Circle size={16} className="text-gray-300 shrink-0" />;
}

function TopicBlock({ topic, onViewStats }: { topic: StudentTopicDetail; onViewStats: () => void }) {
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
                <button
                    onClick={onViewStats}
                    className="flex items-center gap-1.5 text-xs text-[#3F8C62] font-bold hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <BarChart2 size={14} />
                    Статистика
                </button>
            </div>
            <div className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                    {topic.tasks.map(task => (
                        <div
                            key={task.task_id}
                            title={`Задание ${task.ege_number ?? task.order_index + 1} — ${
                                task.status === "solved" ? "решено" :
                                task.status === "failed" ? "неверно" : "не начато"
                            }${task.attempts_count > 0 ? ` (${task.attempts_count} попыток)` : ""}`}
                            className={clsx(
                                "w-10 h-10 rounded-xl border flex items-center justify-center flex-col gap-0.5 text-[10px] font-bold transition-all",
                                task.status === "solved" && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                task.status === "failed" && "bg-red-50 border-red-200 text-red-500",
                                task.status === "not_started" && "bg-gray-50 border-gray-100 text-gray-400",
                            )}
                        >
                            <StatusIcon status={task.status} />
                            <span>{task.ege_number ?? task.order_index + 1}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function StudentDetail({ student, onBack, onViewTopicStats }: Props) {
    const [tab, setTab] = useState<Tab>("tutorial");

    const topicsByCategory = student.topics.filter(t => t.category === tab);
    const totalSolved = student.total_solved;
    const totalPct = student.total_tasks === 0 ? 0 : Math.round((totalSolved / student.total_tasks) * 100);

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
                        />
                    ))
                )}
            </div>
        </div>
    );
}
