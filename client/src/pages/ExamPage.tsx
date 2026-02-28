import React, { useState, useEffect } from "react";
import { useNavigation, useStartExam, useSubmitExam } from "../hooks/useApi";
import TaskView from "../components/TaskView";
import AnswerInput from "../components/AnswerInput";
import Skeleton from "../components/Skeleton";
import type { AnswerVal } from "../api/types";
import "./ExamPage.css";

export default function ExamPage() {
    const { data: topics, isLoading: navLoading } = useNavigation();
    const [examId, setExamId] = useState<number | null>(null);
    const [started, setStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<Record<number, AnswerVal>>({});
    const [finishedResult, setFinishedResult] = useState<any>(null);

    const startExam = useStartExam(examId || 0);
    const submitExam = useSubmitExam(examId || 0);

    // Auto-find first available exam from topic data for demo purposes
    useEffect(() => {
        if (topics && topics.length > 0 && !examId) {
            // Logic would normally come from route params, let's assume exam 1
            setExamId(1);
        }
    }, [topics, examId]);

    useEffect(() => {
        if (started && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } else if (started && timeLeft === 0 && !finishedResult) {
            handleSubmit();
        }
    }, [started, timeLeft]);

    const handleStart = async () => {
        try {
            const resp = await startExam.mutateAsync();
            setStarted(true);
            setTimeLeft(resp.time_limit_minutes * 60);
        } catch (err) {
            alert("Не удалось начать экзамен");
        }
    };

    const handleSubmit = async () => {
        if (!examId) return;
        const payload = {
            answers: Object.entries(answers).map(([id, val]) => ({
                task_id: parseInt(id),
                answer: { val }
            }))
        };
        try {
            const res = await submitExam.mutateAsync(payload);
            setFinishedResult(res);
            setStarted(false);
        } catch (err) {
            alert("Ошибка при отправке ответов");
        }
    };

    if (navLoading) return <Skeleton />;

    if (finishedResult) {
        return (
            <div className="exam-result card fade-in">
                <h1>Результат экзамена</h1>
                <div className="score-badge">{finishedResult.score.toFixed(1)}%</div>
                <p>Правильных ответов: {finishedResult.correct_count} из {finishedResult.total_tasks}</p>
                <button className="btn btn-primary" onClick={() => window.location.href = "/"}>Вернуться к обучению</button>
            </div>
        );
    }

    if (!started) {
        return (
            <div className="exam-prestart card fade-in">
                <h1>Контрольный вариант</h1>
                <p>Время ограничено. ИИ-подсказки будут отключены.</p>
                <button className="btn btn-primary btn-lg" onClick={handleStart} disabled={startExam.isPending}>
                    {startExam.isPending ? "Загрузка..." : "Начать экзамен"}
                </button>
            </div>
        );
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="exam-workspace fade-in">
            <header className="exam-header">
                <div className="timer-box">Осталось времени: <span className="timer">{formatTime(timeLeft)}</span></div>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitExam.isPending}>
                    Завершить досрочно
                </button>
            </header>

            <div className="exam-tasks">
                {topics?.flatMap(t => t.tasks).map(task => (
                    <section key={task.id} className="exam-task-card card">
                        <TaskView content={`Задание ${task.id}`} />
                        <AnswerInput
                            type="single_number" // simplification, normally from task detail
                            value={answers[task.id] ?? 0}
                            onChange={(v) => setAnswers(prev => ({ ...prev, [task.id]: v }))}
                            disabled={submitExam.isPending}
                        />
                    </section>
                ))}
            </div>
        </div>
    );
}
