import React from "react";
import { useNavigation } from "../hooks/useApi";
import type { TaskNav, TopicNav } from "../api/types";
import "./Sidebar.css";

interface Props {
    selectedTopicId: number | null;
    onSelectTopic: (topic: TopicNav) => void;
    mode: "tutorial" | "practice";
    onToggleMode: () => void;
}

function topicProgress(tasks: TaskNav[]): { solved: number; total: number; pct: number } {
    const total = tasks.length;
    const solved = tasks.filter((t) => t.status === "solved").length;
    return { solved, total, pct: total > 0 ? Math.round((solved / total) * 100) : 0 };
}

export default function Sidebar({ selectedTopicId, onSelectTopic, mode, onToggleMode }: Props) {
    const { data: topics, isLoading } = useNavigation();

    if (isLoading) {
        return (
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="skeleton skeleton-title" style={{ width: "80%" }} />
                </div>
                <div className="sidebar-content">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton skeleton-text" style={{ margin: "0.75rem 1rem" }} />
                    ))}
                </div>
            </aside>
        );
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2 className="sidebar-title">Темы</h2>
                <div className="mode-toggle">
                    <span className={mode === "tutorial" ? "active" : ""}>Разбор</span>
                    <button className={`toggle-btn ${mode}`} onClick={onToggleMode}>
                        <div className="toggle-thumb" />
                    </button>
                    <span className={mode === "practice" ? "active" : ""}>Практика</span>
                </div>
            </div>

            <nav className="sidebar-content">
                {topics?.map((topic) => {
                    const { solved, total, pct } = topicProgress(topic.tasks);
                    const isActive = selectedTopicId === topic.id;
                    return (
                        <div
                            key={topic.id}
                            className={`topic-item ${isActive ? "active" : ""}`}
                            onClick={() => onSelectTopic(topic)}
                        >
                            <div className="topic-item-top">
                                <span className="topic-item-title">{topic.title}</span>
                                <span className="topic-item-pct">{pct}%</span>
                            </div>
                            <div className="topic-progress-track">
                                <div
                                    className="topic-progress-fill"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="topic-item-sub">{solved} / {total} решено</span>
                        </div>
                    );
                })}
                {topics?.length === 0 && (
                    <p className="sidebar-empty">Нет тем. Добавьте их в админке.</p>
                )}
            </nav>
        </aside>
    );
}
