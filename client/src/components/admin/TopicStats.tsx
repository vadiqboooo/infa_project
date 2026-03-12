import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Circle, Trash2, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import type { TopicStatsOut, GroupOut } from "../../api/types";
import { AnalysisModal } from "./AnalysisModal";

const API_BASE = "/api";

interface Props {
    stats: TopicStatsOut;
    groups: GroupOut[];
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

export function TopicStats({ stats, groups, onBack, apiKey, onRefresh }: Props) {
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [analysisFor, setAnalysisFor] = useState<{ studentId: number; studentName: string; attemptId: number } | null>(null);
    const [groupFilter, setGroupFilter] = useState<number | null>(null);

    const filteredStudents = groupFilter === null
        ? stats.students
        : stats.students.filter(s => (s.group_ids ?? []).includes(groupFilter));

    const handleDelete = async (studentId: number, studentName: string) => {
        if (!confirm(`Сбросить все результаты «${studentName}» по этому топику? Ученик сможет пройти вариант заново.`)) return;
        setDeletingId(studentId);
        try {
            const token = localStorage.getItem("jwt_token");
            const headers: Record<string, string> = {};
            if (apiKey) headers["X-API-Key"] = apiKey;
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API_BASE}/admin/students/${studentId}/topics/${stats.topic_id}/progress`, {
                method: "DELETE",
                headers,
            });
            if (!res.ok && res.status !== 204) throw new Error("Ошибка удаления");
            onRefresh?.();
        } catch {
            alert("Не удалось сбросить результаты");
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
    filteredStudents.forEach(s => {
        stats.tasks.forEach(t => {
            if (s.results[t.task_id] === "solved") solvedCounts[t.task_id]++;
        });
    });

    const nameColW = 160;
    const taskColW = 44;
    const countColW = 56;
    const actionsColW = 80;
    const totalW = nameColW + stats.tasks.length * taskColW + countColW + actionsColW;

    return (
        <>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 shrink-0 flex-wrap">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 font-bold transition-colors">
                        <ArrowLeft size={18} /> Назад
                    </button>
                    <div className="w-px h-6 bg-gray-200" />
                    <div>
                        <div className="text-sm font-bold text-gray-900">{stats.topic_title}</div>
                        <div className="text-[11px] text-gray-400">
                            {filteredStudents.length}{groupFilter !== null ? `/${stats.students.length}` : ''} учеников · {stats.tasks.length} заданий
                        </div>
                    </div>
                    {/* Group filter */}
                    {groups.length > 0 && (
                        <div className="ml-auto flex items-center gap-2">
                            {groupFilter !== null ? (
                                <button
                                    onClick={() => setGroupFilter(null)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-white"
                                    style={{ backgroundColor: groups.find(g => g.id === groupFilter)?.color ?? '#888' }}
                                >
                                    {groups.find(g => g.id === groupFilter)?.name}
                                    <X size={11} />
                                </button>
                            ) : (
                                <select
                                    value=""
                                    onChange={(e) => setGroupFilter(Number(e.target.value))}
                                    className="text-xs font-bold px-3 py-1.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#3F8C62] cursor-pointer text-gray-600"
                                >
                                    <option value="" disabled>Фильтр по группе...</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name} ({g.student_count})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </div>

                {/* Scrollable table */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    <div className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                        <div className="overflow-x-auto rounded-2xl">
                            <table className="border-collapse" style={{ width: `${Math.max(totalW, 600)}px` }}>
                                <thead>
                                    <tr className="bg-gray-50" style={{ borderBottom: "1px solid #e5e7eb" }}>
                                        <th className="text-left text-xs font-bold text-gray-500 bg-gray-50"
                                            style={{ width: nameColW, minWidth: nameColW, padding: "10px 16px", position: "sticky", left: 0, zIndex: 10 }}>
                                            Ученик
                                        </th>
                                        {stats.tasks.map(task => (
                                            <th key={task.task_id} className="text-center text-xs font-bold text-gray-500"
                                                style={{ width: taskColW, padding: "10px 4px" }}>
                                                {task.ege_number ?? task.order_index + 1}
                                            </th>
                                        ))}
                                        <th className="text-center text-xs font-bold text-gray-500" style={{ width: countColW, padding: "10px 8px" }}>Итог</th>
                                        <th className="text-center text-xs font-bold text-gray-500" style={{ width: actionsColW, padding: "10px 8px" }}>Действия</th>
                                    </tr>
                                    {/* % solved per task */}
                                    <tr className="bg-emerald-50/40" style={{ borderBottom: "2px solid #f3f4f6" }}>
                                        <td className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-emerald-50/40"
                                            style={{ padding: "6px 16px", position: "sticky", left: 0 }}>
                                            % решили
                                        </td>
                                        {stats.tasks.map(task => {
                                            const n = filteredStudents.length;
                                            const pct = n === 0 ? 0 : Math.round((solvedCounts[task.task_id] / n) * 100);
                                            return (
                                                <td key={task.task_id} className="text-center" style={{ padding: "6px 4px" }}>
                                                    <span className={clsx("text-[10px] font-bold",
                                                        pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-500" : "text-red-400")}>
                                                        {pct}%
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td /><td />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(student => {
                                        const solvedCount = stats.tasks.filter(t => student.results[t.task_id] === "solved").length;
                                        const isDeleting = deletingId === student.student_id;
                                        return (
                                            <tr key={student.student_id}
                                                className={clsx("transition-colors hover:bg-gray-50/50", isDeleting && "opacity-40 pointer-events-none")}>
                                                <td className="bg-white"
                                                    style={{ padding: "10px 16px", borderBottom: "1px solid #f9fafb", position: "sticky", left: 0, minWidth: nameColW }}>
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
                                                    <span className={clsx("text-xs font-bold",
                                                        solvedCount === stats.tasks.length ? "text-emerald-600" : "text-gray-700")}>
                                                        {solvedCount}/{stats.tasks.length}
                                                    </span>
                                                </td>
                                                <td className="text-center" style={{ padding: "8px 8px", borderBottom: "1px solid #f9fafb" }}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        {/* AI Analysis button — only if attempt exists */}
                                                        {student.attempt_id && (
                                                            <button
                                                                onClick={() => setAnalysisFor({
                                                                    studentId: student.student_id,
                                                                    studentName: student.student_name,
                                                                    attemptId: student.attempt_id!,
                                                                })}
                                                                title="Анализ ИИ"
                                                                className="p-1.5 rounded-lg text-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                                                            >
                                                                <Sparkles size={14} />
                                                            </button>
                                                        )}
                                                        {/* Delete button */}
                                                        <button
                                                            onClick={() => handleDelete(student.student_id, student.student_name)}
                                                            title="Сбросить результаты"
                                                            className="p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filteredStudents.length === 0 && (
                                <div className="text-center py-16 text-gray-400">
                                    <p className="font-bold text-gray-700">Нет данных</p>
                                    <p className="text-sm">Ни один ученик ещё не решал задания этого топика</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Analysis Modal */}
            {analysisFor && (
                <AnalysisModal
                    studentName={analysisFor.studentName}
                    attemptId={analysisFor.attemptId}
                    apiKey={apiKey}
                    onClose={() => setAnalysisFor(null)}
                />
            )}
        </>
    );
}
