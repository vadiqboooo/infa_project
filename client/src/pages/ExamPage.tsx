import React, { useState, useEffect, useRef, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Timer, Send, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Save, Check, Code, Paperclip, X, FileText, Eye, Upload, Loader2, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import ReactMarkdown from "react-markdown";
import { useTask, useNavigation, useExamByTopic, useStartExam, useSubmitExam, useSaveCodeSolution, useCheckCode } from "../hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import TaskView from "../components/TaskView";
import AnswerInput from "../components/AnswerInput";
import Skeleton from "../components/Skeleton";
import type { AnswerVal, TaskNav, TaskResult } from "../api/types";
import confetti from "canvas-confetti";

export default function ExamPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: allTopics, isLoading: navLoading } = useNavigation();
    
    const queryClient = useQueryClient();

    const currentTopic = useMemo(() => {
        return allTopics?.find(t => String(t.id) === id);
    }, [allTopics, id]);

    const tasks: TaskNav[] = currentTopic?.tasks ?? [];
    const [taskIndex, setTaskIndex] = useState(0);
    const [examAnswers, setExamAnswers] = useState<Record<number, AnswerVal>>({});
    const [currentAnswer, setCurrentAnswer] = useState<AnswerVal>("");
    const [examResult, setExamResult] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Solution attachment state
    const CODE_TASK_NUMS = new Set([2,5,6,7,8,9,11,13,14,15,16,17,23,24,25,26,27]);
    const FILE_TASK_NUMS = new Set([3,18,22]);
    const [codeSolutions, setCodeSolutions] = useState<Record<number, string>>({});
    const [fileSolutions, setFileSolutions] = useState<Record<number, File>>({});
    const [solutionPanelTaskId, setSolutionPanelTaskId] = useState<number | null>(null);
    const [localCode, setLocalCode] = useState("");
    const [viewingCode, setViewingCode] = useState<string | null>(null);

    // Review panel state (view task after exam)
    const [reviewTaskId, setReviewTaskId] = useState<number | null>(null);
    const [reviewCodeEdits, setReviewCodeEdits] = useState<Record<number, string>>({});
    const [codeCheckResults, setCodeCheckResults] = useState<Record<number, string>>({});
    const [reviewFileUploading, setReviewFileUploading] = useState<Record<number, boolean>>({});
    const [reviewSavedCodes, setReviewSavedCodes] = useState<Record<number, string>>({});

    const currentTaskNav = tasks[taskIndex] ?? null;
    const { data: examInfo, isLoading: examLoading } = useExamByTopic(currentTopic?.id ?? null);
    const { data: task, isLoading: taskLoading } = useTask(currentTaskNav?.id ?? null);
    const { data: reviewTask, isLoading: reviewTaskLoading } = useTask(reviewTaskId);

    const startExamMutation = useStartExam(examInfo?.id ?? 0);
    const submitExamMutation = useSubmitExam(examInfo?.id ?? 0);
    const finishedAttemptId = (examResult?.attempt_id) ?? (examInfo?.finished_attempt?.id) ?? 0;
    const saveCodeMutation = useSaveCodeSolution(finishedAttemptId);
    const checkCodeMutation = useCheckCode(finishedAttemptId);

    const questionsScrollRef = useRef<HTMLDivElement>(null);

    // Sync currentAnswer when task changes
    useEffect(() => {
        if (task) {
            setCurrentAnswer(examAnswers[task.id] ?? "");
        }
    }, [task?.id]);

    const isAnswerChanged = useMemo(() => {
        if (!task) return false;
        const saved = JSON.stringify(examAnswers[task.id] ?? "");
        const current = JSON.stringify(currentAnswer);
        return saved !== current;
    }, [task, examAnswers, currentAnswer]);

    const isAnswerSaved = useMemo(() => {
        if (!task) return false;
        const saved = examAnswers[task.id];
        return saved !== undefined && saved !== "" && JSON.stringify(saved) !== JSON.stringify([]);
    }, [task, examAnswers]);

    const handleSaveAnswer = () => {
        if (task) {
            setExamAnswers(prev => ({ ...prev, [task.id]: currentAnswer }));
        }
    };

    // Timer logic
    useEffect(() => {
        if (examInfo?.active_attempt && timeLeft === null) {
            const startedAt = new Date(examInfo.active_attempt.started_at).getTime();
            const limitMs = examInfo.time_limit_minutes * 60 * 1000;
            const now = new Date().getTime();
            const remaining = Math.max(0, Math.floor((startedAt + limitMs - now) / 1000));
            setTimeLeft(remaining);
        }
    }, [examInfo, timeLeft]);

    useEffect(() => {
        if (timeLeft !== null && timeLeft > 0 && !examResult) {
            const timer = setInterval(() => setTimeLeft(prev => (prev !== null ? prev - 1 : null)), 1000);
            return () => clearInterval(timer);
        } else if (timeLeft === 0 && !examResult) {
            handleAutoSubmit();
        }
    }, [timeLeft, examResult]);

    // Auto-scroll question bar
    useEffect(() => {
        if (questionsScrollRef.current) {
            const container = questionsScrollRef.current;
            const activeBtn = container.children[taskIndex] as HTMLElement;
            if (activeBtn) {
                const left = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2;
                container.scrollTo({ left, behavior: 'smooth' });
            }
        }
    }, [taskIndex]);

    const handleStart = async () => {
        if (!examInfo) return;
        try {
            const resp = await startExamMutation.mutateAsync();
            setTimeLeft(resp.time_limit_minutes * 60);
            setExamAnswers({});
            queryClient.invalidateQueries({ queryKey: ["navigation"] });
        } catch (err) {
            alert("Не удалось начать экзамен");
        }
    };

    const handleAutoSubmit = () => {
        if (!examResult) {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!examInfo || isSubmitting) return;
        if (timeLeft !== 0 && !confirm("Вы уверены, что хотите завершить экзамен и отправить ответы?")) return;

        setIsSubmitting(true);
        try {
            const payload = {
                answers: tasks.map(t => ({
                    task_id: t.id,
                    answer: { val: examAnswers[t.id] ?? "" }
                })),
                code_solutions: Object.entries(codeSolutions)
                    .filter(([_, code]) => code.trim())
                    .map(([taskId, code]) => ({ task_id: Number(taskId), code })),
            };
            const res = await submitExamMutation.mutateAsync(payload);

            // Upload file solutions after submit (non-blocking failures)
            const token = localStorage.getItem("jwt_token");
            for (const [taskIdStr, file] of Object.entries(fileSolutions)) {
                try {
                    const formData = new FormData();
                    formData.append("file", file);
                    await fetch(`/api/exams/attempt/${res.attempt_id}/upload/${taskIdStr}`, {
                        method: "POST",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: formData,
                    });
                } catch { /* file upload failure is non-critical */ }
            }

            setExamResult(res);
            queryClient.invalidateQueries({ queryKey: ["navigation"] });
            if (res.score >= 80) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            alert("Ошибка при отправке ответов");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (navLoading || examLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#F8F7F4] gap-4">
                <div className="w-12 h-12 border-4 border-[#3F8C62] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Загрузка варианта...</p>
            </div>
        );
    }

    if (!currentTopic || !examInfo) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#F8F7F4] p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle size={32} />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Вариант не найден</h1>
                <p className="text-gray-500 mb-6 text-sm max-w-xs">Данный вариант еще не настроен или был удален администратором.</p>
                <button onClick={() => navigate('/exams')} className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                    К списку вариантов
                </button>
            </div>
        );
    }

    // Result Screen — mock category: hide scores, show "results recorded" message
    const isMock = String(currentTopic?.category) === "mock";
    if (isMock && (examResult || (examInfo.finished_attempt && !examInfo.active_attempt))) {
        return (
            <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
                <div className="bg-white border border-gray-200 rounded-[32px] p-10 max-w-md w-full text-center shadow-xl shadow-gray-200/50">
                    <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">Ответы записаны</h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        Вы завершили пробный экзамен. Ваши ответы зафиксированы и будут проверены преподавателем. Результаты сообщат после проверки.
                    </p>
                    <button
                        onClick={() => navigate('/exams')}
                        className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20"
                    >
                        Вернуться к вариантам
                    </button>
                </div>
            </div>
        );
    }

    // Result Screen
    if (examResult || (examInfo.finished_attempt && !examInfo.active_attempt)) {
        const result = examResult || examInfo.finished_attempt;
        const taskResults: TaskResult[] = result.task_results || result.results?.task_results || [];

        const formatAnswer = (answer: any): string => {
            if (answer === null || answer === undefined) return "—";
            const v = answer.val !== undefined ? answer.val : answer;
            if (v === null || v === undefined || v === "") return "—";
            if (Array.isArray(v)) {
                if (Array.isArray(v[0])) {
                    return v.map((row: any[]) => row.join("; ")).join(" | ");
                }
                return v.join("; ");
            }
            return String(v);
        };

        const sortedResults = [...taskResults].sort((a, b) => (a.ege_number || 0) - (b.ege_number || 0));
        const firstHalf = sortedResults.slice(0, 14);
        const secondHalf = sortedResults.slice(14);


        const ResultRow = ({ tr, idx }: { tr: TaskResult; idx: number }) => {
            const max = tr.max_points ?? ((tr.ege_number && tr.ege_number >= 26) ? 2 : 1);
            const notAutoChecked = tr.auto_checked === false;
            const hasAttachment = tr.code_solution || tr.file_solution_url || reviewSavedCodes[tr.task_id];
            return (
                <tr
                    key={tr.task_id}
                    className={clsx(
                        "transition-colors cursor-pointer",
                        tr.is_correct ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                            : tr.points > 0 ? "bg-amber-50/40 hover:bg-amber-50/70"
                            : "hover:bg-gray-50/80"
                    )}
                    onClick={() => setReviewTaskId(tr.task_id)}
                >
                    <td className="py-2 px-2 font-bold text-gray-700 text-sm w-8 border-b border-gray-200">
                        {tr.ege_number || idx + 1}
                    </td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-xs max-w-[80px] truncate border-b border-gray-200">
                        {formatAnswer(tr.user_answer)}
                    </td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-xs max-w-[80px] truncate border-b border-gray-200">
                        {notAutoChecked
                            ? <span className="text-[10px] text-gray-400 italic">по решению</span>
                            : formatAnswer(tr.correct_answer)
                        }
                    </td>
                    <td className="py-2 px-2 text-center border-b border-gray-200">
                        <div className="flex items-center justify-center gap-1">
                            {notAutoChecked ? (
                                <span className="inline-flex items-center justify-center px-1.5 h-6 rounded-md text-[10px] font-bold bg-gray-100 text-gray-400">
                                    —
                                </span>
                            ) : (
                                <span className={clsx(
                                    "inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded-md text-xs font-bold",
                                    tr.points === max
                                        ? "bg-[#3F8C62] text-white"
                                        : tr.points > 0
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-gray-100 text-gray-400"
                                )}>
                                    {tr.points}/{max}
                                </span>
                            )}
                            {hasAttachment && (
                                <span title="Есть решение" className="text-purple-400">
                                    <Code size={13} />
                                </span>
                            )}
                            {tr.file_solution_url && (
                                <span title="Прикреплён файл" className="text-blue-400">
                                    <Paperclip size={13} />
                                </span>
                            )}
                            <span className="text-gray-300 hover:text-gray-500 transition-colors ml-0.5">
                                <Eye size={12} />
                            </span>
                        </div>
                    </td>
                </tr>
            );
        };

        const TableHead = () => (
            <thead>
                <tr className="bg-gray-50">
                    <th className="text-left py-2 px-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider w-8 border-b-2 border-gray-200">№</th>
                    <th className="text-left py-2 px-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b-2 border-gray-200">Ваш</th>
                    <th className="text-left py-2 px-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b-2 border-gray-200">Верный</th>
                    <th className="text-center py-2 px-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b-2 border-gray-200">Балл</th>
                </tr>
            </thead>
        );

        return (
            <div className="min-h-screen bg-[#F8F7F4]">
                {/* Header — back button + score card в одной строке */}
                <div className="bg-white border-b border-gray-200 shadow-sm">
                    <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-5">
                        {/* Кнопка назад */}
                        <button
                            onClick={() => navigate('/exams')}
                            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors shrink-0"
                        >
                            <ArrowLeft size={16} />
                            Назад
                        </button>

                        <div className="w-px h-8 bg-gray-200 shrink-0" />

                        {/* Иконка + название */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                <CheckCircle2 size={18} />
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-0.5">Вариант завершен</div>
                                <div className="text-sm font-bold text-gray-800 truncate max-w-[220px]">{currentTopic.title}</div>
                            </div>
                        </div>

                        <div className="w-px h-8 bg-gray-200 shrink-0" />

                        {/* Метрики — занимают оставшееся пространство */}
                        <div className="flex items-center gap-8 flex-1">
                            <div>
                                <div className="text-2xl font-black text-[#3F8C62] leading-none">{result.score.toFixed(0)}</div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">тест. балл</div>
                            </div>
                            <div className="w-px h-6 bg-gray-100" />
                            <div>
                                <div className="text-lg font-bold text-gray-900 leading-none">{result.primary_score}<span className="text-gray-300 font-normal text-sm">/29</span></div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">первичный</div>
                            </div>
                            <div className="w-px h-6 bg-gray-100" />
                            <div>
                                <div className="text-lg font-bold text-gray-900 leading-none">
                                    {result.correct_count ?? taskResults.filter(r => r.is_correct).length}
                                    <span className="text-gray-300 font-normal text-sm">/{result.total_tasks ?? taskResults.length}</span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">верных</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="max-w-5xl mx-auto px-6 py-6">
                    {taskResults.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-100">
                                <h2 className="text-sm font-bold text-gray-700">Подробные результаты</h2>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-gray-200">
                                <table className="w-full text-sm border-collapse">
                                    <TableHead />
                                    <tbody>
                                        {firstHalf.map((tr, idx) => (
                                            <ResultRow key={tr.task_id} tr={tr} idx={idx} />
                                        ))}
                                    </tbody>
                                </table>
                                <table className="w-full text-sm border-collapse">
                                    <TableHead />
                                    <tbody>
                                        {secondHalf.map((tr, idx) => (
                                            <ResultRow key={tr.task_id} tr={tr} idx={idx + 14} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

            {/* Review Panel — slide-out for viewing task after exam */}
            {reviewTaskId && (() => {
                const currentTR = sortedResults.find(r => r.task_id === reviewTaskId);
                const max = currentTR ? (currentTR.max_points ?? ((currentTR.ege_number && currentTR.ege_number >= 26) ? 2 : 1)) : 1;
                const notAutoChecked = currentTR?.auto_checked === false;
                const egeNum = currentTR?.ege_number ?? null;
                const isCodeTask = egeNum !== null && CODE_TASK_NUMS.has(egeNum);
                const isFileTask = egeNum !== null && FILE_TASK_NUMS.has(egeNum);
                const currentCode = reviewCodeEdits[reviewTaskId] ?? currentTR?.code_solution ?? reviewSavedCodes[reviewTaskId] ?? "";
                const checkResult = codeCheckResults[reviewTaskId];
                const isCheckLoading = checkCodeMutation.isPending;
                const isSaveLoading = saveCodeMutation.isPending;
                const isFileUploading = reviewFileUploading[reviewTaskId] ?? false;

                const handleSaveCode = async () => {
                    try {
                        await saveCodeMutation.mutateAsync({ taskId: reviewTaskId, code: currentCode });
                        setReviewSavedCodes(prev => ({ ...prev, [reviewTaskId]: currentCode }));
                    } catch { /* ignore */ }
                };

                const handleCheckCode = async () => {
                    try {
                        const res = await checkCodeMutation.mutateAsync({ taskId: reviewTaskId });
                        setCodeCheckResults(prev => ({ ...prev, [reviewTaskId]: res.analysis }));
                    } catch { /* ignore */ }
                };

                const handleFileUpload = async (file: File) => {
                    setReviewFileUploading(prev => ({ ...prev, [reviewTaskId]: true }));
                    try {
                        const token = localStorage.getItem("jwt_token");
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch(`/api/exams/attempt/${finishedAttemptId}/upload/${reviewTaskId}`, {
                            method: "POST",
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                            body: formData,
                        });
                        if (res.ok) {
                            // update local result
                            const data = await res.json();
                            if (examResult) {
                                const updated = { ...examResult };
                                const tr = updated.task_results?.find((r: TaskResult) => r.task_id === reviewTaskId);
                                if (tr) tr.file_solution_url = data.file_url;
                                setExamResult(updated);
                            }
                        }
                    } catch { /* ignore */ }
                    setReviewFileUploading(prev => ({ ...prev, [reviewTaskId]: false }));
                };

                return (
                    <>
                        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setReviewTaskId(null)} />
                        <div className="fixed top-0 right-0 h-full w-[600px] max-w-[95vw] bg-white z-50 shadow-2xl flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                                        <Eye size={15} className="text-gray-500" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-900 text-sm">Задание №{egeNum ?? reviewTaskId}</h2>
                                        <p className="text-[11px] text-gray-400 mt-0.5">Просмотр (только чтение)</p>
                                    </div>
                                </div>
                                <button onClick={() => setReviewTaskId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto">
                                {reviewTaskLoading ? (
                                    <div className="p-6 space-y-3">
                                        <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                                        <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                                        <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                                    </div>
                                ) : reviewTask ? (
                                    <div className="px-6 py-4 space-y-4">
                                        {/* Task content */}
                                        <TaskView content={reviewTask.content_html} />

                                        {/* Answer summary */}
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex flex-wrap gap-6 text-xs">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ваш ответ</div>
                                                    <div className="font-mono text-gray-700">{formatAnswer(currentTR?.user_answer)}</div>
                                                </div>
                                                {!notAutoChecked && (
                                                    <div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Верный ответ</div>
                                                        <div className="font-mono text-gray-700">{formatAnswer(currentTR?.correct_answer)}</div>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Баллы</div>
                                                    <div className={clsx("font-bold", notAutoChecked ? "text-gray-400" : currentTR?.points === max ? "text-[#3F8C62]" : currentTR?.points ?? 0 > 0 ? "text-amber-600" : "text-gray-400")}>
                                                        {notAutoChecked ? "Не проверено" : `${currentTR?.points ?? 0}/${max}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Code solution section */}
                                        {isCodeTask && (
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Решение (код Python)</div>
                                                <div className="rounded-xl overflow-hidden border border-gray-200">
                                                    <CodeMirror
                                                        value={currentCode}
                                                        onChange={val => setReviewCodeEdits(prev => ({ ...prev, [reviewTaskId]: val }))}
                                                        extensions={[python()]}
                                                        theme={githubLight}
                                                        basicSetup={{ lineNumbers: true, foldGutter: false }}
                                                        style={{ fontSize: "13px" }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button
                                                        onClick={handleSaveCode}
                                                        disabled={isSaveLoading || !currentCode.trim()}
                                                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#3F8C62] text-white hover:bg-[#357A54] disabled:opacity-50 transition-colors"
                                                    >
                                                        {isSaveLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                        Сохранить
                                                    </button>
                                                    {reviewTask.full_solution_code && currentCode.trim() && (
                                                        <button
                                                            onClick={handleCheckCode}
                                                            disabled={isCheckLoading}
                                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                                        >
                                                            {isCheckLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                            Проверить ошибки
                                                        </button>
                                                    )}
                                                </div>
                                                {checkResult && (
                                                    <div className="mt-3 p-4 bg-purple-50 rounded-xl border border-purple-100 prose prose-sm max-w-none text-gray-700">
                                                        <ReactMarkdown>{checkResult}</ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* File solution section */}
                                        {isFileTask && (
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Файл решения</div>
                                                {currentTR?.file_solution_url ? (
                                                    <a
                                                        href={currentTR.file_solution_url}
                                                        download
                                                        className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                                    >
                                                        <Paperclip size={12} />
                                                        Скачать файл
                                                    </a>
                                                ) : null}
                                                <label className={clsx("inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ml-2", isFileUploading ? "opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100")}>
                                                    {isFileUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                    {currentTR?.file_solution_url ? "Заменить файл" : "Прикрепить файл"}
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept=".xlsx,.xls,.csv,.ods"
                                                        disabled={isFileUploading}
                                                        onChange={e => {
                                                            const f = e.target.files?.[0];
                                                            if (f) handleFileUpload(f);
                                                        }}
                                                    />
                                                </label>
                                                <p className="text-[10px] text-gray-400 mt-1">Поддерживаемые форматы: xlsx, xls, csv, ods</p>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </>
                );
            })()}

            </div>
        );
    }

    // Pre-start Screen
    if (!examInfo.active_attempt) {
        return (
            <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
                <div className="bg-white border border-gray-200 rounded-[32px] p-10 max-w-lg w-full text-center shadow-xl shadow-gray-200/50">
                    <div className="w-16 h-16 bg-[#3F8C62]/10 text-[#3F8C62] rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Clock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{currentTopic.title}</h1>
                    <p className="text-gray-500 text-sm mb-8">
                        {isMock
                            ? "Пробный экзамен — результаты будут проверены преподавателем"
                            : "Контрольный вариант для проверки знаний"}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-10">
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <div className="text-lg font-bold text-gray-900">{examInfo.task_count}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Заданий</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <div className="text-lg font-bold text-gray-900">{examInfo.time_limit_minutes}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Минут</div>
                        </div>
                    </div>

                    <div className="space-y-4 mb-10 text-left bg-amber-50 rounded-2xl p-5 border border-amber-100">
                        <div className="flex gap-3">
                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                            <div className="text-xs text-amber-800 leading-relaxed">
                                <p className="font-bold mb-1">Важные правила:</p>
                                <ul className="list-disc ml-4 space-y-1">
                                    <li>ИИ-ассистент будет отключен на время теста</li>
                                    <li>Вы не сможете проверить ответ до конца варианта</li>
                                    <li>Таймер нельзя поставить на паузу</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={handleStart}
                            disabled={startExamMutation.isPending}
                            className="w-full py-3.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#3F8C62]/20 disabled:opacity-50"
                        >
                            {startExamMutation.isPending ? "Подготовка..." : "Начать вариант"}
                        </button>
                        <button 
                            onClick={() => navigate('/exams')}
                            className="w-full py-3.5 text-gray-500 hover:text-gray-700 font-bold transition-all"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Active Exam Workspace
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[#F8F7F4]">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 bg-white shrink-0 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[#3F8C62]">
                        <Clock size={18} />
                        <span className="font-mono text-lg font-bold">
                            {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                        </span>
                    </div>
                    <div className="w-px h-5 bg-gray-200 mx-2" />
                    <h1 className="font-bold text-gray-900 truncate max-w-[300px]">
                        {currentTopic.title}
                    </h1>
                </div>
                
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-[#3F8C62] hover:bg-[#357A54] text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#3F8C62]/20 disabled:opacity-50 flex items-center gap-2"
                >
                    <Send size={14} />
                    {isSubmitting ? "Отправка..." : "Завершить"}
                </button>
            </div>

            {/* Solution drawer panel */}
            {solutionPanelTaskId !== null && (() => {
                const egeNum = task?.id === solutionPanelTaskId ? task?.ege_number ?? null : null;
                const isFileTask = egeNum !== null && FILE_TASK_NUMS.has(egeNum);
                return (
                    <div className="fixed inset-0 z-50 flex">
                        <div className="flex-1 bg-black/20" onClick={() => setSolutionPanelTaskId(null)} />
                        <div className="w-[520px] bg-white h-full shadow-2xl flex flex-col border-l border-gray-200">
                            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                                <div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">
                                        {egeNum ? `Задание ${egeNum}` : "Задание"}
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm">
                                        {isFileTask ? "Прикрепить файл таблицы" : "Решение (код)"}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setSolutionPanelTaskId(null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 p-5 overflow-y-auto">
                                {isFileTask ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-500">
                                            Прикрепите файл электронной таблицы (.xlsx, .xls, .csv, .ods)
                                        </p>
                                        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                            <FileText size={28} className="text-gray-300 mb-2" />
                                            <span className="text-sm text-gray-400 font-medium">
                                                {fileSolutions[solutionPanelTaskId]
                                                    ? fileSolutions[solutionPanelTaskId].name
                                                    : "Нажмите или перетащите файл"}
                                            </span>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.csv,.ods"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setFileSolutions(prev => ({ ...prev, [solutionPanelTaskId]: file }));
                                                }}
                                            />
                                        </label>
                                        {fileSolutions[solutionPanelTaskId] && (
                                            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                                <Check size={14} />
                                                {fileSolutions[solutionPanelTaskId].name}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col gap-3">
                                        <p className="text-sm text-gray-500 shrink-0">
                                            Вставьте код вашего решения ниже
                                        </p>
                                        <div className="flex-1 min-h-[400px] border border-gray-200 rounded-xl overflow-hidden text-sm">
                                            <CodeMirror
                                                value={localCode}
                                                onChange={(val) => setLocalCode(val)}
                                                extensions={[python()]}
                                                theme={githubLight}
                                                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                                                style={{ height: "100%", fontSize: "13px" }}
                                                placeholder="# Вставьте код здесь..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-gray-100 shrink-0">
                                <button
                                    onClick={() => {
                                        if (!isFileTask) {
                                            setCodeSolutions(prev => ({ ...prev, [solutionPanelTaskId]: localCode }));
                                        }
                                        setSolutionPanelTaskId(null);
                                    }}
                                    className="w-full py-3 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#3F8C62]/20"
                                >
                                    {isFileTask
                                        ? (fileSolutions[solutionPanelTaskId] ? "Готово" : "Закрыть")
                                        : "Сохранить решение"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 pt-6">
                    {/* Navigation bar */}
                    <div 
                        ref={questionsScrollRef}
                        className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide no-scrollbar"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {tasks.map((t, idx) => {
                            const hasAnswer = examAnswers[t.id] !== undefined && examAnswers[t.id] !== "";
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTaskIndex(idx)}
                                    className={clsx(
                                        'w-10 h-10 shrink-0 rounded-xl text-sm font-bold transition-all flex items-center justify-center border-2',
                                        idx === taskIndex
                                            ? 'bg-[#3F8C62] border-[#3F8C62] text-white shadow-md'
                                            : hasAnswer
                                                ? 'bg-emerald-50 border-emerald-200 text-[#3F8C62]'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600'
                                    )}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>

                    {/* Task Content Area */}
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        <div className="flex-1 w-full bg-white border border-gray-200 rounded-[24px] p-8 min-h-[400px] shadow-sm relative">
                            {taskLoading ? (
                                <Skeleton />
                            ) : task ? (
                                <>
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                            Задание {taskIndex + 1}
                                        </span>
                                        <span className="bg-emerald-50 text-[#3F8C62] px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                            {(taskIndex + 1) >= 26 ? "2 балла" : "1 балл"}
                                        </span>
                                        <span className="text-gray-300 mx-1">•</span>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">
                                            {task.title || "Вариант ЕГЭ"}
                                        </span>
                                    </div>
                                    <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed text-lg">
                                        <TaskView
                                            content={task.content_html}
                                            files={task.media_resources?.files}
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Right Panel: Answer */}
                        <div className="w-full lg:w-[320px] shrink-0">
                            <div className="bg-white border border-gray-200 rounded-[24px] p-6 shadow-sm">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">
                                    Ваш ответ
                                </label>
                                <div className="space-y-4">
                                    <AnswerInput
                                        type={task?.answer_type || 'single_number'}
                                        value={currentAnswer}
                                        onChange={setCurrentAnswer}
                                        disabled={isSubmitting}
                                        egeNumber={task?.ege_number}
                                    />

                                    <button
                                        onClick={handleSaveAnswer}
                                        disabled={isSubmitting || !isAnswerChanged}
                                        className={clsx(
                                            "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                                            isAnswerChanged 
                                                ? "bg-[#3F8C62] hover:bg-[#357A54] text-white shadow-[#3F8C62]/20" 
                                                : isAnswerSaved
                                                    ? "bg-emerald-50 text-[#3F8C62] shadow-none opacity-80 cursor-default"
                                                    : "bg-gray-50 text-gray-300 shadow-none cursor-default"
                                        )}
                                    >
                                        {isAnswerChanged ? (
                                            <>
                                                <Save size={16} />
                                                Сохранить ответ
                                            </>
                                        ) : isAnswerSaved ? (
                                            <>
                                                <Check size={16} />
                                                Ответ сохранен
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} />
                                                Сохранить ответ
                                            </>
                                        )}
                                    </button>
                                    
                                    {/* Solution attachment button */}
                                    {task?.ege_number && (CODE_TASK_NUMS.has(task.ege_number) || FILE_TASK_NUMS.has(task.ege_number)) && (
                                        <button
                                            onClick={() => {
                                                setSolutionPanelTaskId(task.id);
                                                setLocalCode(codeSolutions[task.id] || "");
                                            }}
                                            disabled={isSubmitting}
                                            className={clsx(
                                                "w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border",
                                                FILE_TASK_NUMS.has(task.ege_number)
                                                    ? fileSolutions[task.id]
                                                        ? "bg-blue-50 text-blue-600 border-blue-200"
                                                        : "bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 border-gray-200"
                                                    : codeSolutions[task.id]
                                                        ? "bg-purple-50 text-purple-600 border-purple-200"
                                                        : "bg-gray-50 text-gray-500 hover:bg-purple-50 hover:text-purple-600 border-gray-200"
                                            )}
                                        >
                                            {FILE_TASK_NUMS.has(task.ege_number) ? (
                                                <>
                                                    <Paperclip size={14} />
                                                    {fileSolutions[task.id] ? `${fileSolutions[task.id].name.slice(0, 18)}…` : "Прикрепить файл"}
                                                </>
                                            ) : (
                                                <>
                                                    <Code size={14} />
                                                    {codeSolutions[task.id] ? "Решение прикреплено ✓" : "Прикрепить решение"}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => setTaskIndex(prev => Math.max(0, prev - 1))}
                                            disabled={taskIndex === 0}
                                            className="flex-1 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 disabled:opacity-30 transition-all"
                                        >
                                            Назад
                                        </button>
                                        <button
                                            onClick={() => setTaskIndex(prev => Math.min(tasks.length - 1, prev + 1))}
                                            disabled={taskIndex === tasks.length - 1}
                                            className="flex-1 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 disabled:opacity-30 transition-all"
                                        >
                                            Вперед
                                        </button>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Заполнено</span>
                                            <span className="text-xs font-bold text-gray-900">
                                                {Object.keys(examAnswers).filter(k => examAnswers[Number(k)] !== "").length} / {tasks.length}
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-[#3F8C62] transition-all duration-500"
                                                style={{ width: `${(Object.keys(examAnswers).filter(k => examAnswers[Number(k)] !== "").length / tasks.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
