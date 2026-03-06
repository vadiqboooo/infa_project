import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Timer, Send, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Save, Check } from "lucide-react";
import { clsx } from "clsx";
import { useTask, useNavigation, useExamByTopic, useStartExam, useSubmitExam } from "../hooks/useApi";
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

    const currentTaskNav = tasks[taskIndex] ?? null;
    const { data: examInfo, isLoading: examLoading } = useExamByTopic(currentTopic?.id ?? null);
    const { data: task, isLoading: taskLoading } = useTask(currentTaskNav?.id ?? null);
    
    const startExamMutation = useStartExam(examInfo?.id ?? 0);
    const submitExamMutation = useSubmitExam(examInfo?.id ?? 0);

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
                }))
            };
            const res = await submitExamMutation.mutateAsync(payload);
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

        return (
            <div className="min-h-screen bg-[#F8F7F4] py-10 px-4">
                <div className="max-w-3xl mx-auto">
                    {/* Score Card */}
                    <div className="bg-white border border-gray-200 rounded-[32px] p-10 text-center shadow-xl shadow-gray-200/50 mb-8">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Вариант завершен</h1>
                        <p className="text-gray-500 text-sm mb-8">Результаты успешно сохранены в вашей истории обучения</p>

                        <div className="bg-gray-50 rounded-2xl p-6 mb-8 flex flex-col items-center">
                            <div className="text-5xl font-black text-[#3F8C62] mb-1">
                                {result.score.toFixed(0)}
                            </div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">баллов получено</div>

                            <div className="w-full h-px bg-gray-200 my-5" />

                            <div className="grid grid-cols-2 gap-y-6 gap-x-8 w-full">
                                <div>
                                    <div className="text-lg font-bold text-gray-900">{result.primary_score} / 29</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">первичный балл</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900">{result.correct_count ?? taskResults.filter(r => r.is_correct).length}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">верных заданий</div>
                                </div>
                                <div className="col-span-2 pt-4 border-t border-gray-100 flex justify-center">
                                    <div className="text-xs font-medium text-gray-400">
                                        Всего заданий в варианте: <span className="text-gray-900 font-bold">{result.total_tasks ?? taskResults.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate('/exams')}
                                className="w-full py-3.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#3F8C62]/20"
                            >
                                К списку вариантов
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-3.5 text-gray-500 hover:text-gray-700 font-bold transition-all"
                            >
                                На главную
                            </button>
                        </div>
                    </div>

                    {/* Results Table */}
                    {taskResults.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-[24px] p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Подробные результаты</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">№</th>
                                            <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ваш ответ</th>
                                            <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Правильный ответ</th>
                                            <th className="text-center py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Балл</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taskResults
                                            .sort((a, b) => (a.ege_number || 0) - (b.ege_number || 0))
                                            .map((tr, idx) => (
                                            <tr
                                                key={tr.task_id}
                                                className={clsx(
                                                    "border-b border-gray-50 transition-colors",
                                                    tr.is_correct ? "bg-emerald-50/50" : "bg-red-50/30"
                                                )}
                                            >
                                                <td className="py-3 px-3 font-bold text-gray-700">
                                                    {tr.ege_number || idx + 1}
                                                </td>
                                                <td className="py-3 px-3 text-gray-600 font-mono text-xs">
                                                    {formatAnswer(tr.user_answer)}
                                                </td>
                                                <td className="py-3 px-3 text-gray-600 font-mono text-xs">
                                                    {formatAnswer(tr.correct_answer)}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={clsx(
                                                        "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold",
                                                        tr.is_correct
                                                            ? "bg-[#3F8C62] text-white"
                                                            : "bg-gray-100 text-gray-400"
                                                    )}>
                                                        {tr.points}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
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
                    <p className="text-gray-500 text-sm mb-8">Контрольный вариант для проверки знаний</p>
                    
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
