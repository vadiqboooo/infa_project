import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import TaskView from "../components/TaskView";
import AnswerInput from "../components/AnswerInput";
import ChatWidget from "../components/ChatWidget";
import Skeleton from "../components/Skeleton";
import { useTask, useCheckAnswer, useNavigation } from "../hooks/useApi";
import type { AnswerVal, TaskNav, TopicNav } from "../api/types";
import confetti from "canvas-confetti";
import "./MainPage.css";

export default function MainPage() {
    const [selectedTopic, setSelectedTopic] = useState<TopicNav | null>(null);
    const [taskIndex, setTaskIndex] = useState(0);
    const [mode, setMode] = useState<"tutorial" | "practice">("tutorial");
    const [userAnswer, setUserAnswer] = useState<AnswerVal>(0);

    const { data: topics } = useNavigation();

    // Keep selectedTopic in sync with fresh navigation data (progress updates)
    const liveTopic = topics?.find((t) => t.id === selectedTopic?.id) ?? selectedTopic;
    const tasks: TaskNav[] = liveTopic?.tasks ?? [];
    const currentTask = tasks[taskIndex] ?? null;

    const { data: task, isLoading: taskLoading } = useTask(currentTask?.id ?? null);
    const check = useCheckAnswer(currentTask?.id ?? 0);

    function handleSelectTopic(topic: TopicNav) {
        setSelectedTopic(topic);
        setTaskIndex(0);
        setUserAnswer(0);
        check.reset();
    }

    function handleSelectIndex(idx: number) {
        setTaskIndex(idx);
        setUserAnswer(0);
        check.reset();
    }

    const handleCheck = async () => {
        if (!currentTask) return;
        try {
            const res = await check.mutateAsync(userAnswer);
            if (res.correct) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ["#6366f1", "#34d399", "#fbbf24"],
                });
            }
        } catch {
            // handled by useApi
        }
    };

    return (
        <div className="main-layout">
            <Sidebar
                selectedTopicId={selectedTopic?.id ?? null}
                onSelectTopic={handleSelectTopic}
                mode={mode}
                onToggleMode={() => setMode(mode === "tutorial" ? "practice" : "tutorial")}
            />

            <main className="workspace">
                {!selectedTopic ? (
                    <div className="empty-state fade-in">
                        <div className="empty-icon">📂</div>
                        <h2>Выберите тему из списка слева</h2>
                        <p>Ваш прогресс сохраняется автоматически</p>
                    </div>
                ) : (
                    <>
                        {/* ── Task navigation bar ── */}
                        <div className="task-bar">
                            <button
                                className="task-bar-arrow"
                                onClick={() => handleSelectIndex(taskIndex - 1)}
                                disabled={taskIndex === 0}
                                aria-label="Предыдущая задача"
                            >
                                ‹
                            </button>

                            <div className="task-bar-pills">
                                {tasks.map((t, idx) => (
                                    <button
                                        key={t.id}
                                        className={`task-pill ${t.status} ${idx === taskIndex ? "current" : ""}`}
                                        onClick={() => handleSelectIndex(idx)}
                                        title={`Задача ${idx + 1}`}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>

                            <button
                                className="task-bar-arrow"
                                onClick={() => handleSelectIndex(taskIndex + 1)}
                                disabled={taskIndex === tasks.length - 1}
                                aria-label="Следующая задача"
                            >
                                ›
                            </button>
                        </div>

                        {/* ── Task content ── */}
                        {taskLoading ? (
                            <Skeleton />
                        ) : task ? (
                            <div className="task-container fade-in">
                                <TaskView
                                    title={`Задача ${taskIndex + 1}`}
                                    content={task.content_html}
                                    files={task.media_resources?.files}
                                />

                                <div className="answer-card card fade-in">
                                    <AnswerInput
                                        type={task.answer_type}
                                        value={userAnswer}
                                        onChange={setUserAnswer}
                                        disabled={check.isPending}
                                    />

                                    <div className="actions">
                                        <button
                                            className="btn btn-primary btn-lg"
                                            onClick={handleCheck}
                                            disabled={check.isPending}
                                        >
                                            {check.isPending ? "Проверка..." : "Проверить ответ"}
                                        </button>

                                        {check.data && (
                                            <div className={`feedback ${check.data.correct ? "success" : "error"}`}>
                                                {check.data.correct ? "Верно!" : "Попробуйте ещё раз"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <ChatWidget taskId={task.id} mode={mode} />
                            </div>
                        ) : null}
                    </>
                )}
            </main>
        </div>
    );
}
