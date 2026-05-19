import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import TaskView from "../components/TaskView";
import AnswerInput from "../components/AnswerInput";
import ChatWidget from "../components/ChatWidget";
import MentorPanel from "../components/MentorPanel";
import { TaskSolutionPanel } from "../components/TaskSolutionPanel";
import ExamIntro from "../components/ExamIntro";
import ExamTimer from "../components/ExamTimer";
import Skeleton from "../components/Skeleton";
import { ArrowLeft, Send, Bot, X, Code2, BookOpen, ChevronRight, CheckCircle2, HelpCircle, MessageSquare, Paperclip, ClipboardList, Lock, PenLine } from "lucide-react";
import { clsx } from "clsx";
import { useTask, useCheckAnswer, useNavigation, useExamByTopic, useStartExam, useSubmitExam, useSaveExamDraftAnswer, useCurrentPreparationPlan } from "../hooks/useApi";
import { TopicCategory, type AnswerVal, type TaskNav, type TopicNav, type ExamResult } from "../api/types";
import confetti from "canvas-confetti";
import { StepByStepSolution } from "../components/StepByStepSolution";
import "./TasksPage.css";

interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
}

// ── Таб категории (Разбор / Домашка) — стиль как на странице вариантов ──
function CategoryTab({
  label,
  counts,
  isActive,
  disabled,
  onClick,
}: {
  label: string;
  counts: { solved: number; total: number; left: number };
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-all duration-200 border shrink-0",
        isActive
          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_8px_20px_rgba(16,185,129,0.16)]"
          : disabled
            ? "border-transparent bg-white/[0.04] text-slate-700 cursor-not-allowed"
            : "border-white/10 bg-white/[0.05] text-slate-400 hover:border-white/20 hover:text-white",
      )}
    >
      {label}
      {counts.left > 0 && (
        <span
          className={clsx(
            "text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums",
            isActive ? "bg-white/20 text-white" : "bg-white/10 text-slate-300",
          )}
        >
          {counts.left}
        </span>
      )}
    </button>
  );
}

export default function TasksPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    
    const [taskIndex, setTaskIndex] = useState(0);
    const [savedAnswers, setSavedAnswers] = useState<Record<number, AnswerVal>>(() => {
        try { return JSON.parse(localStorage.getItem('edu_task_answers') || '{}'); } catch { return {}; }
    });
    // Sub-task answers: keyed by `${taskId}:${subIndex}`
    const [savedSubAnswers, setSavedSubAnswers] = useState<Record<string, AnswerVal>>(() => {
        try { return JSON.parse(localStorage.getItem('edu_task_sub_answers') || '{}'); } catch { return {}; }
    });
    const [checkResult, setCheckResult] = useState<'correct' | 'wrong' | null>(null);
    const [subResults, setSubResults] = useState<boolean[] | null>(null);
    const [partialCorrect, setPartialCorrect] = useState<boolean[] | boolean[][] | null>(null);
    const [expectedAnswer, setExpectedAnswer] = useState<any>(null);
    const [showChat, setShowChat] = useState(true);
    const [mentorOpen, setMentorOpen] = useState(false);
    const [attachSolutionOpen, setAttachSolutionOpen] = useState(false);
    const [attachSolutionInitialTab, setAttachSolutionInitialTab] = useState<"code" | "file" | "image">("code");
    const [attachSolutionPrefillCode, setAttachSolutionPrefillCode] = useState("");
    const [solutionOpen, setSolutionOpen] = useState(false);
    const [drawingPanelOpen, setDrawingPanelOpen] = useState(false);
    const [examAnswers, setExamAnswers] = useState<Record<number, AnswerVal>>({});
    const [examResult, setExamResult] = useState<ExamResult | null>(null);
    const [viewingFinishedExam, setViewingFinishedExam] = useState(false);
    const attachSolutionBeforeCloseRef = useRef<(() => boolean) | null>(null);
    const appliedTaskDeepLinkRef = useRef<string | null>(null);
    const [pendingSolutionTaskId, setPendingSolutionTaskId] = useState<number | null>(null);

    const { data: allTopics, isLoading: navLoading } = useNavigation();
    const { data: currentPlan } = useCurrentPreparationPlan();

    const categoryFilter = useMemo(() => {
        if (location.pathname.startsWith('/homework')) return 'homework';
        if (location.pathname.startsWith('/exams')) return 'variants';
        return 'tutorial';
    }, [location.pathname]);

    const backPath = new URLSearchParams(location.search).get("from") === "home"
        ? "/"
        : categoryFilter === 'homework' ? '/homework' : categoryFilter === 'variants' ? '/exams' : '/tasks';

    const currentTopic = useMemo(() => {
        return allTopics?.find(t => String(t.id) === id);
    }, [allTopics, id]);

    // Sibling topics for tutorial/homework toggle (same ege_number).
    // Multiple topics in one category are shown as extra named tabs.
    const tutorialTopics = useMemo(() => {
        if (!allTopics || !currentTopic || currentTopic.ege_number == null) return [];
        return allTopics
            .filter(t => t.category === 'tutorial' && t.ege_number === currentTopic.ege_number)
            .sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
    }, [allTopics, currentTopic]);

    const homeworkTopics = useMemo(() => {
        if (!allTopics || !currentTopic || currentTopic.ege_number == null) return [];
        return allTopics
            .filter(t => t.category === 'homework' && t.ege_number === currentTopic.ege_number)
            .sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
    }, [allTopics, currentTopic]);

    const showModeTabs = (categoryFilter === 'tutorial' || categoryFilter === 'homework') && (tutorialTopics.length > 0 || homeworkTopics.length > 0);

    const getTopicCounts = (topic: TopicNav) => {
        const total = topic.tasks.length;
        const solved = topic.tasks.filter(t => t.status === 'solved').length;
        return { solved, total, left: Math.max(0, total - solved) };
    };

    const getTopicTabLabel = (topic: TopicNav, baseLabel: string, group: TopicNav[]) => {
        if (group.length <= 1) return baseLabel;
        const title = topic.title?.trim();
        if (!title) return baseLabel;
        return title;
    };

    useEffect(() => {
        if (allTopics && !currentTopic && id) {
            navigate(backPath);
        }
    }, [allTopics, currentTopic, id, navigate, backPath]);

    // Название топика — во вкладку браузера
    useEffect(() => {
        if (!currentTopic) return;
        const prev = document.title;
        document.title = currentTopic.title;
        return () => { document.title = prev; };
    }, [currentTopic]);

    const tasks: TaskNav[] = currentTopic?.tasks ?? [];
    const currentTaskNav = tasks[taskIndex] ?? null;

    useEffect(() => {
        setDrawingPanelOpen(false);
    }, [currentTaskNav?.id]);

    useEffect(() => {
        if (tasks.length === 0 || !tasks[taskIndex]?.is_locked) return;
        const firstOpenIndex = tasks.findIndex((item) => !item.is_locked);
        if (firstOpenIndex >= 0) {
            setTaskIndex(firstOpenIndex);
        }
    }, [taskIndex, tasks]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const taskParam = params.get("task");
        if (!taskParam || tasks.length === 0) return;
        if (appliedTaskDeepLinkRef.current === taskParam) return;
        const nextIndex = tasks.findIndex((item) => item.id === Number(taskParam));
        if (nextIndex >= 0 && !tasks[nextIndex]?.is_locked) {
            appliedTaskDeepLinkRef.current = taskParam;
            if (params.get("solution") === "1") {
                setPendingSolutionTaskId(Number(taskParam));
            }
            setTaskIndex((currentIndex) => nextIndex !== currentIndex ? nextIndex : currentIndex);
            params.delete("task");
            params.delete("solution");
            const nextSearch = params.toString();
            navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
        }
    }, [location.pathname, location.search, navigate, tasks]);

    const isVariant = currentTopic?.category === "variants";
    const canAnnotateTask = currentTopic != null && [
        TopicCategory.tutorial,
        TopicCategory.homework,
        TopicCategory.control,
        TopicCategory.variants,
        TopicCategory.mock,
        TopicCategory.math,
    ].includes(currentTopic.category);
    const { data: examInfo } = useExamByTopic(isVariant ? currentTopic?.id ?? null : null);
    const startExam = useStartExam(examInfo?.id ?? 0);
    const submitExam = useSubmitExam(examInfo?.id ?? 0);
    const saveExamDraftAnswer = useSaveExamDraftAnswer(examInfo?.active_attempt?.id ?? 0);
    const hasFinishedAttempt = examInfo?.finished_attempt != null;

    const openTaskId = currentTaskNav && !currentTaskNav.is_locked ? currentTaskNav.id : null;
    const { data: task, isLoading: taskLoading } = useTask(openTaskId);
    const isPlanTask = Boolean(
        currentPlan?.today_ege_numbers?.some((egeNumber) =>
            egeNumber === task?.ege_number || egeNumber === currentTopic?.ege_number,
        ),
    );
    const check = useCheckAnswer(openTaskId ?? 0);

    const reviewExamAttempt = viewingFinishedExam ? (examResult ?? examInfo?.finished_attempt ?? null) : null;
    const reviewExamAnswers = useMemo<Record<number, AnswerVal>>(() => {
        const taskResults = reviewExamAttempt?.task_results ?? [];
        const result: Record<number, AnswerVal> = {};
        taskResults.forEach((item) => {
            if (item.user_answer?.val !== undefined) {
                result[item.task_id] = item.user_answer.val;
            }
        });
        return result;
    }, [reviewExamAttempt]);

    useEffect(() => {
        if (!pendingSolutionTaskId || !task || task.id !== pendingSolutionTaskId) return;
        setMentorOpen(false);
        setAttachSolutionOpen(true);
        setPendingSolutionTaskId(null);
    }, [pendingSolutionTaskId, task]);

    const refreshCurrentTask = () => {
        if (!currentTaskNav?.id) return;
        queryClient.invalidateQueries({ queryKey: ["task", currentTaskNav.id] });
    };

    const clearSolutionDeepLink = () => {
        const params = new URLSearchParams(location.search);
        if (!params.has("solution") && !params.has("task")) return;
        params.delete("task");
        params.delete("solution");
        const nextSearch = params.toString();
        navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
    };

    const closeAttachSolutionNow = () => {
        setAttachSolutionOpen(false);
        clearSolutionDeepLink();
    };

    const closeAttachSolution = () => {
        if (attachSolutionBeforeCloseRef.current?.() === false) return;
        closeAttachSolutionNow();
    };

    const openProofSolutionPanel = (taskId: number, answerValue: AnswerVal, tab: "code" | "image") => {
        const proofText = Array.isArray(answerValue) && !Array.isArray(answerValue[0])
            ? String(answerValue[0] ?? "")
            : "";
        setMentorOpen(false);
        setAttachSolutionInitialTab(tab);
        setAttachSolutionPrefillCode(tab === "code" ? proofText : "");
        setAttachSolutionOpen(true);
        queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    };

    const selectTask = (index: number) => {
        if (tasks[index]?.is_locked) return;
        const currentTaskParam = new URLSearchParams(location.search).get("task");
        if (currentTaskParam) {
            appliedTaskDeepLinkRef.current = currentTaskParam;
        }
        setAttachSolutionOpen(false);
        clearSolutionDeepLink();
        setTaskIndex(index);
    };

    useEffect(() => {
        if (!currentTaskNav?.id) return;
        const token = localStorage.getItem("jwt_token");
        if (!token) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
            `${protocol}//${window.location.host}/api/tasks/${currentTaskNav.id}/solution/comments/ws?token=${encodeURIComponent(token)}`
        );
        ws.onmessage = () => {
            queryClient.invalidateQueries({ queryKey: ["task", currentTaskNav.id] });
            queryClient.invalidateQueries({ queryKey: ["solution-comment-notifications"] });
        };
        return () => ws.close();
    }, [currentTaskNav?.id, queryClient]);

    // Persist answers to localStorage
    useEffect(() => {
        try { localStorage.setItem('edu_task_answers', JSON.stringify(savedAnswers)); } catch {}
    }, [savedAnswers]);
    useEffect(() => {
        try { localStorage.setItem('edu_task_sub_answers', JSON.stringify(savedSubAnswers)); } catch {}
    }, [savedSubAnswers]);

    // Reset check result when task changes
    useEffect(() => {
        setCheckResult(null);
        setSubResults(null);
        setPartialCorrect(null);
        setExpectedAnswer(null);
        setAttachSolutionOpen(false);
    }, [taskIndex, id]);

    useEffect(() => {
        if (!isVariant || !examInfo?.active_attempt) return;

        const drafts = examInfo.active_attempt.draft_answers ?? {};
        const nextAnswers: Record<number, AnswerVal> = {};
        Object.entries(drafts).forEach(([taskId, answer]) => {
            if (answer?.val !== undefined) {
                nextAnswers[Number(taskId)] = answer.val;
            }
        });
        setExamAnswers(nextAnswers);
    }, [isVariant, examInfo?.active_attempt?.id]);

    const answer = savedAnswers[currentTaskNav?.id ?? 0] ?? 0;

    const handleCheck = async () => {
        if (!currentTaskNav || !task) return;
        try {
            const hasSubs = task.sub_tasks && task.sub_tasks.length > 0;
            let res;
            if (hasSubs) {
                const mainAns = savedAnswers[task.id] ?? 0;
                const subAns = (task.sub_tasks ?? []).map((_, i) =>
                    savedSubAnswers[`${task.id}:${i}`] ?? 0
                );
                res = await check.mutateAsync({ answers: [mainAns, ...subAns] });
                setSubResults(res.sub_results ?? null);
            } else {
                res = await check.mutateAsync({ val: answer });
                setSubResults(null);
            }
            setPartialCorrect(res.partial_correct ?? null);
            setExpectedAnswer(res.expected_answer ?? null);
            setCheckResult(res.correct ? 'correct' : 'wrong');
            if (res.correct) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ["#3F8C62", "#4ade80", "#3b82f6"],
                });
            }
        } catch {}
    };

    const handleExamAnswerChange = (taskId: number, val: AnswerVal) => {
        const attemptId = examInfo?.active_attempt?.id;
        setExamAnswers(prev => ({ ...prev, [taskId]: val }));

        if (!attemptId) return;
        saveExamDraftAnswer.mutate(
            { taskId, answer: { val } },
            { onError: (error) => console.error("Failed to save exam draft answer:", error) },
        );
    };

    useEffect(() => {
        const isEditableTarget = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName.toLowerCase();
            return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (attachSolutionOpen || mentorOpen || solutionOpen || viewingFinishedExam || taskLoading) return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

            if (event.key === "Enter") {
                if (!task || check.isPending) return;
                event.preventDefault();
                if (isVariant && examInfo?.active_attempt) {
                    handleExamAnswerChange(task.id, examAnswers[task.id] ?? 0);
                } else {
                    void handleCheck();
                }
                return;
            }

            if (isEditableTarget(event.target)) return;

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectTask(Math.max(0, taskIndex - 1));
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                selectTask(Math.min(tasks.length - 1, taskIndex + 1));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        attachSolutionOpen,
        mentorOpen,
        solutionOpen,
        viewingFinishedExam,
        taskLoading,
        task,
        check.isPending,
        isVariant,
        examInfo?.active_attempt,
        examAnswers,
        taskIndex,
        tasks.length,
        handleExamAnswerChange,
    ]);

    const handleStartExam = async () => {
        if (!examInfo) return;
        try {
            await startExam.mutateAsync();
            setExamAnswers({});
        } catch (error) {
            console.error("Failed to start exam:", error);
        }
    };

    const handleFinishExam = async () => {
        if (!examInfo || !confirm("Вы уверены, что хотите завершить экзамен досрочно?")) return;
        try {
            const answers = tasks.map(t => ({
                task_id: t.id,
                answer: { val: examAnswers[t.id] ?? 0 }
            }));
            const result = await submitExam.mutateAsync({ answers });
            setExamResult(result);
            queryClient.invalidateQueries({ queryKey: ["exam"] });
            queryClient.invalidateQueries({ queryKey: ["navigation"] });
        } catch (error) {
            console.error("Failed to submit exam:", error);
        }
    };

    if (navLoading && !allTopics) {
        return <div className="flex h-screen items-center justify-center bg-[#030A12] text-slate-500">Загрузка...</div>;
    }

    if (!currentTopic) return null;

    const renderResultsTable = (result: any) => {
        const taskResults = result.task_results || result.results?.task_results || [];
        
        return (
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#0A1522] shadow-[0_18px_42px_rgba(0,0,0,0.25)]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-6 py-4 w-20 text-center">№ ЕГЭ</th>
                            <th className="px-6 py-4">Ваш ответ</th>
                            <th className="px-6 py-4">Верный ответ</th>
                            <th className="px-6 py-4 w-24 text-center">Баллы</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {taskResults.map((res: any, idx: number) => (
                            <tr key={idx} className="transition-colors hover:bg-white/[0.04]">
                                <td className="px-6 py-4 text-center">
                                    <span className="text-sm font-bold text-slate-500">{res.ege_number || idx + 1}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={clsx(
                                        "text-sm font-medium",
                                        res.is_correct ? "text-emerald-600" : "text-red-500"
                                    )}>
                                        {res.user_answer?.val !== undefined ? String(res.user_answer.val) : "—"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-slate-100">
                                        {res.correct_answer?.val !== undefined ? String(res.correct_answer.val) : "—"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        res.points > 0 ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-400"
                                    )}>
                                        {res.points}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="task-solve-page flex h-full flex-col overflow-hidden bg-[#030A12]">
            {/* Header */}
            <div className="relative z-10 flex min-h-14 shrink-0 items-center border-b border-white/10 bg-[#07111D]/92 px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl md:px-6">
                <div className="flex items-center gap-2 md:gap-3 w-full min-w-0">
                    <button
                        onClick={() => navigate(backPath)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">Назад</span>
                    </button>

                    {showModeTabs && (
                        <div className="flex items-center gap-2 ml-2 py-2 overflow-x-auto scrollbar-hide">
                            {tutorialTopics.map(topic => (
                                <CategoryTab
                                    key={topic.id}
                                    label={getTopicTabLabel(topic, "Разбор", tutorialTopics)}
                                    counts={getTopicCounts(topic)}
                                    isActive={currentTopic?.id === topic.id}
                                    disabled={false}
                                    onClick={() => navigate(`/tasks/${topic.id}`)}
                                />
                            ))}
                            {homeworkTopics.map(topic => (
                                <CategoryTab
                                    key={topic.id}
                                    label={getTopicTabLabel(topic, "Домашка", homeworkTopics)}
                                    counts={getTopicCounts(topic)}
                                    isActive={currentTopic?.id === topic.id}
                                    disabled={false}
                                    onClick={() => navigate(`/homework/${topic.id}`)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
                        {isVariant && examInfo?.active_attempt ? (
                            <>
                                <ExamTimer
                                    startedAt={examInfo.active_attempt.started_at}
                                    timeLimitMinutes={examInfo.time_limit_minutes}
                                />
                                <button
                                    onClick={handleFinishExam}
                                    disabled={submitExam.isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    {submitExam.isPending ? "..." : <span className="hidden sm:inline">Завершить</span>}
                                    <span className="sm:hidden">Завершить</span>
                                </button>
                            </>
                        ) : null}
                        <span className="hidden items-center gap-1 rounded-full border border-violet-300/15 bg-violet-400/10 px-2.5 py-1 text-xs font-bold text-violet-200 sm:flex">
                            <Code2 size={11} />
                            Python
                        </span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                <div
                    className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.10),transparent_34%),linear-gradient(180deg,rgba(3,10,18,0),rgba(3,10,18,0.96))] p-4 pt-0 md:p-8 md:pt-0"
                    style={{ minWidth: 0 }}
                >
                    {!isVariant || !examInfo || (examInfo.active_attempt && !examResult) || viewingFinishedExam ? (
                        <>
                            {/* Task Navigation Row */}
                            <div className="-mx-4 mb-5 overflow-x-auto border-b border-white/10 bg-[#07111D]/72 px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.18)] backdrop-blur-xl scrollbar-hide md:-mx-8 md:mb-6 md:px-8">
                                <div className="flex gap-1.5 md:gap-2 min-w-max">
                                {tasks.map((t, idx) => (
                                    <button
                                        key={t.id}
                                        disabled={t.is_locked}
                                        onClick={() => selectTask(idx)}
                                        className={clsx(
                                            'w-10 h-10 shrink-0 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center relative border',
                                            t.is_locked
                                                ? 'cursor-not-allowed border-white/5 bg-white/[0.025] text-slate-700'
                                                : idx === taskIndex
                                                ? 'bg-emerald-400/18 border-emerald-300/45 text-emerald-100 shadow-[0_0_0_4px_rgba(16,185,129,0.10),0_0_26px_rgba(16,185,129,0.32),0_12px_24px_rgba(0,0,0,0.22)]'
                                                : t.status === 'solved'
                                                    ? 'bg-emerald-400/10 text-emerald-200 border-emerald-300/20'
                                                    : t.status === 'failed'
                                                        ? 'bg-red-400/10 text-red-200 border-red-300/20'
                                                        : 'bg-white/[0.04] border-white/10 text-slate-400 hover:border-white/20 hover:text-white hover:-translate-y-0.5'
                                        )}
                                    >
                                        {t.is_locked ? <Lock size={14} /> : <span>{idx + 1}</span>}
                                        {/* Indicator for solution existence from nav data */}
                                        {t.has_solution && (
                                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#07111D] bg-amber-400 text-white shadow-sm">
                                                <BookOpen size={8} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                                {/* Left: Task Card */}
                                <div className="relative min-h-[300px] w-full flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#0A1522] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:p-6">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-green-500 to-transparent" />
                                    {taskLoading ? (
                                        <Skeleton />
                                    ) : task ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-5 flex-wrap">
                                                <span className={clsx(
                                                    'px-2.5 py-1 rounded-full text-xs font-bold border',
                                                    task.difficulty === 'easy' ? 'bg-emerald-400/12 text-emerald-200 border-emerald-300/20' :
                                                    task.difficulty === 'medium' ? 'bg-amber-400/12 text-amber-200 border-amber-300/20' : 'bg-red-400/12 text-red-200 border-red-300/20'
                                                )}>
                                                    {task.difficulty === 'easy' ? 'Лёгкая' : task.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
                                                </span>
                                                <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                                                    {(() => {
                                                        if (Array.isArray(task.sub_tasks) && task.sub_tasks.length > 0) {
                                                            const nums = [task.ege_number, ...task.sub_tasks.map((s: any) => s?.number)].filter((n): n is number => typeof n === 'number');
                                                            if (nums.length >= 2) return `Задания №${Math.min(...nums)}–${Math.max(...nums)} — ${task.title || 'Информатика'}`;
                                                        }
                                                        return `Задание ${task.ege_number ? `№${task.ege_number}` : taskIndex + 1} — ${task.title || 'Информатика'}`;
                                                    })()}
                                                </span>
                                                <div className="ml-auto flex items-center gap-2">
                                                    {canAnnotateTask && (
                                                        drawingPanelOpen ? (
                                                            <div
                                                                id={`task-drawing-toolbar-${task.id}`}
                                                                className="min-w-0 max-w-full"
                                                            />
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDrawingPanelOpen(true)}
                                                                className="relative flex items-center gap-1.5 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1.5 text-xs font-bold text-sky-200 transition-all hover:bg-sky-400/15"
                                                            >
                                                                <PenLine size={13} />
                                                                Черновик
                                                            </button>
                                                        )
                                                    )}
                                                    {(!isVariant || !examInfo?.active_attempt) && (
                                                        <button
                                                            onClick={() => {
                                                                setAttachSolutionOpen(false);
                                                                setMentorOpen(o => !o);
                                                            }}
                                                            className={clsx(
                                                                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                                                mentorOpen
                                                                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                                                    : "text-violet-200 bg-violet-400/10 border-violet-300/20 hover:bg-violet-400/15"
                                                            )}
                                                        >
                                                            <HelpCircle size={13} />
                                                            Помощь
                                                        </button>
                                                    )}
                                                    <button
                                                            onClick={() => {
                                                                setMentorOpen(false);
                                                                setAttachSolutionInitialTab("code");
                                                                setAttachSolutionPrefillCode("");
                                                                setAttachSolutionOpen(o => !o);
                                                            }}
                                                            className={clsx(
                                                                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                                                attachSolutionOpen
                                                                    ? "bg-[#4e8c5a] text-white border-[#4e8c5a] shadow-sm"
                                                                    : task.solution_comments_count
                                                                        ? "text-amber-200 bg-amber-400/10 border-amber-300/20 shadow-[0_8px_18px_rgba(245,158,11,0.10)] hover:bg-amber-400/15"
                                                                        : task.has_own_solution
                                                                            ? "text-emerald-200 bg-emerald-400/12 border-emerald-300/25 shadow-[0_8px_18px_rgba(16,185,129,0.10)] hover:bg-emerald-400/18"
                                                                            : "text-emerald-200 bg-emerald-400/10 border-emerald-300/20 hover:bg-emerald-400/15"
                                                            )}
                                                        >
                                                            {task.solution_comments_count ? <MessageSquare size={13} /> : <Paperclip size={13} />}
                                                            {task.solution_comments_count
                                                                ? `Комментарий${task.solution_comments_count > 1 ? ` (${task.solution_comments_count})` : ""}`
                                                                : task.has_own_solution
                                                                    ? "Решение есть"
                                                                    : "Решение"}
                                                            {task.has_own_solution && !task.solution_comments_count && (
                                                                <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3F8C62] px-1 text-[9px] font-black text-white">
                                                                    ✓
                                                                </span>
                                                            )}
                                                            {task.solution_comments_count ? (
                                                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-white ring-2 ring-[#0A1522]">
                                                                    {task.solution_comments_count}
                                                                </span>
                                                            ) : null}
                                                    </button>
                                                    {task.solution_steps && task.solution_steps.length > 0 && (
                                                        <button
                                                            onClick={() => setSolutionOpen(true)}
                                                            className="group/sol flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 transition-all hover:border-emerald-300/35 hover:bg-emerald-400/15"
                                                            title="Пошаговое решение"
                                                        >
                                                            <BookOpen size={13} className="group-hover/sol:scale-110 transition-transform" />
                                                            <span className="text-xs font-bold uppercase tracking-tight">Разбор</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {isPlanTask && currentPlan?.plan && (
                                                <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-slate-100 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4e8c5a] text-white">
                                                            <ClipboardList size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black">Это задание стоит решить по плану сегодня</div>
                                                            <div className="mt-1 text-xs font-semibold text-slate-400">
                                                                {currentPlan.current_block_title || currentPlan.plan.title}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Link
                                                        to="/"
                                                        className="inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-white/[0.06] px-3 py-1.5 text-xs font-black text-emerald-200 shadow-sm hover:bg-white/[0.10]"
                                                    >
                                                        План подготовки
                                                    </Link>
                                                </div>
                                            )}
                                            <div className="prose prose-invert max-w-none leading-relaxed text-slate-200">
                                                <TaskView
                                                    content={task.content_html}
                                                    files={task.media_resources?.files}
                                                    annotatable={canAnnotateTask}
                                                    annotationKey={`task:${task.id}`}
                                                    annotationTaskId={task.id}
                                                    annotationPanelOpen={drawingPanelOpen}
                                                    onAnnotationPanelOpenChange={setDrawingPanelOpen}
                                                    showAnnotationToggle={false}
                                                    annotationToolbarHostId={`task-drawing-toolbar-${task.id}`}
                                                />
                                            </div>

                                            {/* Answer section — bottom of task card */}
                                            <div className="mt-7 max-w-full rounded-[18px] border border-white/10 bg-white/[0.04] p-4 md:max-w-[56%]">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                                                            {task.sub_tasks && task.sub_tasks.length > 0
                                                                ? `Ответ${task.ege_number ? ` к заданию ${task.ege_number}` : ''}`
                                                                : 'Ваш ответ'}
                                                        </div>
                                                        <AnswerInput
                                                            type={task.answer_type || 'single_number'}
                                                            egeNumber={task.ege_number}
                                                            isMath={currentTopic?.category === "math"}
                                                            value={
                                                                isVariant && viewingFinishedExam
                                                                    ? (reviewExamAnswers[task.id] ?? 0)
                                                                    : isVariant && examInfo?.active_attempt
                                                                        ? (examAnswers[task.id] ?? 0)
                                                                        : (savedAnswers[task.id] ?? 0)
                                                            }
                                                            onChange={(val) => {
                                                                if (isVariant && examInfo?.active_attempt) {
                                                                    handleExamAnswerChange(task.id, val);
                                                                } else {
                                                                    setSavedAnswers(prev => ({ ...prev, [task.id]: val }));
                                                                    setCheckResult(null);
                                                                    setPartialCorrect(null);
                                                                    setExpectedAnswer(null);
                                                                }
                                                            }}
                                                            disabled={check.isPending || viewingFinishedExam}
                                                            feedback={partialCorrect}
                                                        />
                                                        {currentTopic?.category === "math" && (task.ege_number === 14 || task.ege_number === 17) && !viewingFinishedExam && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openProofSolutionPanel(
                                                                        task.id,
                                                                        isVariant && examInfo?.active_attempt
                                                                            ? (examAnswers[task.id] ?? "")
                                                                            : (savedAnswers[task.id] ?? ""),
                                                                        "code",
                                                                    )}
                                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-200 transition hover:bg-emerald-400/15"
                                                                >
                                                                    <Paperclip size={13} />
                                                                    Прикрепить написанное решение
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openProofSolutionPanel(task.id, "", "image")}
                                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-200 transition hover:bg-sky-400/15"
                                                                >
                                                                    <PenLine size={13} />
                                                                    Прикрепить фото
                                                                </button>
                                                            </div>
                                                        )}
                                                        {subResults && subResults[0] !== undefined && (
                                                            <div className={clsx(
                                                                "mt-1.5 text-xs font-medium",
                                                                subResults[0] ? "text-emerald-600" : "text-red-500"
                                                            )}>
                                                                {subResults[0] ? "✓ Верно" : "✕ Неверно"}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!viewingFinishedExam && (!isVariant || !examInfo?.active_attempt) && (!task.sub_tasks || task.sub_tasks.length === 0) && (
                                                        <button
                                                            onClick={handleCheck}
                                                            disabled={check.isPending}
                                                            className="mt-5 px-5 py-2 bg-[#4e8c5a] hover:bg-[#62aa78] disabled:opacity-50 text-white rounded-full text-sm font-bold shadow-[0_10px_22px_rgba(78,140,90,0.2)] transition-all shrink-0"
                                                        >
                                                            {check.isPending ? "..." : "Проверить"}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Sub-tasks */}
                                                {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                    <div className="mt-6 space-y-6">
                                                        {task.sub_tasks.map((sub, sIdx) => {
                                                            const key = `${task.id}:${sIdx}`;
                                                            const subOk = subResults?.[sIdx + 1];
                                                            return (
                                                                <div key={sIdx} className="border-t border-white/10 pt-5">
                                                                    <div className="prose prose-invert prose-sm mb-3 max-w-none leading-relaxed text-slate-200">
                                                                        {sub.number != null && (
                                                                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                                                                Задание {sub.number}
                                                                            </div>
                                                                        )}
                                                                        <TaskView
                                                                            content={sub.content_html}
                                                                            annotatable={canAnnotateTask}
                                                                            annotationKey={`task:${task.id}:sub:${sIdx}`}
                                                                            annotationTaskId={task.id}
                                                                        />
                                                                    </div>
                                                                    <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                                                                        Ответ{sub.number ? ` к заданию ${sub.number}` : ''}
                                                                    </div>
                                                                    <AnswerInput
                                                                        type={sub.answer_type || 'single_number'}
                                                                        egeNumber={sub.number ?? undefined}
                                                                        isMath={currentTopic?.category === "math"}
                                                                        value={savedSubAnswers[key] ?? 0}
                                                                        onChange={(val) => {
                                                                            setSavedSubAnswers(prev => ({ ...prev, [key]: val }));
                                                                            setCheckResult(null);
                                                                            setSubResults(null);
                                                                        }}
                                                                        disabled={check.isPending || viewingFinishedExam}
                                                                    />
                                                                    {subOk !== undefined && (
                                                                        <div className={clsx(
                                                                            "mt-1.5 text-xs font-medium",
                                                                            subOk ? "text-emerald-600" : "text-red-500"
                                                                        )}>
                                                                            {subOk ? "✓ Верно" : "✕ Неверно"}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {!viewingFinishedExam && (
                                                            <button
                                                                onClick={handleCheck}
                                                                disabled={check.isPending}
                                                                className="px-5 py-2.5 bg-[#4e8c5a] hover:bg-[#62aa78] disabled:opacity-50 text-white rounded-full text-sm font-bold shadow-[0_10px_22px_rgba(78,140,90,0.2)] transition-all"
                                                            >
                                                                {check.isPending ? "Проверяю..." : "Проверить все ответы"}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {checkResult === 'correct' && (
                                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2.5 text-sm font-medium text-emerald-200">
                                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-xs">✓</div>
                                                        Правильный ответ!
                                                    </div>
                                                )}
                                                {checkResult === 'wrong' && (
                                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 p-2.5 text-sm font-medium text-red-200">
                                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-400/20 text-xs">✕</div>
                                                        Неверно. Попробуйте ещё раз.
                                                    </div>
                                                )}
                                                {task.status === 'solved' && checkResult !== 'correct' && (
                                                    <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-200">
                                                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-[10px]">✓</div>
                                                        Вы уже решили эту задачу
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05] text-slate-400 ring-1 ring-white/10">
                                                <Lock size={24} />
                                            </div>
                                            <h2 className="text-lg font-black text-white">Нужна подписка</h2>
                                            <p className="mt-2 max-w-sm text-sm text-slate-400">
                                                Это задание закрыто. Без подписки доступны только первые два пробных задания летнего курса.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : null}

                    {/* Final Result Screen */}
                    {examResult && !viewingFinishedExam && (
                        <div className="max-w-4xl mx-auto mt-6 animate-in zoom-in duration-300">
                             <div className="mb-6 rounded-3xl border border-white/10 bg-[#0A1522] p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                                    <Trophy size={40} />
                                </div>
                                <h2 className="mb-2 text-2xl font-bold text-white">Экзамен завершен!</h2>
                                <div className="flex items-center justify-center gap-8 mb-8">
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-[#3F8C62]">{examResult.score.toFixed(0)}</div>
                                        <div className="text-[10px] font-bold uppercase text-slate-500">Тестовый балл</div>
                                    </div>
                                    <div className="h-10 w-px bg-white/10" />
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-white">{examResult.primary_score}</div>
                                        <div className="text-[10px] font-bold uppercase text-slate-500">Первичный балл</div>
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-center">
                                    <button onClick={() => setViewingFinishedExam(true)} className="rounded-xl bg-white/[0.06] px-6 py-3 font-bold text-slate-200 transition-all hover:bg-white/[0.10]">Просмотреть задания</button>
                                    <button onClick={() => navigate(backPath)} className="px-6 py-3 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all">К списку вариантов</button>
                                </div>
                            </div>
                            
                            <h3 className="mb-4 px-2 text-lg font-bold text-white">Детализация по задачам</h3>
                            {renderResultsTable(examResult)}
                        </div>
                    )}

                    {/* Variant Screen */}
                    {isVariant && !examInfo?.active_attempt && !viewingFinishedExam && !examResult && (
                        <div className="max-w-4xl mx-auto mt-10">
                            {hasFinishedAttempt ? (
                                <div className="animate-in fade-in duration-500">
                                    <div className="mb-8 rounded-3xl border border-white/10 bg-[#0A1522] p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                                            <CheckCircle2 size={40} />
                                        </div>
                                        <h2 className="mb-2 text-2xl font-bold text-white">Результаты за {new Date(examInfo.finished_attempt.finished_at).toLocaleDateString()}</h2>
                                        <div className="flex items-center justify-center gap-8 mb-6">
                                            <div className="text-center">
                                                <div className="text-5xl font-black text-[#3F8C62]">{examInfo.finished_attempt.score.toFixed(0)}</div>
                                                <div className="text-xs font-bold uppercase text-slate-500">баллов</div>
                                            </div>
                                            <div className="h-12 w-px bg-white/10" />
                                            <div className="text-center">
                                                <div className="text-5xl font-black text-white">{examInfo.finished_attempt.primary_score}</div>
                                                <div className="text-xs font-bold uppercase text-slate-500">первичных</div>
                                            </div>
                                        </div>
                                        <p className="mx-auto mb-8 max-w-sm text-slate-400">Вы уже прошли этот вариант. Можете просмотреть свои ответы и детальный разбор каждой задачи.</p>
                                        <div className="flex gap-3 justify-center">
                                            <button onClick={() => setViewingFinishedExam(true)} className="rounded-xl bg-white/[0.06] px-6 py-3 font-bold text-slate-200 transition-all hover:bg-white/[0.10]">Разбор варианта</button>
                                            <button onClick={() => navigate(backPath)} className="px-6 py-3 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all">К списку вариантов</button>
                                        </div>
                                    </div>

                                    <h3 className="mb-4 px-2 text-lg font-bold text-white">Результаты попытки</h3>
                                    {renderResultsTable(examInfo.finished_attempt)}
                                </div>
                            ) : (
                                <div className="max-w-2xl mx-auto">
                                    <ExamIntro
                                        taskCount={tasks.length}
                                        timeLimitMinutes={examInfo?.time_limit_minutes || 60}
                                        onStart={handleStartExam}
                                        loading={startExam.isPending}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Mentor side panel */}
                {mentorOpen && task && (
                    <div className="flex h-full w-[440px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#07111D]">
                        <MentorPanel
                            key={task.id}
                            taskId={task.id}
                            onClose={() => setMentorOpen(false)}
                        />
                    </div>
                )}
                {attachSolutionOpen && task && (
                    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#07111D] p-3 sm:p-4 md:w-[580px] md:max-w-[58vw]">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-black text-white">Прикрепить решение</div>
                                <div className="text-[11px] text-slate-500">Сохранится для этой задачи и комментариев преподавателя</div>
                            </div>
                            <button
                                onClick={closeAttachSolution}
                                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <TaskSolutionPanel
                            key={`${task.id}:${attachSolutionInitialTab}:${attachSolutionPrefillCode}`}
                            taskId={task.id}
                            initialTab={attachSolutionInitialTab}
                            prefillCode={attachSolutionPrefillCode}
                            onChanged={refreshCurrentTask}
                            onClose={closeAttachSolutionNow}
                            registerBeforeClose={(handler) => {
                                attachSolutionBeforeCloseRef.current = handler;
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Solution drawer */}
            {task?.solution_steps && (
                <StepByStepSolution
                    steps={task.solution_steps}
                    taskId={task.id}
                    open={solutionOpen}
                    onClose={() => setSolutionOpen(false)}
                    fullSolutionCode={task.full_solution_code}
                />
            )}
        </div>
    );
}
