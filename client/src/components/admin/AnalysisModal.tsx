import { useEffect, useState } from "react";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    FileText,
    Globe,
    GlobeLock,
    Loader2,
    Send,
    X,
    XCircle,
} from "lucide-react";
import { clsx } from "clsx";

const API_BASE = "/api";

interface TaskResult {
    task_id: number;
    ege_number: number | null;
    user_answer: { val: any } | null;
    correct_answer: { val: any } | null;
    is_correct: boolean;
    points: number;
    max_points: number;
    auto_checked: boolean;
    code_solution?: string | null;
    file_solution_url?: string | null;
}

interface Props {
    studentName: string;
    attemptId: number;
    apiKey?: string;
    onClose: () => void;
}

function fmtVal(ans: { val: any } | null | undefined): string {
    if (!ans) return "—";
    const v = ans.val;
    if (v == null) return "—";
    if (Array.isArray(v)) {
        if (Array.isArray(v[0])) return (v as any[][]).map((r: any[]) => r.join(", ")).join(" / ");
        return (v as any[]).join(", ");
    }
    return String(v);
}

function TaskResultCard({ r }: { r: TaskResult }) {
    const [codeOpen, setCodeOpen] = useState(false);
    const color = r.is_correct ? "emerald" : r.points > 0 ? "amber" : "red";

    return (
        <div className={clsx(
            "rounded-xl border overflow-hidden",
            color === "emerald" && "border-emerald-100 bg-emerald-50/30",
            color === "amber" && "border-amber-100 bg-amber-50/30",
            color === "red" && "border-red-100 bg-red-50/30",
        )}>
            <div className="flex items-center gap-3 px-4 py-3">
                <div className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                    color === "emerald" && "bg-emerald-100 text-emerald-700",
                    color === "amber" && "bg-amber-100 text-amber-700",
                    color === "red" && "bg-red-100 text-red-600",
                )}>
                    {r.ege_number ?? "?"}
                </div>

                {r.is_correct
                    ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    : r.points > 0
                        ? <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                        : <XCircle size={16} className="text-red-400 shrink-0" />
                }

                <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Ответ ученика</span>
                        <div className={clsx(
                            "text-xs font-mono font-bold",
                            color === "emerald" ? "text-emerald-700" : color === "amber" ? "text-amber-700" : "text-red-600"
                        )}>
                            {fmtVal(r.user_answer)}
                        </div>
                    </div>
                    {!r.is_correct && r.auto_checked && (
                        <div>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Верный ответ</span>
                            <div className="text-xs font-mono font-bold text-emerald-700">
                                {fmtVal(r.correct_answer)}
                            </div>
                        </div>
                    )}
                </div>

                <div className={clsx(
                    "text-xs font-bold shrink-0 px-2 py-1 rounded-lg",
                    color === "emerald" && "text-emerald-700 bg-emerald-100",
                    color === "amber" && "text-amber-700 bg-amber-100",
                    color === "red" && "text-red-600 bg-red-100",
                )}>
                    {r.points}/{r.max_points}
                </div>
            </div>

            {r.code_solution && (
                <div className="border-t border-gray-100">
                    <button
                        onClick={() => setCodeOpen(v => !v)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <FileText size={12} />
                        Код решения
                        {codeOpen ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
                    </button>
                    {codeOpen && (
                        <pre className="px-4 pb-3 text-[11px] font-mono text-gray-700 bg-gray-50 overflow-x-auto whitespace-pre-wrap">
                            {r.code_solution}
                        </pre>
                    )}
                </div>
            )}

            {r.file_solution_url && (
                <div className="border-t border-gray-100 px-4 py-2">
                    <a
                        href={r.file_solution_url.startsWith("http") ? r.file_solution_url : `/api${r.file_solution_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                    >
                        <ExternalLink size={11} /> Файл решения
                    </a>
                </div>
            )}
        </div>
    );
}

export function AnalysisModal({ studentName, attemptId, apiKey, onClose }: Props) {
    const [results, setResults] = useState<{ primary_score: number | null; score: number | null; task_results: TaskResult[] } | null>(null);
    const [resultsLoading, setResultsLoading] = useState(true);
    const [resultsError, setResultsError] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [isPublished, setIsPublished] = useState(false);
    const [publishLoading, setPublishLoading] = useState(false);
    const [publishSuccess, setPublishSuccess] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);

    const authHeaders = (): Record<string, string> => {
        const token = localStorage.getItem("jwt_token");
        const h: Record<string, string> = {};
        if (apiKey) h["X-API-Key"] = apiKey;
        if (token) h["Authorization"] = `Bearer ${token}`;
        return h;
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/results`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Ошибка ${res.status}`);
                setResults(await res.json());
            } catch (e: any) {
                setResultsError(e.message);
            } finally {
                setResultsLoading(false);
            }
        })();
    }, [attemptId]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/analyze`, { headers: authHeaders() });
                if (res.status === 404) return;
                if (!res.ok) throw new Error(`Ошибка ${res.status}`);
                const data = await res.json();
                setComment(data.comment ?? "");
                setIsPublished(data.is_published ?? false);
            } catch {
                // The results table remains usable even if publication metadata is unavailable.
            }
        })();
    }, [attemptId]);

    async function handlePublish(publish: boolean) {
        setPublishLoading(true);
        setPublishSuccess(false);
        setPublishError(null);
        try {
            const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ comment, is_published: publish }),
            });
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const data = await res.json();
            setIsPublished(data.is_published);
            setComment(data.comment ?? "");
            setPublishSuccess(true);
            setTimeout(() => setPublishSuccess(false), 3000);
        } catch (e: any) {
            setPublishError(e.message || "Не удалось сохранить публикацию");
        } finally {
            setPublishLoading(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                            <FileText size={16} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-gray-900">{studentName}</div>
                            {results && (
                                <div className="text-[11px] text-gray-400">
                                    {results.primary_score ?? "—"} первичных · {results.score != null ? Math.round(results.score) : "—"} баллов ЕГЭ
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {resultsLoading ? (
                        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                            <Loader2 size={24} className="animate-spin text-emerald-500" />
                            <span className="text-sm">Загрузка...</span>
                        </div>
                    ) : resultsError ? (
                        <div className="text-sm text-red-500 text-center py-8">{resultsError}</div>
                    ) : results && results.task_results.length > 0 ? (
                        <div className="space-y-2">
                            {results.task_results
                                .slice()
                                .sort((a, b) => (a.ege_number ?? 99) - (b.ege_number ?? 99))
                                .map(r => <TaskResultCard key={r.task_id} r={r} />)
                            }
                        </div>
                    ) : (
                        <div className="text-center py-16 text-gray-400 text-sm">Нет данных о решениях</div>
                    )}

                    <div className="border-t border-gray-100 pt-4 space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">
                                Комментарий учителя
                            </label>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Напишите комментарий ученику по результатам пробника..."
                                rows={4}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-gray-300 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            {isPublished ? (
                                <>
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg font-semibold flex-1">
                                        <Globe size={12} /> Опубликовано
                                    </div>
                                    <button
                                        onClick={() => handlePublish(false)}
                                        disabled={publishLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {publishLoading ? <Loader2 size={12} className="animate-spin" /> : <GlobeLock size={12} />}
                                        Снять
                                    </button>
                                    <button
                                        onClick={() => handlePublish(true)}
                                        disabled={publishLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {publishLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                        Обновить
                                    </button>
                                </>
                            ) : (
                                <>
                                    {publishSuccess && (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 flex-1">
                                            <CheckCircle2 size={12} /> Сохранено
                                        </div>
                                    )}
                                    {publishError && (
                                        <div className="text-xs text-red-500 flex-1">{publishError}</div>
                                    )}
                                    <button
                                        onClick={() => handlePublish(false)}
                                        disabled={publishLoading}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-colors disabled:opacity-50 ml-auto"
                                    >
                                        {publishLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Сохранить
                                    </button>
                                    <button
                                        onClick={() => handlePublish(true)}
                                        disabled={publishLoading}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                                    >
                                        {publishLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                                        Опубликовать
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
