import { useState } from "react";
import { Sparkles, Loader2, X, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

const API_BASE = "/api";
const CACHE_KEY = (id: number) => `ai_analysis_attempt_${id}`;

interface Props {
    studentName: string;
    attemptId: number;
    apiKey?: string;
    hasAnalysis?: boolean;  // whether DB already has a saved analysis
    onClose: () => void;
}

export function AnalysisModal({ studentName, attemptId, apiKey, hasAnalysis, onClose }: Props) {
    const cached = localStorage.getItem(CACHE_KEY(attemptId));
    const [analysis, setAnalysis] = useState<string | null>(cached);
    const [loading, setLoading] = useState(!cached && !!hasAnalysis);
    const [error, setError] = useState<string | null>(null);

    // Auto-load from DB if analysis exists but not cached locally
    useState(() => {
        if (!cached && hasAnalysis) {
            fetchSaved();
        }
    });

    async function fetchSaved() {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("jwt_token");
            const headers: Record<string, string> = {};
            if (apiKey) headers["X-API-Key"] = apiKey;
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/analyze`, { headers });
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const data = await res.json();
            setAnalysis(data.analysis);
            localStorage.setItem(CACHE_KEY(attemptId), data.analysis);
        } catch (e: any) {
            setError(e.message || "Не удалось загрузить анализ");
        } finally {
            setLoading(false);
        }
    }

    async function runAnalysis() {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("jwt_token");
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (apiKey) headers["X-API-Key"] = apiKey;
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/analyze`, {
                method: "POST",
                headers,
            });
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            const data = await res.json();
            setAnalysis(data.analysis);
            localStorage.setItem(CACHE_KEY(attemptId), data.analysis);
        } catch (e: any) {
            setError(e.message || "Не удалось получить анализ");
        } finally {
            setLoading(false);
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
                            <div className="text-sm font-bold text-gray-900">Анализ ИИ</div>
                            <div className="text-[11px] text-gray-400">{studentName}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {analysis && !loading && (
                            <button
                                onClick={() => runAnalysis()}
                                title="Обновить анализ"
                                className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
                            >
                                <RefreshCw size={15} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
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
                    ) : error ? (
                        <div className="text-sm text-red-500 text-center py-8">{error}</div>
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
                                onClick={() => runAnalysis()}
                                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20 mt-2"
                            >
                                <Sparkles size={16} /> Запустить анализ
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
