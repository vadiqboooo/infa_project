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
import { ArrowLeft, Send, Bot, X, Code2, BookOpen, ChevronRight, CheckCircle2, HelpCircle, MessageSquare, Paperclip } from "lucide-react";
import { clsx } from "clsx";
import { useTask, useCheckAnswer, useNavigation, useExamByTopic, useStartExam, useSubmitExam } from "../hooks/useApi";
import type { AnswerVal, TaskNav, TopicNav, ExamResult } from "../api/types";
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
          ? "border-[#4e8c5a] bg-[#4e8c5a] text-white shadow-[0_8px_20px_rgba(78,140,90,0.22)]"
          : disabled
            ? "border-transparent bg-gray-100 text-gray-300 cursor-not-allowed"
            : "border-[#dfe8df] bg-white/80 text-[#667568] hover:border-[#b9d2bd] hover:text-[#25352b]",
      )}
    >
      {label}
      {counts.left > 0 && (
        <span
          className={clsx(
            "text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums",
            isActive ? "bg-white/20 text-white" : "bg-[#eef3ee] text-[#667568]",
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
    const [solutionOpen, setSolutionOpen] = useState(false);
    const [examAnswers, setExamAnswers] = useState<Record<number, AnswerVal>>({});
    const [examResult, setExamResult] = useState<ExamResult | null>(null);
    const [viewingFinishedExam, setViewingFinishedExam] = useState(false);

    const { data: allTopics, isLoading: navLoading } = useNavigation();

    const categoryFilter = useMemo(() => {
        if (location.pathname.startsWith('/homework')) return 'homework';
        if (location.pathname.startsWith('/exams')) return 'variants';
        return 'tutorial';
    }, [location.pathname]);

    const backPath = categoryFilter === 'homework' ? '/homework' : categoryFilter === 'variants' ? '/exams' : '/tasks';

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
        const taskParam = new URLSearchParams(location.search).get("task");
        if (!taskParam || tasks.length === 0) return;
        const nextIndex = tasks.findIndex((item) => item.id === Number(taskParam));
        if (nextIndex >= 0 && nextIndex !== taskIndex) {
            setTaskIndex(nextIndex);
        }
    }, [location.search, taskIndex, tasks]);

    const isVariant = currentTopic?.category === "variants";
    const { data: examInfo } = useExamByTopic(isVariant ? currentTopic?.id ?? null : null);
    const startExam = useStartExam(examInfo?.id ?? 0);
    const submitExam = useSubmitExam(examInfo?.id ?? 0);
    const hasFinishedAttempt = examInfo?.finished_attempt != null;

    const { data: task, isLoading: taskLoading } = useTask(currentTaskNav?.id ?? null);
    const check = useCheckAnswer(currentTaskNav?.id ?? 0);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get("solution") !== "1" || !task) return;
        const taskParam = params.get("task");
        if (taskParam && Number(taskParam) !== task.id) return;
        setMentorOpen(false);
        setAttachSolutionOpen(true);
    }, [location.search, task]);

    const refreshCurrentTask = () => {
        if (!currentTaskNav?.id) return;
        queryClient.invalidateQueries({ queryKey: ["task", currentTaskNav.id] });
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
        } catch (error) {
            console.error("Failed to submit exam:", error);
        }
    };

    if (navLoading && !allTopics) {
        return <div className="flex items-center justify-center h-screen text-gray-400">Загрузка...</div>;
    }

    if (!currentTopic) return null;

    const renderResultsTable = (result: any) => {
        const taskResults = result.task_results || result.results?.task_results || [];
        
        return (
            <div className="mt-8 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-gray-100">
                            <th className="px-6 py-4 w-20 text-center">№ ЕГЭ</th>
                            <th className="px-6 py-4">Ваш ответ</th>
                            <th className="px-6 py-4">Верный ответ</th>
                            <th className="px-6 py-4 w-24 text-center">Баллы</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {taskResults.map((res: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 text-center">
                                    <span className="text-sm font-bold text-gray-400">{res.ege_number || idx + 1}</span>
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
                                    <span className="text-sm font-medium text-gray-900">
                                        {res.correct_answer?.val !== undefined ? String(res.correct_answer.val) : "—"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        res.points > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
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
        <div className="flex flex-col h-full overflow-hidden bg-[#F8F7F4]">
            {/* Header */}
            <div className="min-h-14 flex items-center px-4 md:px-6 bg-white/92 backdrop-blur-xl shrink-0 border-b border-[#e4e9e4] shadow-[0_1px_0_rgba(255,255,255,0.7)] relative z-10">
                <div className="flex items-center gap-2 md:gap-3 w-full min-w-0">
                    <button
                        onClick={() => navigate(backPath)}
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-[#526052] hover:bg-[#f1f5f1] hover:text-[#25352b] transition-colors shrink-0"
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
                        <span className="hidden sm:flex items-center gap-1 text-xs bg-[#f0e9ff] text-violet-700 px-2.5 py-1 rounded-full font-bold border border-violet-100">
                            <Code2 size={11} />
                            Python
                        </span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                <div
                    className="flex-1 overflow-y-auto p-4 pt-0 md:p-8 md:pt-0 bg-[radial-gradient(circle_at_50%_0%,rgba(78,140,90,0.11),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.42),rgba(248,247,244,0))]"
                    style={{ minWidth: 0 }}
                >
                    {!isVariant || !examInfo || (examInfo.active_attempt && !examResult) || viewingFinishedExam ? (
                        <>
                            {/* Task Navigation Row */}
                            <div className="-mx-4 md:-mx-8 mb-5 md:mb-6 overflow-x-auto border-b border-[#e0e7e0] bg-white/82 px-4 py-3 md:px-8 backdrop-blur-xl shadow-[0_18px_44px_rgba(78,140,90,0.10)] scrollbar-hide">
                                <div className="flex gap-1.5 md:gap-2 min-w-max">
                                {tasks.map((t, idx) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTaskIndex(idx)}
                                        className={clsx(
                                            'w-10 h-10 shrink-0 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center relative border',
                                            idx === taskIndex
                                                ? 'bg-[#4e8c5a] border-[#4e8c5a] text-white shadow-[0_0_0_4px_rgba(78,140,90,0.16),0_0_26px_rgba(78,140,90,0.58),0_12px_24px_rgba(78,140,90,0.25)]'
                                                : t.status === 'solved'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : t.status === 'failed'
                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                        : 'bg-white border-[#dfe8df] text-[#526052] hover:border-[#b9d2bd] hover:text-[#3F8C62] hover:-translate-y-0.5'
                                        )}
                                    >
                                        <span>{idx + 1}</span>
                                        {/* Indicator for solution existence from nav data */}
                                        {t.has_solution && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
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
                                <div className="flex-1 w-full overflow-hidden rounded-[22px] border border-[#dfe8df] bg-gradient-to-b from-white via-white to-[#f8fbf8] p-4 md:p-6 min-h-[300px] shadow-[0_20px_60px_rgba(15,23,20,0.08)] relative">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4e8c5a] via-[#62aa78] to-transparent" />
                                    {taskLoading ? (
                                        <Skeleton />
                                    ) : task ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-5 flex-wrap">
                                                <span className={clsx(
                                                    'px-2.5 py-1 rounded-full text-xs font-bold border',
                                                    task.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    task.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'
                                                )}>
                                                    {task.difficulty === 'easy' ? 'Лёгкая' : task.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
                                                </span>
                                                <span className="text-xs font-medium text-[#8a948b] hidden sm:inline">
                                                    {(() => {
                                                        if (Array.isArray(task.sub_tasks) && task.sub_tasks.length > 0) {
                                                            const nums = [task.ege_number, ...task.sub_tasks.map((s: any) => s?.number)].filter((n): n is number => typeof n === 'number');
                                                            if (nums.length >= 2) return `Задания №${Math.min(...nums)}–${Math.max(...nums)} — ${task.title || 'Информатика'}`;
                                                        }
                                                        return `Задание ${task.ege_number ? `№${task.ege_number}` : taskIndex + 1} — ${task.title || 'Информатика'}`;
                                                    })()}
                                                </span>
                                                <div className="ml-auto flex items-center gap-2">
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
                                                                    : "text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100"
                                                            )}
                                                        >
                                                            <HelpCircle size={13} />
                                                            Помощь
                                                        </button>
                                                    )}
                                                    {!isVariant && (
                                                        <button
                                                            onClick={() => {
                                                                setMentorOpen(false);
                                                                setAttachSolutionOpen(o => !o);
                                                            }}
                                                            className={clsx(
                                                                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                                                attachSolutionOpen
                                                                    ? "bg-[#4e8c5a] text-white border-[#4e8c5a] shadow-sm"
                                                                    : task.solution_comments_count
                                                                        ? "text-amber-700 bg-amber-50 border-amber-200 shadow-[0_8px_18px_rgba(245,158,11,0.14)] hover:bg-amber-100"
                                                                        : task.has_own_solution
                                                                            ? "text-[#1f6f46] bg-emerald-100 border-emerald-300 shadow-[0_8px_18px_rgba(63,140,98,0.14)] hover:bg-emerald-200"
                                                                            : "text-[#3F8C62] bg-[#3F8C62]/5 border-[#3F8C62]/20 hover:bg-[#3F8C62]/10"
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
                                                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-white ring-2 ring-white">
                                                                    {task.solution_comments_count}
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    )}
                                                    {task.solution_steps && task.solution_steps.length > 0 && (
                                                        <button
                                                            onClick={() => setSolutionOpen(true)}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[#3F8C62] bg-[#3F8C62]/5 border border-[#3F8C62]/20 hover:bg-[#3F8C62]/10 hover:border-[#3F8C62]/40 transition-all group/sol"
                                                            title="Пошаговое решение"
                                                        >
                                                            <BookOpen size={13} className="group-hover/sol:scale-110 transition-transform" />
                                                            <span className="text-xs font-bold uppercase tracking-tight">Разбор</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="prose prose-slate max-w-none text-[#18251d] leading-relaxed">
                                                <TaskView
                                                    content={task.content_html}
                                                    files={task.media_resources?.files}
                                                />
                                            </div>

                                            {/* Answer section — bottom of task card */}
                                            <div className="mt-7 rounded-[18px] border border-[#e0e8e0] bg-[#f8fbf8] p-4 max-w-full md:max-w-[56%]">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[11px] font-extrabold text-[#8a948b] mb-1.5 uppercase tracking-wide">
                                                            {task.sub_tasks && task.sub_tasks.length > 0
                                                                ? `Ответ${task.ege_number ? ` к заданию ${task.ege_number}` : ''}`
                                                                : 'Ваш ответ'}
                                                        </div>
                                                        <AnswerInput
                                                            type={task.answer_type || 'single_number'}
                                                            egeNumber={task.ege_number}
                                                            value={isVariant && examInfo?.active_attempt ? (examAnswers[task.id] ?? 0) : (savedAnswers[task.id] ?? 0)}
                                                            onChange={(val) => {
                                                                if (isVariant && examInfo?.active_attempt) {
                                                                    setExamAnswers(prev => ({ ...prev, [task.id]: val }));
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
                                                                <div key={sIdx} className="border-t border-[#e0e8e0] pt-5">
                                                                    <div className="prose prose-slate prose-sm max-w-none text-gray-800 leading-relaxed mb-3">
                                                                        {sub.number != null && (
                                                                            <div className="text-xs font-bold text-[#8a948b] uppercase tracking-wider mb-2">
                                                                                Задание {sub.number}
                                                                            </div>
                                                                        )}
                                                                        <TaskView content={sub.content_html} />
                                                                    </div>
                                                                    <div className="text-[11px] font-extrabold text-[#8a948b] mb-1.5 uppercase tracking-wide">
                                                                        Ответ{sub.number ? ` к заданию ${sub.number}` : ''}
                                                                    </div>
                                                                    <AnswerInput
                                                                        type={sub.answer_type || 'single_number'}
                                                                        egeNumber={sub.number ?? undefined}
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
                                                    <div className="mt-3 p-2.5 bg-emerald-50 rounded-xl text-emerald-700 text-sm font-medium flex items-center gap-2 border border-emerald-100">
                                                        <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center text-xs">✓</div>
                                                        Правильный ответ!
                                                    </div>
                                                )}
                                                {checkResult === 'wrong' && (
                                                    <div className="mt-3 p-2.5 bg-red-50 rounded-xl text-red-600 text-sm font-medium flex items-center gap-2 border border-red-100">
                                                        <div className="w-5 h-5 bg-red-200 rounded-full flex items-center justify-center text-xs">✕</div>
                                                        Неверно. Попробуйте ещё раз.
                                                    </div>
                                                )}
                                                {task.status === 'solved' && checkResult !== 'correct' && (
                                                    <div className="mt-2 text-emerald-600 text-sm font-medium flex items-center gap-1.5">
                                                        <div className="w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center text-[10px]">✓</div>
                                                        Вы уже решили эту задачу
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    ) : null}

                    {/* Final Result Screen */}
                    {examResult && (
                        <div className="max-w-4xl mx-auto mt-6 animate-in zoom-in duration-300">
                             <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center shadow-xl mb-6">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Trophy size={40} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Экзамен завершен!</h2>
                                <div className="flex items-center justify-center gap-8 mb-8">
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-[#3F8C62]">{examResult.score.toFixed(0)}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Тестовый балл</div>
                                    </div>
                                    <div className="w-px h-10 bg-gray-100" />
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-gray-900">{examResult.primary_score}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Первичный балл</div>
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-center">
                                    <button onClick={() => { setViewingFinishedExam(true); setExamResult(null); }} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all">Просмотреть задания</button>
                                    <button onClick={() => navigate(backPath)} className="px-6 py-3 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all">К списку вариантов</button>
                                </div>
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">Детализация по задачам</h3>
                            {renderResultsTable(examResult)}
                        </div>
                    )}

                    {/* Variant Screen */}
                    {isVariant && !examInfo?.active_attempt && !viewingFinishedExam && !examResult && (
                        <div className="max-w-4xl mx-auto mt-10">
                            {hasFinishedAttempt ? (
                                <div className="animate-in fade-in duration-500">
                                    <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center shadow-xl mb-8">
                                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle2 size={40} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Результаты за {new Date(examInfo.finished_attempt.finished_at).toLocaleDateString()}</h2>
                                        <div className="flex items-center justify-center gap-8 mb-6">
                                            <div className="text-center">
                                                <div className="text-5xl font-black text-[#3F8C62]">{examInfo.finished_attempt.score.toFixed(0)}</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase">баллов</div>
                                            </div>
                                            <div className="w-px h-12 bg-gray-100" />
                                            <div className="text-center">
                                                <div className="text-5xl font-black text-gray-900">{examInfo.finished_attempt.primary_score}</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase">первичных</div>
                                            </div>
                                        </div>
                                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">Вы уже прошли этот вариант. Можете просмотреть свои ответы и детальный разбор каждой задачи.</p>
                                        <div className="flex gap-3 justify-center">
                                            <button onClick={() => setViewingFinishedExam(true)} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all">Разбор варианта</button>
                                            <button onClick={() => navigate(backPath)} className="px-6 py-3 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all">К списку вариантов</button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">Результаты попытки</h3>
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
                    <div className="w-[440px] shrink-0 h-full overflow-hidden border-l border-gray-200 flex flex-col">
                        <MentorPanel
                            key={task.id}
                            taskId={task.id}
                            onClose={() => setMentorOpen(false)}
                        />
                    </div>
                )}
                {attachSolutionOpen && task && (
                    <div className="w-[580px] max-w-[58vw] shrink-0 h-full overflow-y-auto border-l border-gray-200 bg-[#f8fbf8] p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-black text-[#18251d]">Прикрепить решение</div>
                                <div className="text-[11px] text-[#7a877c]">Сохранится для этой задачи</div>
                            </div>
                            <button
                                onClick={() => setAttachSolutionOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <TaskSolutionPanel taskId={task.id} disabled={viewingFinishedExam} onChanged={refreshCurrentTask} />
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
