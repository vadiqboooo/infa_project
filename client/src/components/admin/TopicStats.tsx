import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Circle, Trash2, Sparkles, X, Loader2, ChevronDown, ChevronUp, ExternalLink, FileText } from "lucide-react";
import { clsx } from "clsx";
import type { TopicStatsOut, GroupOut, TopicStatsStudentRow, TopicStatsTaskInfo } from "../../api/types";
import { AnalysisModal } from "./AnalysisModal";

const API_BASE = "/api";

interface Props {
    stats: TopicStatsOut;
    groups: GroupOut[];
    onBack: () => void;
    apiKey?: string;
    onRefresh?: () => void;
}

/** Format {"val": ...} answer to a compact display string */
function fmtAnswer(ans: { val: any } | null | undefined): string {
    if (!ans) return "";
    const v = ans.val;
    if (v == null) return "";
    if (Array.isArray(v)) {
        if (Array.isArray(v[0])) return (v as any[][]).map((r: any[]) => r.join(",")).join(" / ");
        return (v as any[]).join(", ");
    }
    return String(v);
}

// ── Cell Detail Modal ──────────────────────────────────────────────────────────

interface CellModalProps {
    student: TopicStatsStudentRow;
    task: TopicStatsTaskInfo;
    onClose: () => void;
    apiKey?: string;
}

interface TaskDetail {
    id: number;
    content_html: string;
    ege_number: number | null;
    correct_answer: { val: any } | null;
    answer_type: string;
    full_solution_code?: string | null;
}

function CellDetailModal({ student, task, onClose, apiKey }: CellModalProps) {
    const [taskData, setTaskData] = useState<TaskDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [codeOpen, setCodeOpen] = useState(false);
    const [solutionOpen, setSolutionOpen] = useState(false);

    const ans = student.answers?.[task.task_id];
    const status = student.results[task.task_id];

    const authHeaders = (): Record<string, string> => {
        const token = localStorage.getItem("jwt_token");
        const h: Record<string, string> = {};
        if (apiKey) h["X-API-Key"] = apiKey;
        if (token) h["Authorization"] = `Bearer ${token}`;
        return h;
    };

    // Fetch task on mount
    useState(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/tasks/${task.task_id}`, { headers: authHeaders() });
                if (res.ok) setTaskData(await res.json());
            } finally {
                setLoading(false);
            }
        })();
    });

    const userAnswer = ans?.user_answer;
    const correctAnswer = taskData?.correct_answer ?? task.correct_answer;
    const isCorrect = status === "solved";
    const color = isCorrect ? "emerald" : status === "failed" ? "red" : "gray";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold",
                            color === "emerald" && "bg-emerald-100 text-emerald-700",
                            color === "red" && "bg-red-100 text-red-600",
                            color === "gray" && "bg-gray-100 text-gray-500",
                        )}>
                            {task.ege_number ?? "?"}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-gray-900">Задание №{task.ege_number ?? task.order_index + 1}</div>
                            <div className="text-[11px] text-gray-400">{student.student_name}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {/* Answer row */}
                    <div className="flex gap-4">
                        <div className={clsx(
                            "flex-1 rounded-xl px-4 py-3 border",
                            color === "emerald" && "bg-emerald-50 border-emerald-100",
                            color === "red" && "bg-red-50 border-red-100",
                            color === "gray" && "bg-gray-50 border-gray-100",
                        )}>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ответ ученика</div>
                            <div className="flex items-center gap-2">
                                {isCorrect
                                    ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                                    : status === "failed"
                                        ? <XCircle size={15} className="text-red-400 shrink-0" />
                                        : <Circle size={15} className="text-gray-300 shrink-0" />
                                }
                                <span className={clsx(
                                    "text-sm font-mono font-bold",
                                    color === "emerald" && "text-emerald-700",
                                    color === "red" && "text-red-600",
                                    color === "gray" && "text-gray-400",
                                )}>
                                    {userAnswer ? fmtAnswer(userAnswer) : "Нет ответа"}
                                </span>
                            </div>
                            {ans?.points != null && (
                                <div className="text-[11px] text-gray-400 mt-1">{ans.points}/{ans.max_points} балл.</div>
                            )}
                        </div>

                        {correctAnswer && (
                            <div className="flex-1 rounded-xl px-4 py-3 border bg-gray-50 border-gray-100">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Верный ответ</div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                                    <span className="text-sm font-mono font-bold text-emerald-700">{fmtAnswer(correctAnswer)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Task HTML */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">Загрузка задания...</span>
                        </div>
                    ) : taskData?.content_html ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-5 py-4">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-3">Условие задачи</div>
                            <div
                                className="task-html text-sm text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: taskData.content_html }}
                            />
                        </div>
                    ) : null}

                    {/* Code solution */}
                    {ans?.code_solution && (
                        <div className="rounded-xl border border-blue-100 overflow-hidden">
                            <button
                                onClick={() => setCodeOpen(v => !v)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                                <FileText size={13} />
                                Код решения ученика
                                {codeOpen ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
                            </button>
                            {codeOpen && (
                                <pre className="px-4 py-3 text-[11px] font-mono text-gray-800 bg-white overflow-x-auto whitespace-pre-wrap border-t border-blue-100">
                                    {ans.code_solution}
                                </pre>
                            )}
                        </div>
                    )}

                    {/* File solution */}
                    {ans?.file_solution_url && (
                        <div className="rounded-xl border border-gray-100 px-4 py-3 bg-gray-50">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Файл решения</div>
                            <a
                                href={ans.file_solution_url.startsWith("http") ? ans.file_solution_url : `/api${ans.file_solution_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
                            >
                                <ExternalLink size={13} /> Открыть файл
                            </a>
                        </div>
                    )}

                    {/* Etalon code solution */}
                    {taskData?.full_solution_code && (
                        <div className="rounded-xl border border-emerald-100 overflow-hidden">
                            <button
                                onClick={() => setSolutionOpen(v => !v)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            >
                                <FileText size={13} />
                                Эталонное решение
                                {solutionOpen ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
                            </button>
                            {solutionOpen && (
                                <pre className="px-4 py-3 text-[11px] font-mono text-gray-800 bg-white overflow-x-auto whitespace-pre-wrap border-t border-emerald-100">
                                    {taskData.full_solution_code}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Table Cell ────────────────────────────────────────────────────────────

function Cell({
    status, answer, onClick, hasDetail,
}: {
    status: string | undefined;
    answer: string;
    onClick: () => void;
    hasDetail: boolean;
}) {
    return (
        <td
            onClick={hasDetail ? onClick : undefined}
            className={clsx("text-center", hasDetail && "cursor-pointer hover:bg-emerald-50/40 transition-colors")}
            style={{ padding: "6px 2px", borderBottom: "1px solid #f9fafb" }}
        >
            <div className="flex flex-col items-center gap-0.5">
                {status === "solved" && <CheckCircle2 size={14} className="text-emerald-500" />}
                {status === "failed" && <XCircle size={14} className="text-red-400" />}
                {!status && <Circle size={12} className="text-gray-200" />}
                {answer && (
                    <span className={clsx(
                        "text-[9px] font-mono leading-tight max-w-[56px] truncate",
                        status === "solved" ? "text-emerald-600" : status === "failed" ? "text-red-400" : "text-gray-400"
                    )}>
                        {answer}
                    </span>
                )}
            </div>
        </td>
    );
}

// ── TopicStats ─────────────────────────────────────────────────────────────────

export function TopicStats({ stats, groups, onBack, apiKey, onRefresh }: Props) {
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [analysisFor, setAnalysisFor] = useState<{ studentId: number; studentName: string; attemptId: number } | null>(null);
    const [groupFilter, setGroupFilter] = useState<number | null>(null);
    const [cellDetail, setCellDetail] = useState<{ student: TopicStatsStudentRow; task: TopicStatsTaskInfo } | null>(null);

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
    const taskColW = 64;
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

                                    {/* % solved + correct answer row */}
                                    <tr className="bg-emerald-50/40" style={{ borderBottom: "2px solid #f3f4f6" }}>
                                        <td className="bg-emerald-50/40" style={{ padding: "6px 16px", position: "sticky", left: 0 }}>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">% решили</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">верный ответ</div>
                                        </td>
                                        {stats.tasks.map(task => {
                                            const n = filteredStudents.length;
                                            const pct = n === 0 ? 0 : Math.round((solvedCounts[task.task_id] / n) * 100);
                                            const correct = fmtAnswer(task.correct_answer);
                                            return (
                                                <td key={task.task_id} className="text-center" style={{ padding: "6px 4px" }}>
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className={clsx("text-[10px] font-bold",
                                                            pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-500" : "text-red-400")}>
                                                            {pct}%
                                                        </span>
                                                        {correct && (
                                                            <span className="text-[9px] font-mono text-gray-500 bg-gray-100 rounded px-1 max-w-[56px] truncate" title={correct}>
                                                                {correct}
                                                            </span>
                                                        )}
                                                    </div>
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
                                                {stats.tasks.map(task => {
                                                    const ans = student.answers?.[task.task_id];
                                                    const ansText = fmtAnswer(ans?.user_answer);
                                                    const hasDetail = !!(student.results[task.task_id] || ans);
                                                    return (
                                                        <Cell
                                                            key={task.task_id}
                                                            status={student.results[task.task_id]}
                                                            answer={ansText}
                                                            hasDetail={hasDetail}
                                                            onClick={() => setCellDetail({ student, task })}
                                                        />
                                                    );
                                                })}
                                                <td className="text-center" style={{ padding: "10px 8px", borderBottom: "1px solid #f9fafb" }}>
                                                    <span className={clsx("text-xs font-bold",
                                                        solvedCount === stats.tasks.length ? "text-emerald-600" : "text-gray-700")}>
                                                        {solvedCount}/{stats.tasks.length}
                                                    </span>
                                                </td>
                                                <td className="text-center" style={{ padding: "8px 8px", borderBottom: "1px solid #f9fafb" }}>
                                                    <div className="flex items-center justify-center gap-1">
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

            {/* Cell Detail Modal */}
            {cellDetail && (
                <CellDetailModal
                    student={cellDetail.student}
                    task={cellDetail.task}
                    apiKey={apiKey}
                    onClose={() => setCellDetail(null)}
                />
            )}

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
