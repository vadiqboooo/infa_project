import React from "react";
import { ArrowLeft, CheckCircle2, XCircle, Circle } from "lucide-react";
import { clsx } from "clsx";
import type { TopicStatsOut } from "../../api/types";

interface Props {
    stats: TopicStatsOut;
    onBack: () => void;
}

function Cell({ status }: { status: string | undefined }) {
    if (status === "solved") return (
        <td className="px-2 py-3 text-center border-b border-gray-50">
            <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
        </td>
    );
    if (status === "failed") return (
        <td className="px-2 py-3 text-center border-b border-gray-50">
            <XCircle size={16} className="text-red-400 mx-auto" />
        </td>
    );
    return (
        <td className="px-2 py-3 text-center border-b border-gray-50">
            <Circle size={14} className="text-gray-200 mx-auto" />
        </td>
    );
}

export function TopicStats({ stats, onBack }: Props) {
    if (stats.tasks.length === 0) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 font-bold">
                        <ArrowLeft size={18} /> Назад
                    </button>
                    <span className="text-sm font-bold text-gray-900">{stats.topic_title}</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    <p>Нет задач в этом топике</p>
                </div>
            </div>
        );
    }

    const solvedCounts: Record<number, number> = {};
    const failedCounts: Record<number, number> = {};
    stats.tasks.forEach(t => {
        solvedCounts[t.task_id] = 0;
        failedCounts[t.task_id] = 0;
    });
    stats.students.forEach(s => {
        stats.tasks.forEach(t => {
            const status = s.results[t.task_id];
            if (status === "solved") solvedCounts[t.task_id]++;
            else if (status === "failed") failedCounts[t.task_id]++;
        });
    });

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
                <div>
                    <div className="text-sm font-bold text-gray-900">{stats.topic_title}</div>
                    <div className="text-[11px] text-gray-400">
                        {stats.students.length} учеников · {stats.tasks.length} заданий
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="border-collapse" style={{ minWidth: `${180 + stats.tasks.length * 52}px` }}>
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-44 sticky left-0 bg-gray-50 z-10">
                                    Ученик
                                </th>
                                {stats.tasks.map(task => (
                                    <th key={task.task_id} className="px-2 py-3 text-center text-xs font-bold text-gray-500 w-12">
                                        {task.ege_number ?? task.order_index + 1}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 w-20">
                                    Решено
                                </th>
                            </tr>
                            {/* Summary row - % solved per task */}
                            <tr className="border-b-2 border-gray-100 bg-emerald-50/50">
                                <td className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide sticky left-0 bg-emerald-50/50">
                                    Решили
                                </td>
                                {stats.tasks.map(task => {
                                    const n = stats.students.length;
                                    const pct = n === 0 ? 0 : Math.round((solvedCounts[task.task_id] / n) * 100);
                                    return (
                                        <td key={task.task_id} className="px-2 py-2 text-center">
                                            <span className={clsx(
                                                "text-[10px] font-bold",
                                                pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-500" : "text-red-400"
                                            )}>
                                                {pct}%
                                            </span>
                                        </td>
                                    );
                                })}
                                <td />
                            </tr>
                        </thead>
                        <tbody>
                            {stats.students.map(student => {
                                const solvedCount = stats.tasks.filter(t => student.results[t.task_id] === "solved").length;
                                return (
                                    <tr key={student.student_id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-4 py-3 border-b border-gray-50 sticky left-0 bg-white group-hover:bg-gray-50/50">
                                            <div className="flex items-center gap-2">
                                                {student.photo_url ? (
                                                    <img src={student.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                                                        {student.student_name.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="text-xs font-semibold text-gray-800 truncate max-w-[110px]">
                                                    {student.student_name}
                                                </span>
                                            </div>
                                        </td>
                                        {stats.tasks.map(task => (
                                            <Cell key={task.task_id} status={student.results[task.task_id]} />
                                        ))}
                                        <td className="px-4 py-3 border-b border-gray-50 text-center">
                                            <span className={clsx(
                                                "text-xs font-bold",
                                                solvedCount === stats.tasks.length ? "text-emerald-600" : "text-gray-700"
                                            )}>
                                                {solvedCount}/{stats.tasks.length}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {stats.students.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <p className="font-bold text-gray-700">Нет данных</p>
                            <p className="text-sm">Ни один ученик ещё не решал задания этого топика</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
