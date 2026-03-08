import React, { useState, useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { X, Send, Bot, Code2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { useAIAssist } from "../hooks/useApi";

interface Message {
    role: "ai" | "user";
    text: string;
    isCode?: boolean;
}

interface Props {
    taskId: number;
    onClose: () => void;
}

const INITIAL_MESSAGE: Message = {
    role: "ai",
    text: "Привет! Я помогу разобраться с задачей. Для начала поделись своим кодом — вставь решение в редактор ниже и нажми «Отправить код».",
};

export default function MentorPanel({ taskId, onClose }: Props) {
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [code, setCode] = useState("");
    const [query, setQuery] = useState("");
    const [savedCode, setSavedCode] = useState<string | null>(null);
    const [codeEditorOpen, setCodeEditorOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryInputRef = useRef<HTMLInputElement>(null);

    const assist = useAIAssist(taskId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendCode = async () => {
        if (!code.trim()) return;
        const codeSnapshot = code.trim();
        setSavedCode(codeSnapshot);
        setCodeEditorOpen(false);

        const userMsg: Message = { role: "user", text: codeSnapshot, isCode: true };
        setMessages(prev => [...prev, userMsg]);

        try {
            const res = await assist.mutateAsync({
                user_query: "",
                mode: "tutorial",
                user_code: codeSnapshot,
            });
            setMessages(prev => [...prev, { role: "ai", text: res.hint }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Не удалось получить ответ. Попробуй ещё раз." }]);
        }
    };

    const sendQuery = async () => {
        const q = query.trim();
        if (!q || assist.isPending) return;
        setQuery("");

        const userMsg: Message = { role: "user", text: q };
        setMessages(prev => [...prev, userMsg]);

        try {
            const res = await assist.mutateAsync({
                user_query: q,
                mode: "tutorial",
                user_code: savedCode ?? undefined,
            });
            setMessages(prev => [...prev, { role: "ai", text: res.hint }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Не удалось получить ответ. Попробуй ещё раз." }]);
        }
    };

    const resetCode = () => {
        setSavedCode(null);
        setCodeEditorOpen(true);
        setCode("");
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
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
                    <div key={i} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "ai" && (
                            <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                                <Bot size={12} />
                            </div>
                        )}
                        <div className={clsx(
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                            msg.role === "ai"
                                ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                                : msg.isCode
                                    ? "bg-violet-600 text-white rounded-tr-sm font-mono text-xs whitespace-pre-wrap"
                                    : "bg-[#3F8C62] text-white rounded-tr-sm"
                        )}>
                            {msg.isCode ? (
                                <div>
                                    <div className="flex items-center gap-1 mb-1 opacity-70 text-[10px]">
                                        <Code2 size={10} />
                                        код решения
                                    </div>
                                    <pre className="whitespace-pre-wrap">{msg.text}</pre>
                                </div>
                            ) : msg.text}
                        </div>
                    </div>
                ))}
                {assist.isPending && (
                    <div className="flex justify-start">
                        <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
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

            {/* Code editor area */}
            <div className="border-t border-gray-100 shrink-0">
                {savedCode ? (
                    /* Code already submitted — show compact strip */
                    <div className="px-4 py-2 flex items-center justify-between bg-violet-50">
                        <button
                            onClick={() => setCodeEditorOpen(o => !o)}
                            className="flex items-center gap-1.5 text-xs text-violet-600 font-medium"
                        >
                            <Code2 size={12} />
                            Код прикреплён
                            {codeEditorOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                        </button>
                        <button onClick={resetCode} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                            <RotateCcw size={11} />
                            Изменить
                        </button>
                    </div>
                ) : (
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                            <Code2 size={12} />
                            Твой код
                        </span>
                    </div>
                )}

                {codeEditorOpen && (
                    <div className="px-4 pb-3">
                        <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                            <CodeMirror
                                value={code}
                                onChange={setCode}
                                extensions={[python()]}
                                theme={githubLight}
                                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                                style={{ fontSize: "12px", maxHeight: "200px", overflowY: "auto" }}
                                placeholder="# Вставь свой код сюда..."
                            />
                        </div>
                        <button
                            onClick={sendCode}
                            disabled={!code.trim() || assist.isPending}
                            className="mt-2 w-full py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Send size={14} />
                            Отправить код
                        </button>
                    </div>
                )}
            </div>

            {/* Text question input */}
            <div className="px-4 pb-4 shrink-0">
                <div className="flex gap-2">
                    <input
                        ref={queryInputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && sendQuery()}
                        placeholder="Задай вопрос..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all"
                    />
                    <button
                        onClick={sendQuery}
                        disabled={!query.trim() || assist.isPending}
                        className="w-9 h-9 bg-[#3F8C62] hover:bg-[#357A54] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
