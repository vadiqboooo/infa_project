import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Circle, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import type { TopicStatsOut } from "../../api/types";

const API_BASE = "/api";

interface Props {
    stats: TopicStatsOut;
    onBack: () => void;
    apiKey?: string;
    onRefresh?: () => void;
}

function Cell({ status }: { status: string | undefined }) {
    if (status === "solved") return (
        <td className="px-2 py-3 text-center" style={{ borderBottom: "1px solid #f9fafb" }}>
            <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
        </td>
    );
    if (status === "failed") return (
        <td className="px-2 py-3 text-center" style={{ borderBottom: "1px solid #f9fafb" }}>
            <XCircle size={16} className="text-red-400 mx-auto" />
        </td>
    );
    return (
        <td className="px-2 py-3 text-center" style={{ borderBottom: "1px solid #f9fafb" }}>
            <Circle size={14} className="text-gray-200 mx-auto" />
        </td>
    );
}

export function TopicStats({ stats, onBack, apiKey, onRefresh }: Props) {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = async (studentId: number, studentName: string) => {
        if (!confirm(`Удалить все результаты «${studentName}» по этому топику? Ученик сможет пройти вариант заново.`)) return;
        if (!apiKey) return;
        setDeletingId(studentId);
        try {
            const token = localStorage.getItem("jwt_token");
            const headers: Record<string, string> = {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API_BASE}/admin/students/${studentId}/topics/${stats.topic_id}/progress`, {
                method: "DELETE",
                headers,
            });
            if (!res.ok && res.status !== 204) throw new Error("Ошибка удаления");
            onRefresh?.();
        } catch {
            alert("Не удалось удалить результаты");
        } finally {
            setDeletingId(null);
        }
    };

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
    stats.tasks.forEach(t => { solvedCounts[t.task_id] = 0; });
    stats.students.forEach(s => {
        stats.tasks.forEach(t => {
            if (s.results[t.task_id] === "solved") solvedCounts[t.task_id]++;
        });
    });

    /* Column widths */
    const nameColW = 160;
    const taskColW = 44;
    const countColW = 64;
    const deleteColW = 44;
    const totalW = nameColW + stats.tasks.length * taskColW + countColW + deleteColW;

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

            {/* Scrollable table area */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {/* outer border container — NO overflow-hidden so sticky works */}
                <div className="border border-gray-200 rounded-2xl shadow-sm bg-white" style={{ minWidth: `${Math.min(totalW, 900)}px` }}>
                    <div className="overflow-x-auto rounded-2xl">
                        <table className="border-collapse" style={{ width: `${totalW}px` }}>
                            <thead>
                                <tr className="bg-gray-50" style={{ borderBottom: "1px solid #e5e7eb" }}>
                                    <th
                                        className="text-left text-xs font-bold text-gray-500 bg-gray-50"
                                        style={{ width: nameColW, minWidth: nameColW, padding: "10px 16px", position: "sticky", left: 0, zIndex: 10 }}
                                    >
                                        Ученик
                                    </th>
                                    {stats.tasks.map(task => (
                                        <th
                                            key={task.task_id}
                                            className="text-center text-xs font-bold text-gray-500"
                                            style={{ width: taskColW, padding: "10px 4px" }}
                                        >
                                            {task.ege_number ?? task.order_index + 1}
                                        </th>
                                    ))}
                                    <th className="text-center text-xs font-bold text-gray-500" style={{ width: countColW, padding: "10px 8px" }}>
                                        Итог
                                    </th>
                                    <th style={{ width: deleteColW }} />
                                </tr>
                                {/* % solved per task */}
                                <tr className="bg-emerald-50/40" style={{ borderBottom: "2px solid #f3f4f6" }}>
                                    <td
                                        className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-emerald-50/40"
                                        style={{ padding: "6px 16px", position: "sticky", left: 0 }}
                                    >
                                        % решили
                                    </td>
                                    {stats.tasks.map(task => {
                                        const n = stats.students.length;
                                        const pct = n === 0 ? 0 : Math.round((solvedCounts[task.task_id] / n) * 100);
                                        return (
                                            <td key={task.task_id} className="text-center" style={{ padding: "6px 4px" }}>
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
                                    <td />
                                </tr>
                            </thead>
                            <tbody>
                                {stats.students.map(student => {
                                    const solvedCount = stats.tasks.filter(t => student.results[t.task_id] === "solved").length;
                                    const isDeleting = deletingId === student.student_id;
                                    return (
                                        <tr
                                            key={student.student_id}
                                            className={clsx("group transition-colors", isDeleting ? "opacity-40 pointer-events-none" : "hover:bg-gray-50/50")}
                                        >
                                            <td
                                                className="bg-white group-hover:bg-gray-50/50"
                                                style={{ padding: "10px 16px", borderBottom: "1px solid #f9fafb", position: "sticky", left: 0, minWidth: nameColW }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {student.photo_url ? (
                                                        <img src={student.photo_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                            {student.student_name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <span className="text-xs font-semibold text-gray-800 truncate" style={{ maxWidth: 100 }}>
                                                        {student.student_name}
                                                    </span>
                                                </div>
                                            </td>
                                            {stats.tasks.map(task => (
                                                <Cell key={task.task_id} status={student.results[task.task_id]} />
                                            ))}
                                            <td className="text-center" style={{ padding: "10px 8px", borderBottom: "1px solid #f9fafb" }}>
                                                <span className={clsx(
                                                    "text-xs font-bold",
                                                    solvedCount === stats.tasks.length ? "text-emerald-600" : "text-gray-700"
                                                )}>
                                                    {solvedCount}/{stats.tasks.length}
                                                </span>
                                            </td>
                                            <td className="text-center" style={{ padding: "10px 4px", borderBottom: "1px solid #f9fafb" }}>
                                                {apiKey && (
                                                    <button
                                                        onClick={() => handleDelete(student.student_id, student.student_name)}
                                                        title="Сбросить результаты"
                                                        className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
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
        </div>
    );
}