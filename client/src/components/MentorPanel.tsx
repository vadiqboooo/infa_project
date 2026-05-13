import React, { useState, useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubDark } from "@uiw/codemirror-theme-github";
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
        <div className="flex h-full flex-col border-l border-white/10 bg-[#07111D]">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/12 text-violet-200">
                        <Bot size={15} />
                    </div>
                    <div>
                        <div className="text-sm font-bold leading-none text-white">ИИ-наставник</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">Python · ЕГЭ Информатика</div>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-500 transition-colors hover:text-white">
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                    <div key={i} className={clsx("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
                        {msg.role === "ai" && (
                            <div className="flex items-start gap-2 max-w-[90%]">
                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-violet-200">
                                    <Bot size={12} />
                                </div>
                                <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3 py-2 text-sm leading-relaxed text-slate-200 ring-1 ring-white/10">
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
                                    <div className="rounded-2xl rounded-tr-sm bg-emerald-500 px-3 py-2 text-sm leading-relaxed text-white">
                                        {msg.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {assist.isPending && (
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-violet-200">
                            <Bot size={12} />
                        </div>
                        <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
                            <div className="flex gap-1 items-center h-5">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Code editor */}
            <div className="shrink-0 border-t border-white/10">
                <button
                    onClick={() => setCodeOpen(o => !o)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
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
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0A1522]">
                            <CodeMirror
                                value={code}
                                onChange={setCode}
                                extensions={[python()]}
                                theme={githubDark}
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
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white transition-all placeholder:text-slate-600 focus:border-violet-300/40 focus:outline-none focus:ring-1 focus:ring-violet-300/20"
                    />
                    <button
                        onClick={handleSend}
                        disabled={(!query.trim() && !code.trim()) || assist.isPending}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
