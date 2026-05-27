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
import { ArrowLeft, Send, Bot, X, BookOpen, ChevronRight, CheckCircle2, Eye, HelpCircle, MessageSquare, Paperclip, ClipboardList, Lock, PenLine } from "lucide-react";
import { clsx } from "clsx";
import { useTask, useCheckAnswer, useNavigation, useExamByTopic, useStartExam, useSubmitExam, useSaveExamDraftAnswer, useCurrentPreparationPlan } from "../hooks/useApi";
import { TopicCategory, type AnswerVal, type TaskNav, type TopicNav, type ExamResult } from "../api/types";
import confetti from "canvas-confetti";
import { StepByStepSolution } from "../components/StepByStepSolution";
import RecognizedSolutionBlock from "../components/RecognizedSolutionBlock";
import "./TasksPage.css";
import { api } from "../api/client";

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
    const [solutionHelpMode, setSolutionHelpMode] = useState(false);
    const [taskConditionVisibleInHelp, setTaskConditionVisibleInHelp] = useState(false);
    const [attachSolutionInitialTab, setAttachSolutionInitialTab] = useState<"code" | "file" | "image">("code");
    const [attachSolutionPrefillCode, setAttachSolutionPrefillCode] = useState("");
    const [attachSolutionTextMode, setAttachSolutionTextMode] = useState(false);
    const [solutionOpen, setSolutionOpen] = useState(false);
    const [drawingPanelOpen, setDrawingPanelOpen] = useState(false);
    const [annotationRefreshKey, setAnnotationRefreshKey] = useState(0);
    const [recognizedDrawingSolutions, setRecognizedDrawingSolutions] = useState<Record<number, { text: string }>>({});
    const [solutionReviewSending, setSolutionReviewSending] = useState<Record<number, boolean>>({});
    const [solutionReviewSent, setSolutionReviewSent] = useState<Record<number, boolean>>({});
    const [examAnswers, setExamAnswers] = useState<Record<number, AnswerVal>>({});
    const [examResult, setExamResult] = useState<ExamResult | null>(null);
    const [viewingFinishedExam, setViewingFinishedExam] = useState(false);
    const attachSolutionBeforeCloseRef = useRef<(() => boolean) | null>(null);
    const solutionWasOpenBeforeHelpRef = useRef(false);
    const appliedTaskDeepLinkRef = useRef<string | null>(null);
    const [pendingSolutionTaskId, setPendingSolutionTaskId] = useState<number | null>(null);
    const taskNavRef = useRef<HTMLDivElement | null>(null);
    const [modeMenuOpen, setModeMenuOpen] = useState(false);

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
        const currentSubject = currentTopic.subject ?? (currentTopic.category === TopicCategory.math ? 'math' : 'informatics');
        return allTopics
            .filter(t => {
                const subject = t.subject ?? (t.category === TopicCategory.math ? 'math' : 'informatics');
                return t.category === 'tutorial' && subject === currentSubject && t.ege_number === currentTopic.ege_number;
            })
            .sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
    }, [allTopics, currentTopic]);

    const homeworkTopics = useMemo(() => {
        if (!allTopics || !currentTopic || currentTopic.ege_number == null) return [];
        const currentSubject = currentTopic.subject ?? (currentTopic.category === TopicCategory.math ? 'math' : 'informatics');
        return allTopics
            .filter(t => {
                const subject = t.subject ?? (t.category === TopicCategory.math ? 'math' : 'informatics');
                return t.category === 'homework' && subject === currentSubject && t.ege_number === currentTopic.ege_number;
            })
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

    const modeOptions = useMemo(() => ([
        ...tutorialTopics.map(topic => ({
            topic,
            path: `/tasks/${topic.id}`,
            label: getTopicTabLabel(topic, "Разбор", tutorialTopics),
            shortLabel: "Разбор",
            counts: getTopicCounts(topic),
        })),
        ...homeworkTopics.map(topic => ({
            topic,
            path: `/homework/${topic.id}`,
            label: getTopicTabLabel(topic, "Домашка", homeworkTopics),
            shortLabel: "Домашка",
            counts: getTopicCounts(topic),
        })),
    ]), [tutorialTopics, homeworkTopics]);
    const currentModeOption = modeOptions.find((item) => item.topic.id === currentTopic?.id);

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
        const container = taskNavRef.current;
        if (!container) return;
        const activeButton = container.querySelector<HTMLButtonElement>('[data-active-task="true"]');
        activeButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, [taskIndex, tasks.length]);

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

    useEffect(() => {
        if (!task?.id) return;
        let cancelled = false;
        api<{ recognized_text: string | null }>(`/tasks/${task.id}/solution`)
            .then((solution) => {
                if (cancelled || !solution.recognized_text?.trim()) return;
                setRecognizedDrawingSolutions(prev => prev[task.id] ? prev : ({
                    ...prev,
                    [task.id]: { text: solution.recognized_text ?? "" },
                }));
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [task?.id]);
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

    const refreshCurrentTaskAndSolution = () => {
        refreshCurrentTask();
        if (!currentTaskNav?.id) return;
        api<{ recognized_text: string | null }>(`/tasks/${currentTaskNav.id}/solution`)
            .then((solution) => {
                setRecognizedDrawingSolutions(prev => {
                    const next = { ...prev };
                    if (solution.recognized_text?.trim()) {
                        next[currentTaskNav.id] = { text: solution.recognized_text };
                    } else {
                        delete next[currentTaskNav.id];
                    }
                    return next;
                });
            })
            .catch(() => {});
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
        setSolutionHelpMode(false);
        setTaskConditionVisibleInHelp(false);
        solutionWasOpenBeforeHelpRef.current = false;
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
        setSolutionHelpMode(false);
        setTaskConditionVisibleInHelp(false);
        setAttachSolutionInitialTab(tab);
        setAttachSolutionPrefillCode(tab === "code" ? proofText : "");
        setAttachSolutionTextMode(false);
        setAttachSolutionOpen(true);
        queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    };

    const openRecognizedDrawingSolution = (text: string, rawText?: string) => {
        if (task) {
            const displayText = rawText || text;
            setRecognizedDrawingSolutions(prev => ({ ...prev, [task.id]: { text: displayText } }));
            api(`/tasks/${task.id}/solution`, {
                method: "PUT",
                body: JSON.stringify({ recognized_text: displayText }),
            })
                .then(refreshCurrentTask)
                .catch(() => {});
        }
        setMentorOpen(false);
        setSolutionHelpMode(false);
        setTaskConditionVisibleInHelp(false);
        setAttachSolutionInitialTab("code");
        setAttachSolutionPrefillCode(rawText || text);
        setAttachSolutionTextMode(true);
        setAttachSolutionOpen(true);
    };

    const editRecognizedSolution = () => {
        if (!task) return;
        setMentorOpen(false);
        setSolutionHelpMode(false);
        setTaskConditionVisibleInHelp(false);
        setAttachSolutionInitialTab("code");
        setAttachSolutionPrefillCode(recognizedDrawingSolutions[task.id]?.text ?? "");
        setAttachSolutionTextMode(true);
        setAttachSolutionOpen(true);
    };

    const deleteRecognizedSolution = async () => {
        if (!task || !confirm("Удалить моё решение?")) return;
        await api(`/tasks/${task.id}/solution`, {
            method: "PUT",
            body: JSON.stringify({ recognized_text: "" }),
        });
        setRecognizedDrawingSolutions(prev => {
            const next = { ...prev };
            delete next[task.id];
            return next;
        });
        setSolutionReviewSent(prev => ({ ...prev, [task.id]: false }));
        refreshCurrentTask();
    };

    const sendRecognizedSolutionForReview = async () => {
        if (!task) return;
        setSolutionReviewSending(prev => ({ ...prev, [task.id]: true }));
        try {
            await api(`/tasks/${task.id}/solution/help-request`, {
                method: "POST",
                body: JSON.stringify({ message: "Ученик отправил своё решение на проверку" }),
            });
            setSolutionReviewSent(prev => ({ ...prev, [task.id]: true }));
        } finally {
            setSolutionReviewSending(prev => ({ ...prev, [task.id]: false }));
        }
    };

    const selectTask = (index: number) => {
        if (tasks[index]?.is_locked) return;
        const currentTaskParam = new URLSearchParams(location.search).get("task");
        if (currentTaskParam) {
            appliedTaskDeepLinkRef.current = currentTaskParam;
        }
        setAttachSolutionOpen(false);
        setSolutionHelpMode(false);
        setTaskConditionVisibleInHelp(false);
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
            setAnnotationRefreshKey((current) => current + 1);
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

    const renderTaskActionButtons = () => {
        if (!task) return null;

        return (
            <>
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
                            if (attachSolutionOpen && solutionHelpMode) {
                                closeAttachSolution();
                                return;
                            }
                            solutionWasOpenBeforeHelpRef.current = attachSolutionOpen && !solutionHelpMode;
                            setMentorOpen(false);
                            setAttachSolutionInitialTab("code");
                            setAttachSolutionPrefillCode("");
                            setAttachSolutionTextMode(false);
                            setSolutionHelpMode(true);
                            setTaskConditionVisibleInHelp(true);
                            setAttachSolutionOpen(true);
                        }}
                        className={clsx(
                            "task-action-secondary relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                            solutionHelpMode
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
                        setSolutionHelpMode(false);
                        setTaskConditionVisibleInHelp(false);
                        setAttachSolutionInitialTab("code");
                        setAttachSolutionPrefillCode("");
                        setAttachSolutionTextMode(false);
                        setAttachSolutionOpen(o => !o);
                    }}
                    className={clsx(
                        "task-action-secondary relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
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
            </>
        );
    };

    const renderBreakdownButton = () => (
        task?.solution_steps && task.solution_steps.length > 0 ? (
            <button
                onClick={() => setSolutionOpen(true)}
                className="group/sol flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 transition-all hover:border-emerald-300/35 hover:bg-emerald-400/15"
                title="Пошаговое решение"
            >
                <BookOpen size={13} className="group-hover/sol:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-tight">Разбор</span>
            </button>
        ) : null
    );

    return (
        <div className="task-solve-page flex h-full flex-col overflow-hidden bg-[#030A12]">
            {/* Header */}
            <div className="relative z-10 flex min-h-16 shrink-0 items-center border-b border-white/10 bg-[#07111D]/92 px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl md:px-6">
                <div className="flex w-full min-w-0 items-center gap-3">
                    <button
                        onClick={() => navigate(backPath)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">Назад</span>
                    </button>

                    {showModeTabs && modeOptions.length > 1 && currentModeOption && (
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setModeMenuOpen((value) => !value)}
                                className="inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-transparent px-2 text-sm font-black text-emerald-100 transition hover:text-white"
                            >
                                <span>{currentModeOption.shortLabel}</span>
                                <span className="text-xs text-emerald-200">
                                    {currentModeOption.counts.total}
                                </span>
                                <ChevronRight className="h-4 w-4 rotate-90 text-emerald-200" />
                            </button>
                            {modeMenuOpen && (
                                <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#07111D] p-1 shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
                                    {modeOptions.map(({ topic, path, label, counts }) => (
                                        <button
                                            key={topic.id}
                                            type="button"
                                            onClick={() => {
                                                setModeMenuOpen(false);
                                                navigate(path);
                                            }}
                                            className={clsx(
                                                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition",
                                                topic.id === currentTopic?.id
                                                    ? "bg-emerald-400/14 text-emerald-100"
                                                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                                            )}
                                        >
                                            <span className="min-w-0 truncate">{label}</span>
                                            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs">{counts.total}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div ref={taskNavRef} className="ml-2 min-w-0 flex-1 overflow-x-auto px-3 py-3 scrollbar-hide">
                        <div className="flex min-w-max gap-1.5 md:gap-2">
                            {tasks.map((t, idx) => {
                                const taskLabel = String(idx + 1);
                                const egeLabel = t.ege_number != null ? `№${t.ege_number}` : taskLabel;
                                const customTitle = t.title?.trim();
                                const isActiveTask = idx === taskIndex;
                                return (
                                    <button
                                        key={t.id}
                                        data-active-task={isActiveTask ? "true" : undefined}
                                        disabled={t.is_locked}
                                        title={customTitle ? `${egeLabel}: ${customTitle}` : `Задание ${egeLabel}`}
                                        onClick={() => selectTask(idx)}
                                        className={clsx(
                                            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition-all",
                                            t.is_locked
                                                ? "cursor-not-allowed border-white/5 bg-white/[0.025] text-slate-700"
                                                : isActiveTask
                                                    ? "border-emerald-300/45 bg-emerald-400/18 text-emerald-100 shadow-[0_0_0_4px_rgba(16,185,129,0.10),0_0_26px_rgba(16,185,129,0.32),0_12px_24px_rgba(0,0,0,0.22)]"
                                                    : t.status === "solved"
                                                        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                                                        : t.status === "failed"
                                                            ? "border-red-300/20 bg-red-400/10 text-red-200"
                                                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:-translate-y-0.5 hover:border-white/20 hover:text-white"
                                        )}
                                    >
                                        {t.is_locked ? <Lock size={14} /> : taskLabel}
                                        {t.has_solution && (
                                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#07111D] bg-amber-400 text-white shadow-sm">
                                                <BookOpen size={8} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
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
                    </div>
                </div>
            </div>
            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                <div
                    className="task-workspace-body flex-1 overflow-y-auto bg-[radial-gradient(circle_at_80%_8%,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,#061018,#03080f)] p-0"
                    style={{ minWidth: 0 }}
                >
                    {!isVariant || !examInfo || (examInfo.active_attempt && !examResult) || viewingFinishedExam ? (
                        <>
                            {/* Content */}
                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                                {/* Left: Task Card */}
                                <div className="relative min-h-[300px] w-full min-w-0 flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#07111D]/92 p-4 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-green-500 to-transparent" />
                                    {taskLoading ? (
                                        <Skeleton />
                                    ) : task ? (
                                        <>
                                            {false && (
                                            <div className="hidden">
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
                                                                if (attachSolutionOpen && solutionHelpMode) {
                                                                    closeAttachSolution();
                                                                    return;
                                                                }
                                                                solutionWasOpenBeforeHelpRef.current = attachSolutionOpen && !solutionHelpMode;
                                                                setMentorOpen(false);
                                                                setAttachSolutionInitialTab("code");
                                                                setAttachSolutionPrefillCode("");
                                                                setAttachSolutionTextMode(false);
                                                                setSolutionHelpMode(true);
                                                                setTaskConditionVisibleInHelp(true);
                                                                setAttachSolutionOpen(true);
                                                            }}
                                                            className={clsx(
                                                                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                                                solutionHelpMode
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
                                                                setSolutionHelpMode(false);
                                                                setTaskConditionVisibleInHelp(false);
                                                                setAttachSolutionInitialTab("code");
                                                                setAttachSolutionPrefillCode("");
                                                                setAttachSolutionTextMode(false);
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
                                            )}
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
                                            {!solutionHelpMode && attachSolutionOpen && !taskConditionVisibleInHelp && (
                                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Условие задачи</div>
                                                        {renderBreakdownButton()}
                                                    <button
                                                        type="button"
                                                        onClick={() => setTaskConditionVisibleInHelp(true)}
                                                        className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-slate-200 hover:bg-white/[0.10]"
                                                    >
                                                        <Eye size={14} />
                                                        Показать условие
                                                    </button>
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                        {renderTaskActionButtons()}
                                                    </div>
                                                </div>
                                            )}
                                            {!solutionHelpMode && (!attachSolutionOpen || taskConditionVisibleInHelp) && (
                                                <div className={clsx(
                                                    "task-condition-card mb-6 w-full min-w-0 rounded-[18px] border border-white/10 bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_34%),#08131D] p-5",
                                                    drawingPanelOpen && "draft-open"
                                                )}>
                                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="task-condition-heading text-xs font-black uppercase tracking-[0.12em] text-slate-400">Условие задачи</div>
                                                            {renderBreakdownButton()}
                                                            {attachSolutionOpen && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setTaskConditionVisibleInHelp(false)}
                                                                    className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-slate-300 hover:bg-white/[0.08]"
                                                                >
                                                                    <Eye size={14} />
                                                                    Скрыть условие
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            {renderTaskActionButtons()}
                                                        </div>
                                                    </div>
                                                    <div className="prose prose-invert max-w-none leading-relaxed text-slate-200">
                                                        <TaskView
                                                            content={task.content_html}
                                                            files={task.media_resources?.files}
                                                            annotatable={canAnnotateTask}
                                                            annotationKey={`task:${task.id}`}
                                                            annotationTaskId={task.id}
                                                            annotationRefreshKey={annotationRefreshKey}
                                                            annotationPanelOpen={drawingPanelOpen}
                                                            onAnnotationPanelOpenChange={setDrawingPanelOpen}
                                                            showAnnotationToggle={false}
                                                            annotationToolbarHostId={`task-drawing-toolbar-${task.id}`}
                                                            onDrawingRecognized={canAnnotateTask ? openRecognizedDrawingSolution : undefined}
                                                        >
                                                            <div className="task-answer-inline-panel w-full max-w-[544px]">
                                                                <div className="flex flex-wrap items-end gap-3">
                                                                    <label className="answer-inline-row flex min-w-0 flex-1 items-end gap-2">
                                                                        <span className="shrink-0 text-base font-normal text-slate-700">
                                                                            {task.sub_tasks && task.sub_tasks.length > 0
                                                                                ? `Ответ${task.ege_number ? ` к заданию ${task.ege_number}` : ''}:`
                                                                                : 'Ответ:'}
                                                                        </span>
                                                                        <span className="min-w-[180px] flex-1">
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
                                                                        </span>
                                                                    </label>
                                                                    {!viewingFinishedExam && (!isVariant || !examInfo?.active_attempt) && (!task.sub_tasks || task.sub_tasks.length === 0) && (
                                                                        <button
                                                                            onClick={handleCheck}
                                                                            disabled={check.isPending}
                                                                            className="h-10 px-5 bg-[#4e8c5a] hover:bg-[#62aa78] disabled:opacity-50 text-white rounded-full text-sm font-bold shadow-[0_10px_22px_rgba(78,140,90,0.2)] transition-all shrink-0"
                                                                        >
                                                                            {check.isPending ? "..." : "Проверить"}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {checkResult === 'correct' && (
                                                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2.5 text-sm font-medium text-emerald-200">
                                                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-xs">✓</div>
                                                                        Правильный ответ!
                                                                    </div>
                                                                )}
                                                                {checkResult === 'wrong' && (
                                                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 p-2.5 text-sm font-medium text-red-200">
                                                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-400/20 text-xs">×</div>
                                                                        Неверно. Попробуйте ещё раз.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TaskView>
                                                        {task && recognizedDrawingSolutions[task.id] && (
                                                            <RecognizedSolutionBlock
                                                                text={recognizedDrawingSolutions[task.id].text}
                                                                sending={Boolean(solutionReviewSending[task.id])}
                                                                sent={Boolean(solutionReviewSent[task.id])}
                                                                onEdit={editRecognizedSolution}
                                                                onDelete={deleteRecognizedSolution}
                                                                onSendReview={sendRecognizedSolutionForReview}
                                                            />
                                                        )}
                                                    </div>
                                                    {false && (
                                                    <div className="mt-5 w-full max-w-[620px]">
                                                        <div className="flex flex-wrap items-end gap-3">
                                                            <label className="answer-inline-row flex min-w-0 flex-1 items-end gap-2">
                                                                <span className="shrink-0 text-sm font-bold text-slate-700">
                                                                    {task.sub_tasks && task.sub_tasks.length > 0
                                                                        ? `Ответ${task.ege_number ? ` к заданию ${task.ege_number}` : ''}:`
                                                                        : 'Ответ:'}
                                                                </span>
                                                                <span className="min-w-[180px] flex-1">
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
                                                                </span>
                                                            </label>
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
                                                            {!viewingFinishedExam && (!isVariant || !examInfo?.active_attempt) && (!task.sub_tasks || task.sub_tasks.length === 0) && (
                                                                <button
                                                                    onClick={handleCheck}
                                                                    disabled={check.isPending}
                                                                    className="h-10 px-5 bg-[#4e8c5a] hover:bg-[#62aa78] disabled:opacity-50 text-white rounded-full text-sm font-bold shadow-[0_10px_22px_rgba(78,140,90,0.2)] transition-all shrink-0"
                                                                >
                                                                    {check.isPending ? "..." : "Проверить"}
                                                                </button>
                                                            )}
                                                        </div>
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
                                                                                    annotationRefreshKey={annotationRefreshKey}
                                                                                    onDrawingRecognized={canAnnotateTask ? openRecognizedDrawingSolution : undefined}
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
                                                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-400/20 text-xs">×</div>
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
                                                    )}
                                                </div>
                                            )}

                                            {/* Answer section — bottom of task card */}
                                            {attachSolutionOpen && task && (
                                                <div className="task-solution-shell-card mt-6 w-full min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#07111D] shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
                                                    <TaskSolutionPanel
                                                        key={`${task.id}:${attachSolutionInitialTab}:${attachSolutionPrefillCode}`}
                                                        taskId={task.id}
                                                        initialTab={attachSolutionInitialTab}
                                                        prefillCode={attachSolutionPrefillCode}
                                                        textSolutionMode={attachSolutionTextMode}
                                                        onChanged={refreshCurrentTaskAndSolution}
                                                        onClose={closeAttachSolutionNow}
                                                        helpMode={solutionHelpMode}
                                                        conditionHidden={solutionHelpMode && !taskConditionVisibleInHelp}
                                                        onShowCondition={() => setTaskConditionVisibleInHelp(true)}
                                                        onHelpClose={() => {
                                                            setSolutionHelpMode(false);
                                                            setTaskConditionVisibleInHelp(false);
                                                            if (!solutionWasOpenBeforeHelpRef.current) {
                                                                setAttachSolutionOpen(false);
                                                            }
                                                            solutionWasOpenBeforeHelpRef.current = false;
                                                        }}
                                                        topContent={solutionHelpMode && taskConditionVisibleInHelp ? (
                                                            <div className="w-full min-w-0 rounded-[14px] border border-white/10 bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_34%),#08131D] p-5">
                                                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Условие задачи</div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setTaskConditionVisibleInHelp(false)}
                                                                            className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-slate-300 hover:bg-white/[0.08]"
                                                                        >
                                                                            <Eye size={14} />
                                                                            Скрыть условие
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                                                        {renderTaskActionButtons()}
                                                                    </div>
                                                                </div>
                                                                <div className="prose prose-invert max-w-none leading-relaxed text-slate-200">
                                                                    <TaskView
                                                                        content={task.content_html}
                                                                        files={task.media_resources?.files}
                                                                        annotatable={canAnnotateTask}
                                                                        annotationKey={`task:${task.id}:help`}
                                                                        annotationTaskId={task.id}
                                                                        annotationRefreshKey={annotationRefreshKey}
                                                                        annotationPanelOpen={drawingPanelOpen}
                                                                        onAnnotationPanelOpenChange={setDrawingPanelOpen}
                                                                        showAnnotationToggle={false}
                                                                        annotationToolbarHostId={`task-drawing-toolbar-${task.id}`}
                                                                        onDrawingRecognized={canAnnotateTask ? openRecognizedDrawingSolution : undefined}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : undefined}
                                                        registerBeforeClose={(handler) => {
                                                            attachSolutionBeforeCloseRef.current = handler;
                                                        }}
                                                    />
                                                </div>
                                            )}

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
                {false && attachSolutionOpen && task && (
                    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#07111D] p-3 sm:p-4 md:w-[min(1180px,calc(100vw-64px))] md:max-w-[78vw]">
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
                            textSolutionMode={attachSolutionTextMode}
                            onChanged={refreshCurrentTaskAndSolution}
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


