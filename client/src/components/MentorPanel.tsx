import React, { useState, useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { X, Send, Bot, Code2, ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import { useAIAssist } from "../hooks/useApi";

interface Message {
    role: "ai" | "user";
    text: string;
    code?: string;
}

interface Props {
    taskId: number;
    onClose: () => void;
}

const INITIAL_MESSAGE: Message = {
    role: "ai",
    text: "Привет! Вставь свой код в редактор ниже, напиши вопрос и нажми «Отправить» — я посмотрю и помогу разобраться.",
};

export default function MentorPanel({ taskId, onClose }: Props) {
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [code, setCode] = useState("");
    const [query, setQuery] = useState("");
    const [codeOpen, setCodeOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const assist = useAIAssist(taskId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const q = query.trim();
        const c = code.trim();
        if ((!q && !c) || assist.isPending) return;

        setQuery("");

        const userMsg: Message = { role: "user", text: q, code: c || undefined };
        setMessages(prev => [...prev, userMsg]);

        try {
            const res = await assist.mutateAsync({
                user_query: q,
                mode: "tutorial",
                user_code: c || undefined,
            });
            setMessages(prev => [...prev, { role: "ai", text: res.hint }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Не удалось получить ответ. Попробуй ещё раз." }]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                        <Bot size={15} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-800 leading-none">ИИ-наставник</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Python · ЕГЭ Информатика</div>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                    <div key={i} className={clsx("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
                        {msg.role === "ai" && (
                            <div className="flex items-start gap-2 max-w-[90%]">
                                <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot size={12} />
                                </div>
                                <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed">
                                    {msg.text}
                                </div>
                            </div>
                        )}
                        {msg.role === "user" && (
                            <div className="max-w-[90%] flex flex-col items-end gap-1">
                                {msg.code && (
                                    <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-xs font-mono w-full">
                                        <div className="flex items-center gap-1 mb-1 opacity-70 text-[10px]">
                                            <Code2 size={10} /> код
                                        </div>
                                        <pre className="whitespace-pre-wrap">{msg.code}</pre>
                                    </div>
                                )}
                                {msg.text && (
                                    <div className="bg-[#3F8C62] text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed">
                                        {msg.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {assist.isPending && (
                    <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot size={12} />
                        </div>
                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
                            <div className="flex gap-1 items-center h-5">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Code editor */}
            <div className="border-t border-gray-100 shrink-0">
                <button
                    onClick={() => setCodeOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                    <span className="flex items-center gap-1.5">
                        <Code2 size={12} />
                        {code.trim() ? "Код прикреплён" : "Прикрепить код"}
                        {code.trim() && <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />}
                    </span>
                    {codeOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </button>

                {codeOpen && (
                    <div className="px-4 pb-3">
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <CodeMirror
                                value={code}
                                onChange={setCode}
                                extensions={[python()]}
                                theme={githubLight}
                                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                                style={{ fontSize: "12px", maxHeight: "180px", overflowY: "auto" }}
                                placeholder="# Вставь свой код сюда..."
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Question input + send */}
            <div className="px-4 pb-4 shrink-0">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSend()}
                        placeholder="Задай вопрос или отправь код..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={(!query.trim() && !code.trim()) || assist.isPending}
                        className="w-9 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
