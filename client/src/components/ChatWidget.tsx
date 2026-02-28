import React, { useState, useRef, useEffect } from "react";
import { useAIAssist } from "../hooks/useApi";
import type { AIMode } from "../api/types";
import "./ChatWidget.css";

interface Message {
    role: "user" | "assistant";
    text: string;
}

interface Props {
    taskId: number;
    mode: AIMode;
    disabled?: boolean;
}

export default function ChatWidget({ taskId, mode, disabled }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const assist = useAIAssist(taskId);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!query.trim() || assist.isPending) return;

        const userMsg: Message = { role: "user", text: query };
        setMessages(prev => [...prev, userMsg]);
        setQuery("");

        try {
            const res = await assist.mutateAsync({ user_query: query, mode });
            setMessages(prev => [...prev, { role: "assistant", text: res.hint }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: "assistant", text: "Ошибка: не удалось получить ответ от ИИ." }]);
        }
    };

    if (disabled) return null;

    return (
        <div className={`chat-widget ${isOpen ? "open" : "closed"}`}>
            <button className="chat-toggle btn-primary" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? "✕" : "🤖 Помощь ИИ"}
            </button>

            {isOpen && (
                <div className="chat-container fade-in">
                    <div className="chat-header">
                        <h3>ИИ-Ассистент ({mode === "tutorial" ? "Разбор" : "Практика"})</h3>
                    </div>

                    <div className="chat-messages" ref={scrollRef}>
                        {messages.length === 0 && (
                            <p className="no-msgs">Задайте вопрос по задаче...</p>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`msg ${m.role}`}>
                                {m.text}
                            </div>
                        ))}
                        {assist.isPending && <div className="msg assistant typing">Думаю...</div>}
                    </div>

                    <div className="chat-input-area">
                        <input
                            type="text"
                            className="input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Как решить эту задачу?"
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={assist.isPending}>
                            →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
