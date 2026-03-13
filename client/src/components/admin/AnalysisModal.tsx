import { useState, useEffect } from "react";
import { Sparkles, Loader2, X, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { clsx } from "clsx";

const API_BASE = "/api";
const CACHE_KEY = (id: number) => `ai_analysis_attempt_${id}`;

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
    hasAnalysis?: boolean;
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
                {/* Task number badge */}
                <div className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                    color === "emerald" && "bg-emerald-100 text-emerald-700",
                    color === "amber" && "bg-amber-100 text-amber-700",
                    color === "red" && "bg-red-100 text-red-600",
                )}>
                    {r.ege_number ?? "?"}
                </div>

                {/* Icon */}
                {r.is_correct
                    ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    : r.points > 0
                        ? <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                        : <XCircle size={16} className="text-red-400 shrink-0" />
                }

                {/* Answers */}
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

                {/* Points */}
                <div className={clsx(
                    "text-xs font-bold shrink-0 px-2 py-1 rounded-lg",
                    color === "emerald" && "text-emerald-700 bg-emerald-100",
                    color === "amber" && "text-amber-700 bg-amber-100",
                    color === "red" && "text-red-600 bg-red-100",
                )}>
                    {r.points}/{r.max_points}
                </div>
            </div>

            {/* Code solution */}
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

            {/* File solution link */}
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

export function AnalysisModal({ studentName, attemptId, apiKey, hasAnalysis, onClose }: Props) {
    const cached = localStorage.getItem(CACHE_KEY(attemptId));
    const [tab, setTab] = useState<"results" | "ai">("results");
    const [analysis, setAnalysis] = useState<string | null>(cached);
    const [aiLoading, setAiLoading] = useState(!cached && !!hasAnalysis);
    const [aiError, setAiError] = useState<string | null>(null);
    const [results, setResults] = useState<{ primary_score: number | null; score: number | null; task_results: TaskResult[] } | null>(null);
    const [resultsLoading, setResultsLoading] = useState(true);
    const [resultsError, setResultsError] = useState<string | null>(null);

    const authHeaders = (): Record<string, string> => {
        const token = localStorage.getItem("jwt_token");
        const h: Record<string, string> = {};
        if (apiKey) h["X-API-Key"] = apiKey;
        if (token) h["Authorization"] = `Bearer ${token}`;
        return h;
    };

    // Load attempt results
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

    // Auto-load saved AI analysis
    useEffect(() => {
        if (!cached && hasAnalysis) fetchSavedAnalysis();
    }, []);

    async function fetchSavedAnalysis() {
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/analyze`, { headers: authHeaders() });
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const data = await res.json();
            setAnalysis(data.analysis);
            localStorage.setItem(CACHE_KEY(attemptId), data.analysis);
        } catch (e: any) {
            setAiError(e.message || "Не удалось загрузить анализ");
        } finally {
            setAiLoading(false);
        }
    }

    async function runAnalysis() {
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
            });
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const data = await res.json();
            setAnalysis(data.analysis);
            localStorage.setItem(CACHE_KEY(attemptId), data.analysis);
        } catch (e: any) {
            setAiError(e.message || "Не удалось получить анализ");
        } finally {
            setAiLoading(false);
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
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center">
                            <Sparkles size={16} />
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
                    <div className="flex items-center gap-1">
                        {tab === "ai" && analysis && !aiLoading && (
                            <button onClick={runAnalysis} title="Обновить анализ"
                                className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                                <RefreshCw size={15} />
                            </button>
                        )}
                        <button onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-3 pb-0 shrink-0">
                    {([["results", "Решения"], ["ai", "Анализ ИИ"]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={clsx(
                                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                tab === key ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"
                            )}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {tab === "results" ? (
                        resultsLoading ? (
                            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                                <Loader2 size={24} className="animate-spin text-violet-400" />
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
                        )
                    ) : (
                        // AI Analysis tab
                        aiLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                                <Loader2 size={28} className="animate-spin text-violet-500" />
                                <span className="text-sm">Загружаю анализ...</span>
                            </div>
                        ) : analysis ? (
                            <div className="prose prose-sm max-w-none text-gray-700
                                [&>h1]:text-base [&>h1]:font-bold [&>h1]:text-gray-900
                                [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mt-4
                                [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mt-3
                                [&>p]:leading-relaxed [&>p]:mb-2
                                [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:pl-4 [&>ol]:mb-2
                                [&>li]:mb-1
                                [&>strong]:text-gray-900
                                [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
                                [&>pre]:bg-gray-50 [&>pre]:rounded-xl [&>pre]:p-4 [&>pre]:text-xs [&>pre]:overflow-x-auto
                                [&>blockquote]:border-l-4 [&>blockquote]:border-violet-200 [&>blockquote]:pl-4 [&>blockquote]:text-gray-500">
                                <ReactMarkdown>{analysis}</ReactMarkdown>
                            </div>
                        ) : aiError ? (
                            <div className="text-sm text-red-500 text-center py-8">{aiError}</div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                                <div className="w-14 h-14 bg-violet-100 text-violet-500 rounded-2xl flex items-center justify-center">
                                    <Sparkles size={28} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 mb-1">ИИ-анализ работы</p>
                                    <p className="text-sm text-gray-400 max-w-xs">
                                        ИИ разберёт каждую ошибку, сравнит с эталонным решением и подскажет что повторить
                                    </p>
                                </div>
                                <button
                                    onClick={runAnalysis}
                                    className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20 mt-2"
                                >
                                    <Sparkles size={16} /> Запустить анализ
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
