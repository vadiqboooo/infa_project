import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import TaskView from "../components/TaskView";
import AnswerInput from "../components/AnswerInput";
import ChatWidget from "../components/ChatWidget";
import MentorPanel from "../components/MentorPanel";
import ExamIntro from "../components/ExamIntro";
import ExamTimer from "../components/ExamTimer";
import Skeleton from "../components/Skeleton";
import { ArrowLeft, Send, Bot, X, Code2, BookOpen, ChevronRight, CheckCircle2, HelpCircle } from "lucide-react";
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

export default function TasksPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [taskIndex, setTaskIndex] = useState(0);
    const [savedAnswers, setSavedAnswers] = useState<Record<number, AnswerVal>>(() => {
        try { return JSON.parse(localStorage.getItem('edu_task_answers') || '{}'); } catch { return {}; }
    });
    const [checkResult, setCheckResult] = useState<'correct' | 'wrong' | null>(null);
    const [showChat, setShowChat] = useState(true);
    const [mentorOpen, setMentorOpen] = useState(false);
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

    useEffect(() => {
        if (allTopics && !currentTopic && id) {
            navigate(backPath);
        }
    }, [allTopics, currentTopic, id, navigate, backPath]);

    const tasks: TaskNav[] = currentTopic?.tasks ?? [];
    const currentTaskNav = tasks[taskIndex] ?? null;

    const isVariant = currentTopic?.category === "variants";
    const { data: examInfo } = useExamByTopic(isVariant ? currentTopic?.id ?? null : null);
    const startExam = useStartExam(examInfo?.id ?? 0);
    const submitExam = useSubmitExam(examInfo?.id ?? 0);
    const hasFinishedAttempt = examInfo?.finished_attempt != null;

    const { data: task, isLoading: taskLoading } = useTask(currentTaskNav?.id ?? null);
    const check = useCheckAnswer(currentTaskNav?.id ?? 0);

    // Persist answers to localStorage
    useEffect(() => {
        try { localStorage.setItem('edu_task_answers', JSON.stringify(savedAnswers)); } catch {}
    }, [savedAnswers]);

    // Reset check result when task changes
    useEffect(() => {
        setCheckResult(null);
    }, [taskIndex, id]);

    const answer = savedAnswers[currentTaskNav?.id ?? 0] ?? 0;

    const handleCheck = async () => {
        if (!currentTaskNav) return;
        try {
            const res = await check.mutateAsync(answer);
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
            <div className="h-14 flex items-center px-6 bg-white shrink-0 border-b border-gray-100">
                <div className="flex items-center gap-3 w-full">
                    <button
                        onClick={() => navigate(backPath)}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>Назад</span>
                    </button>
                    <div className="w-px h-5 bg-gray-200" />
                    <h1 className="font-bold text-gray-900 truncate">{currentTopic.title}</h1>
                    
                    <div className="ml-auto flex items-center gap-3">
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
                                    {submitExam.isPending ? "Отправка..." : "Завершить экзамен"}
                                </button>
                            </>
                        ) : null}
                        <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                            <Code2 size={11} />
                            Python
                        </span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 pt-8" style={{ minWidth: 0 }}>
                    {!isVariant || !examInfo || (examInfo.active_attempt && !examResult) || viewingFinishedExam ? (
                        <>
                            {/* Task Navigation Row */}
                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                                {tasks.map((t, idx) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTaskIndex(idx)}
                                        className={clsx(
                                            'w-10 h-10 shrink-0 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center relative',
                                            idx === taskIndex
                                                ? 'bg-[#3F8C62] text-white shadow-md'
                                                : t.status === 'solved'
                                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    : t.status === 'failed'
                                                        ? 'bg-red-100 text-red-700 border border-red-300'
                                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600'
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

                            {/* Content */}
                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                                {/* Left: Task Card */}
                                <div className="flex-1 w-full bg-white border border-gray-200 rounded-xl p-6 min-h-[300px] shadow-sm relative">
                                    {taskLoading ? (
                                        <Skeleton />
                                    ) : task ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className={clsx(
                                                    'px-2 py-0.5 rounded-full text-xs font-medium',
                                                    task.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                                    task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                )}>
                                                    {task.difficulty === 'easy' ? 'Лёгкая' : task.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    Задание {taskIndex + 1} — {task.title || 'Информатика'}
                                                </span>
                                                <div className="ml-auto flex items-center gap-2">
                                                    {(!isVariant || !examInfo?.active_attempt) && (
                                                        <button
                                                            onClick={() => setMentorOpen(o => !o)}
                                                            className={clsx(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                                                                mentorOpen
                                                                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                                                    : "text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100"
                                                            )}
                                                        >
                                                            <HelpCircle size={13} />
                                                            Помощь
                                                        </button>
                                                    )}
                                                    {task.solution_steps && task.solution_steps.length > 0 && (
                                                        <button
                                                            onClick={() => setSolutionOpen(true)}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[#3F8C62] bg-[#3F8C62]/5 border border-[#3F8C62]/20 hover:bg-[#3F8C62]/10 hover:border-[#3F8C62]/40 transition-all group/sol"
                                                            title="Пошаговое решение"
                                                        >
                                                            <BookOpen size={13} className="group-hover/sol:scale-110 transition-transform" />
                                                            <span className="text-xs font-bold uppercase tracking-tight">Разбор</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed">
                                                <TaskView
                                                    content={task.content_html}
                                                    files={task.media_resources?.files}
                                                />
                                            </div>

                                            {/* Answer section — bottom of task card */}
                                            <div className="mt-6 pt-4 border-t border-gray-100 max-w-[40%]">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Ваш ответ</div>
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
                                                                }
                                                            }}
                                                            disabled={check.isPending || viewingFinishedExam}
                                                        />
                                                    </div>
                                                    {!viewingFinishedExam && (!isVariant || !examInfo?.active_attempt) && (
                                                        <button
                                                            onClick={handleCheck}
                                                            disabled={check.isPending}
                                                            className="mt-5 px-5 py-2 bg-[#3F8C62] hover:bg-[#357A54] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
                                                        >
                                                            {check.isPending ? "..." : "Проверить"}
                                                        </button>
                                                    )}
                                                </div>

                                                {checkResult === 'correct' && (
                                                    <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg text-emerald-700 text-sm font-medium flex items-center gap-2">
                                                        <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center text-xs">✓</div>
                                                        Правильный ответ!
                                                    </div>
                                                )}
                                                {checkResult === 'wrong' && (
                                                    <div className="mt-3 p-2.5 bg-red-50 rounded-lg text-red-600 text-sm font-medium flex items-center gap-2">
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
