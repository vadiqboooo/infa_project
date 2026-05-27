import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { AlertCircle, Bot, CheckCircle2, Code2, ExternalLink, Eye, FileUp, HelpCircle, History, ImageUp, Loader2, Maximize2, MessageSquare, Save, Send, UserRound, X } from "lucide-react";
import { api, authFetch } from "../api/client";
import { AIMode, type TaskSolutionHelpThread } from "../api/types";
import { createCodeCommentExtensions } from "./codeCommentExtensions";
import { useAIAssist, useRequestTeacherHelp, useResolveTaskSolutionHelpThread, useSendTaskSolutionHelpMessage, useTaskSolutionHelpThread } from "../hooks/useApi";

type SolutionComment = {
  id: number;
  from_offset?: number | null;
  to_offset?: number | null;
  from_line: number;
  from_col: number;
  to_line: number;
  to_col: number;
  target_type?: "code" | "image" | null;
  image_x?: number | null;
  image_y?: number | null;
  image_drawing?: ImageDrawingStroke[] | null;
  text: string;
  created_at: string | null;
  updated_at?: string | null;
  reaction?: string | null;
};

type ImageDrawingStroke = {
  points: { x: number; y: number }[];
  color: string;
  width: number;
};

function strokePoints(stroke: ImageDrawingStroke) {
  return stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
}

type SolutionVersion = {
  id: number;
  code: string | null;
  file_url: string | null;
  image_url: string | null;
  change_type: string;
  created_at: string | null;
};

interface TaskSolution {
  task_id: number;
  code: string | null;
  recognized_text: string | null;
  file_url: string | null;
  image_url: string | null;
  updated_at: string | null;
  comments?: SolutionComment[];
  versions?: SolutionVersion[];
}

export function TaskSolutionPanel({
  taskId,
  disabled = false,
  initialTab = "code",
  prefillCode = "",
  textSolutionMode = false,
  onChanged,
  onClose,
  registerBeforeClose,
  helpMode = false,
  conditionHidden = false,
  onShowCondition,
  onHelpClose,
  topContent,
}: {
  taskId: number;
  disabled?: boolean;
  initialTab?: "code" | "file" | "image";
  prefillCode?: string;
  textSolutionMode?: boolean;
  onChanged?: () => void;
  onClose?: () => void;
  registerBeforeClose?: (handler: (() => boolean) | null) => void;
  helpMode?: boolean;
  conditionHidden?: boolean;
  onShowCondition?: () => void;
  onHelpClose?: () => void;
  topContent?: ReactNode;
}) {
  const [solution, setSolution] = useState<TaskSolution | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [helpRequested, setHelpRequested] = useState(false);
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(helpMode);
  const [helpTab, setHelpTab] = useState<"ai" | "teacher">("ai");
  const [aiMessages, setAiMessages] = useState<Array<{ role: "ai" | "user"; text: string; code?: string }>>([
    {
      role: "ai",
      text: "Привет! Я помогу разобраться в задаче. Отправь решение или вопрос, а я проверю ход мысли и подскажу, что улучшить.",
    },
  ]);
  const [aiMessage, setAiMessage] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [showComments, setShowComments] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "file" | "image">(initialTab);
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const helpRequest = useRequestTeacherHelp(taskId);
  const helpThreadQuery = useTaskSolutionHelpThread(taskId, !loading);
  const sendHelpMessage = useSendTaskSolutionHelpMessage(taskId);
  const resolveHelpThread = useResolveTaskSolutionHelpThread(taskId);
  const aiAssist = useAIAssist(taskId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSolution(null);
    setCode("");
    setSaved(false);
    setHelpRequested(false);
    setHelpChatOpen(false);
    setHelpPanelOpen(helpMode);
    setHelpTab("ai");
    setAiMessage("");
    setAiMessages([
      {
        role: "ai",
        text: "Привет! Я помогу разобраться в задаче. Отправь решение или вопрос, а я проверю ход мысли и подскажу, что улучшить.",
      },
    ]);
    setHelpMessage("");
    api<TaskSolution>(`/tasks/${taskId}/solution`)
      .then((data) => {
        if (cancelled) return;
        setSolution(data);
        setCode(prefillCode || (textSolutionMode ? data.recognized_text : data.code) || "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, textSolutionMode]);

  useEffect(() => {
    setHelpPanelOpen(helpMode);
    if (helpMode) setHelpTab("ai");
  }, [helpMode]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!prefillCode) return;
    setCode(prefillCode);
  }, [prefillCode]);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/tasks/${taskId}/solution/comments/ws?token=${encodeURIComponent(token)}`
    );

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: "comment_created"; comment: SolutionComment }
          | { type: "comment_updated"; comment: SolutionComment }
          | { type: "comment_deleted"; comment_id: number }
          | { type: "help_thread_updated"; thread: TaskSolutionHelpThread };

        if (payload.type === "help_thread_updated") {
          queryClient.setQueryData(["task-solution-help-thread", taskId], payload.thread);
          queryClient.invalidateQueries({ queryKey: ["admin-help-notifications"] });
          onChanged?.();
          return;
        }

        setSolution((prev) => {
          const current = prev ?? { task_id: taskId, code: null, recognized_text: null, file_url: null, image_url: null, updated_at: null, comments: [], versions: [] };
          const comments = current.comments ?? [];
          if (payload.type === "comment_created") {
            return comments.some((comment) => comment.id === payload.comment.id)
              ? current
              : { ...current, comments: [...comments, payload.comment] };
          }
          if (payload.type === "comment_updated") {
            return {
              ...current,
              comments: comments.map((comment) => comment.id === payload.comment.id ? payload.comment : comment),
            };
          }
          return {
            ...current,
            comments: comments.filter((comment) => comment.id !== payload.comment_id),
          };
        });
        onChanged?.();
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    return () => ws.close();
  }, [onChanged, queryClient, taskId]);

  async function saveCode() {
    setSaving(true);
    setSaved(false);
    try {
      const data = await api<TaskSolution>(`/tasks/${taskId}/solution`, {
        method: "PUT",
        body: JSON.stringify(textSolutionMode ? { recognized_text: code } : { code }),
      });
      setSolution(data);
      onChanged?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  async function recognizeImageToLatex() {
    setRecognizing(true);
    setOcrError(null);
    try {
      const data = await api<{ text: string; raw_text: string }>(`/tasks/${taskId}/solution/ocr-image`, {
        method: "POST",
      });
      setCode((prev) => {
        const current = prev.trim();
        return current ? `${current}\n\n${data.text}` : data.text;
      });
      const savedSolution = await api<TaskSolution>(`/tasks/${taskId}/solution`, {
        method: "PUT",
        body: JSON.stringify(textSolutionMode ? { recognized_text: data.text } : { code: data.text }),
      });
      setSolution(savedSolution);
      onChanged?.();
      setActiveTab("code");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "Не удалось распознать изображение");
    } finally {
      setRecognizing(false);
    }
  }

  const upload = useCallback(async (kind: "file" | "image", file: File | undefined) => {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch(`/api/tasks/${taskId}/solution/upload/${kind}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setSolution(data);
      setOcrError(null);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }, [onChanged, taskId]);

  const uploadImageFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const hasExtension = /\.[a-z0-9]+$/i.test(file.name);
    const extensionByType: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    const uploadFile = hasExtension
      ? file
      : new File([file], `clipboard-image${extensionByType[file.type] ?? ".png"}`, { type: file.type });
    void upload("image", uploadFile);
  }, [upload]);

  const handleImagePaste = useCallback((event: ClipboardEvent | ReactClipboardEvent<HTMLElement>) => {
    if (activeTab !== "image" || disabled || saving) return;
    const file = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    event.preventDefault();
    uploadImageFile(file);
  }, [activeTab, disabled, saving, uploadImageFile]);

  const setCommentReaction = useCallback(async (commentId: number, reaction: "fixed" | "need_help") => {
    setSolution((prev) => prev ? {
      ...prev,
      comments: (prev.comments ?? []).map((comment) =>
        comment.id === commentId ? { ...comment, reaction } : comment
      ),
    } : prev);
    await api(`/tasks/solution-comments/${commentId}/reaction`, {
      method: "POST",
      body: JSON.stringify({ reaction }),
    });
  }, []);

  async function requestTeacherHelp() {
    await helpRequest.mutateAsync({
      message: "Ученик попросил помощь у преподавателя по этому решению",
    });
    setHelpRequested(true);
    setHelpPanelOpen(true);
    setHelpTab("teacher");
    helpThreadQuery.refetch();
  }

  async function sendForTeacherReview() {
    await helpRequest.mutateAsync({
      message: "Ученик отправил своё решение на проверку",
    });
    setHelpRequested(true);
    setHelpPanelOpen(true);
    setHelpTab("teacher");
    helpThreadQuery.refetch();
  }

  async function sendAiMessage() {
    const text = aiMessage.trim();
    const attachedCode = code.trim();
    if ((!text && !attachedCode) || aiAssist.isPending) return;

    setAiMessage("");
    setAiMessages((current) => [...current, { role: "user", text: text || "Проверь моё решение.", code: attachedCode || undefined }]);
    try {
      const response = await aiAssist.mutateAsync({
        user_query: text || "Проверь моё решение и дай подсказки без полного решения.",
        mode: AIMode.tutorial,
        user_code: attachedCode || undefined,
      });
      setAiMessages((current) => [...current, { role: "ai", text: response.hint }]);
    } catch {
      setAiMessages((current) => [...current, { role: "ai", text: "Не удалось получить ответ. Попробуй ещё раз." }]);
    }
  }

  async function sendHelpThreadMessage() {
    const text = helpMessage.trim();
    if (!text) return;
    await sendHelpMessage.mutateAsync({ text });
    setHelpMessage("");
    helpThreadQuery.refetch();
  }

  async function markHelpThreadResolved() {
    await resolveHelpThread.mutateAsync({ reason: "student_solved" });
    helpThreadQuery.refetch();
  }

  const fileHref = solution?.file_url ? `/api${solution.file_url}` : null;
  const imageHref = solution?.image_url ? `/api${solution.image_url}` : null;
  const comments = solution?.comments ?? [];
  const imageComments = comments.filter((comment) => comment.target_type === "image" && comment.image_x != null && comment.image_y != null);
  const versions = solution?.versions ?? [];
  const helpThread = helpThreadQuery.data ?? null;
  const helpThreadOpen = Boolean(helpThread && !helpThread.is_resolved);
  const showHelpColumn = helpPanelOpen;
  const savedText = textSolutionMode ? (solution?.recognized_text ?? "") : (solution?.code ?? "");
  const isCodeDirty = code !== savedText;
  const shouldWarnBeforeClose = isCodeDirty && code.trim().length > 0;
  const requestClose = useCallback(() => {
    if (shouldWarnBeforeClose) {
      setCloseWarningOpen(true);
      return false;
    }
    onClose?.();
    return true;
  }, [onClose, shouldWarnBeforeClose]);
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;
  const selectedVersionIndex = selectedVersion ? versions.findIndex((version) => version.id === selectedVersion.id) : -1;
  const previousVersion = selectedVersionIndex >= 0 ? versions[selectedVersionIndex + 1] ?? null : null;
  const currentComparableCode = selectedVersion?.code ?? "";
  const previousComparableCode = previousVersion?.code ?? "";
  const changedLineCount = useMemo(() => {
    if (!selectedVersion) return 0;
    const currentLines = currentComparableCode.split("\n");
    const previousLines = previousComparableCode.split("\n");
    const max = Math.max(currentLines.length, previousLines.length);
    let changed = 0;
    for (let i = 0; i < max; i += 1) {
      if ((currentLines[i] ?? "") !== (previousLines[i] ?? "")) changed += 1;
    }
    return changed;
  }, [currentComparableCode, previousComparableCode, selectedVersion]);
  const editorKey = `${taskId}:${solution?.updated_at ?? "empty"}:${comments.map((comment) => `${comment.id}:${comment.updated_at ?? ""}`).join("|")}`;
  const commentExtensions = useMemo(
    () => createCodeCommentExtensions(
      showComments ? comments.filter((comment) => comment.target_type !== "image").map((comment) => ({ ...comment })) : [],
      { onReaction: setCommentReaction },
    ),
    [comments, setCommentReaction, showComments],
  );

  useEffect(() => {
    registerBeforeClose?.(requestClose);
    return () => registerBeforeClose?.(null);
  }, [registerBeforeClose, requestClose]);

  async function saveCodeAndClose() {
    await saveCode();
    setCloseWarningOpen(false);
    onClose?.();
  }

  function closeWithoutSaving() {
    setCloseWarningOpen(false);
    onClose?.();
  }

  useEffect(() => {
    if (activeTab !== "image") return;

    const onPaste = (event: ClipboardEvent) => {
      handleImagePaste(event);
    };

    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, [activeTab, handleImagePaste]);

  const solutionTabs = [
    { key: "code" as const, label: textSolutionMode ? "Решение" : "Код", icon: Code2 },
    { key: "file" as const, label: "Файл", icon: FileUp },
    { key: "image" as const, label: "Картинка", icon: ImageUp },
  ];

  const renderSolutionTabs = (compact = false) => (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {solutionTabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 rounded-[14px] text-xs font-black transition shadow-sm ${
              compact ? "h-8 px-3" : "h-9 px-3"
            } ${
              active
                ? "bg-emerald-500/16 text-emerald-300 ring-1 ring-emerald-400/35 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                : "bg-transparent text-slate-500 shadow-none hover:bg-white/[0.05] hover:text-slate-300"
            }`}
          >
            <Icon size={compact ? 13 : 15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`task-solution-panel-dark relative flex min-h-[520px] w-full min-w-0 flex-1 flex-col overflow-hidden ${showHelpColumn ? "rounded-none bg-[#07111D]" : "rounded-[20px] bg-white"}`}>
      <div className={`${showHelpColumn ? "hidden" : "flex"} solution-panel-header shrink-0 border-b border-slate-200/80 bg-white px-5 py-3`}>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]" />
            <div className="truncate text-sm font-black text-slate-950">Моё решение</div>
            </div>
            {renderSolutionTabs(true)}
          </div>
          <div className="flex items-center gap-2">
          {conditionHidden && onShowCondition && (
            <button
              type="button"
              onClick={onShowCondition}
              className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-slate-200 hover:bg-white/[0.10]"
            >
              <Eye size={14} />
              Показать условие
            </button>
          )}
            <button
              onClick={() => {
                setHelpPanelOpen((value) => !value);
                setHelpTab("ai");
              }}
              disabled={disabled || loading || helpRequest.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-emerald-400/30 bg-emerald-500/12 px-4 text-xs font-black text-emerald-300 shadow-sm hover:bg-emerald-500/18 disabled:opacity-55"
            >
              <HelpCircle size={13} />
              Помощь
            </button>
            <button
              type="button"
              onClick={sendForTeacherReview}
              disabled={disabled || loading || helpRequest.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-slate-800 bg-slate-900/45 px-4 text-xs font-black text-slate-600 hover:bg-slate-900 disabled:opacity-45"
            >
              {helpRequest.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                На проверку
            </button>
            {loading && <Loader2 size={16} className="animate-spin text-emerald-300" />}
          </div>
        </div>
      </div>

      {false && helpChatOpen && helpThread && (
        <div className="shrink-0 border-b border-amber-300/15 bg-[#0A1522] px-5 py-4 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#07111D] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-black uppercase tracking-wider text-amber-200">Диалог с преподавателем</div>
                <div className={`rounded-full px-2 py-1 text-[10px] font-black ${helpThread.is_resolved ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                  {helpThread.is_resolved ? "Вопрос решён" : "Открыт"}
                </div>
              </div>
              <div className="space-y-2">
                {helpThread.messages.length === 0 ? (
                  <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-500">Сообщений пока нет.</div>
                ) : helpThread.messages.map((message) => {
                  const mine = message.author_role === "student";
                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${message.kind === "system" ? "bg-white/[0.04] text-slate-400" : mine ? "bg-emerald-500/20 text-emerald-50" : "bg-amber-400/12 text-amber-50"}`}>
                        {message.kind !== "system" && (
                          <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-60">
                            {mine ? "Вы" : message.author_name || "Преподаватель"}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{message.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <textarea
                value={helpMessage}
                onChange={(event) => setHelpMessage(event.target.value)}
                disabled={helpThread.is_resolved || sendHelpMessage.isPending}
                rows={4}
                placeholder={helpThread.is_resolved ? "Диалог закрыт" : "Напишите преподавателю, что именно не получается"}
                className="min-h-24 resize-none rounded-xl border border-white/10 bg-[#07111D] px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={sendHelpThreadMessage}
                disabled={helpThread.is_resolved || sendHelpMessage.isPending || !helpMessage.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white disabled:opacity-50"
              >
                {sendHelpMessage.isPending ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                Отправить
              </button>
              {!helpThread.is_resolved && (
                <button
                  type="button"
                  onClick={markHelpThreadResolved}
                  disabled={resolveHelpThread.isPending}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-slate-300 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  Я решил задачу
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`grid min-h-0 w-full min-w-0 flex-1 bg-transparent ${showHelpColumn ? "gap-3 lg:grid-cols-[minmax(0,1fr)_430px]" : "grid-cols-1"}`}>
      <div className={`${showHelpColumn ? "flex min-h-0 min-w-0 flex-col gap-2" : "flex min-h-0 min-w-0 flex-col"}`}>
        {showHelpColumn && topContent}
        <div className={`${showHelpColumn ? "overflow-hidden rounded-[14px] border border-white/10 bg-[#07111D]" : ""} solution-editor-shell flex min-h-0 min-w-0 flex-1 flex-col`}>
        {showHelpColumn && (
          <div className="solution-panel-header shrink-0 border-b border-white/10 bg-[#0B1722]/95">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]" />
                <div className="truncate text-sm font-black text-white">Моё решение</div>
              </div>
              {renderSolutionTabs(true)}
              </div>
              <div className="flex items-center gap-2">
                {conditionHidden && onShowCondition && (
                  <button
                    type="button"
                    onClick={onShowCondition}
                    className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-slate-200 hover:bg-white/[0.10]"
                  >
                    <Eye size={14} />
                    Показать условие
                  </button>
                )}
                <button
                  onClick={() => {
                    setHelpPanelOpen((value) => !value);
                    setHelpTab("ai");
                  }}
                  disabled={disabled || loading || helpRequest.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-emerald-400/30 bg-emerald-500/12 px-4 text-xs font-black text-emerald-300 shadow-sm hover:bg-emerald-500/18 disabled:opacity-55"
                >
                  <HelpCircle size={13} />
                  Помощь
                </button>
                <button
                  type="button"
                  onClick={sendForTeacherReview}
                  disabled={disabled || loading || helpRequest.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-slate-800 bg-slate-900/45 px-4 text-xs font-black text-slate-600 hover:bg-slate-900 disabled:opacity-45"
                >
                  {helpRequest.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  На проверку
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
                  title="Меню"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="solution-editor-body flex min-h-0 flex-1 flex-col bg-white">
        {activeTab === "code" && (
          <div className="solution-editor-frame relative min-h-[430px] flex-1 overflow-hidden rounded-none border border-transparent bg-white shadow-none">
            <button
              type="button"
              onClick={saveCode}
              disabled={disabled || loading || saving}
              title="Сохранить код"
              className={`absolute right-12 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 disabled:opacity-50 ${
                !isCodeDirty && code.trim().length > 0
                  ? "text-emerald-300"
                  : "text-slate-400 hover:text-emerald-300"
              }`}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              title="История решений"
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:bg-slate-50 hover:text-emerald-500"
            >
              <History size={15} />
            </button>
            {textSolutionMode ? (
              <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={disabled || loading}
                className="h-full min-h-[430px] w-full resize-none bg-white px-5 py-14 text-[15px] leading-7 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
                placeholder="Введите или отредактируйте текст решения..."
              />
            ) : (
            <CodeMirror
              key={editorKey}
              value={code}
              onChange={setCode}
              editable={!disabled && !loading}
              extensions={[python(), ...commentExtensions]}
              theme={githubLight}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                autocompletion: true,
                bracketMatching: true,
                closeBrackets: true,
              }}
              height="100%"
              minHeight="430px"
              maxHeight="calc(100dvh - 260px)"
              placeholder="# Вставьте код или текст своего решения..."
              style={{
                fontSize: "14px",
                opacity: disabled || loading ? 0.6 : 1,
              }}
            />
            )}
          </div>
        )}

        {activeTab === "file" && (
          <div className="flex min-h-[300px] flex-1 flex-col justify-center rounded-[16px] border border-white/10 bg-white/[0.035] p-6">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <FileUp size={34} className="mb-3 text-emerald-300" />
              <div className="text-sm font-black text-white">Прикрепить файл решения</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">
                Можно загрузить код, документ, таблицу, архив или PDF.
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.20)] hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                Выбрать файл
              </button>
              {fileHref && (
                <a href={fileHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:underline">
                  <ExternalLink size={12} />
                  Открыть текущий файл
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === "image" && (
          <div
            tabIndex={0}
            className={`flex min-h-[280px] flex-1 flex-col justify-center rounded-xl border p-6 transition ${
              imageDragActive
                ? "border-emerald-300/40 bg-emerald-400/10 shadow-[0_0_0_4px_rgba(16,185,129,0.10)]"
                : "border-white/10 bg-white/[0.035]"
            }`}
            onPasteCapture={handleImagePaste}
            onDragEnter={(event) => {
              if (disabled || saving) return;
              event.preventDefault();
              event.stopPropagation();
              setImageDragActive(true);
            }}
            onDragOver={(event) => {
              if (disabled || saving) return;
              event.preventDefault();
              event.stopPropagation();
              setImageDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const nextTarget = event.relatedTarget as Node | null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setImageDragActive(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setImageDragActive(false);
              if (disabled || saving) return;
              uploadImageFile(Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/")));
            }}
          >
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              {imageHref ? (
                <button
                  type="button"
                  onClick={() => setImagePreviewOpen(true)}
                  className="group mb-4 block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A1522] p-2 text-left shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                >
                  <div className="relative overflow-hidden rounded-xl bg-[#030A12]">
                    <img src={imageHref} alt="Прикрепленное решение" className="max-h-56 w-full object-contain" />
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {imageComments.flatMap((comment) => (comment.image_drawing ?? []).map((stroke, strokeIndex) => (
                        <polyline
                          key={`${comment.id}-${strokeIndex}`}
                          points={strokePoints(stroke)}
                          fill="none"
                          stroke={stroke.color || "#e96025"}
                          strokeWidth={stroke.width || 2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )))}
                    </svg>
                    {imageComments.map((comment, index) => (
                      <span
                        key={comment.id}
                        title={comment.text}
                        className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white shadow-[0_8px_20px_rgba(249,115,22,0.32)] ring-2 ring-[#0A1522]"
                        style={{ left: `${comment.image_x}%`, top: `${comment.image_y}%` }}
                      >
                        {index + 1}
                      </span>
                    ))}
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-[#0A1522]/92 px-2 py-1 text-[10px] font-black text-emerald-300 shadow-sm">
                      <Maximize2 size={11} />
                      Открыть
                    </div>
                  </div>
                </button>
              ) : (
                <ImageUp size={34} className="mb-3 text-emerald-300" />
              )}
              <div className="text-sm font-black text-white">Прикрепить картинку</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">
                {imageHref
                  ? "Картинка сохранена. Можно заменить файлом, перетаскиванием или вставкой из буфера."
                  : "Перетащите фото сюда, вставьте из буфера обмена или выберите файл."}
              </div>
              {imageComments.length > 0 && (
                <div className="mt-4 w-full space-y-2 text-left">
                  {imageComments.map((comment, index) => (
                    <div key={comment.id} className="rounded-xl border border-orange-300/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-100">
                      <span className="font-black text-orange-300">{index + 1}. </span>
                      {comment.text}
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={disabled || saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.20)] hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <ImageUp size={13} />}
                {imageHref ? "Заменить картинку" : "Выбрать картинку"}
              </button>
              {imageHref && (
                <button
                  type="button"
                  onClick={recognizeImageToLatex}
                  disabled={disabled || saving || recognizing}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/10 px-5 py-2.5 text-xs font-black text-sky-200 hover:bg-sky-400/15 disabled:opacity-50"
                >
                  {recognizing ? <Loader2 size={13} className="animate-spin" /> : <Code2 size={13} />}
                  {recognizing ? "Распознаю..." : "Распознать через ИИ"}
                </button>
              )}
              {ocrError && (
                <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                  {ocrError}
                </div>
              )}
            </div>
          </div>
        )}

        {historyOpen && (
          <div className="mt-4 grid max-h-[220px] shrink-0 grid-cols-1 gap-3 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.04] p-3 lg:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">История решений</div>
              {versions.length === 0 ? (
                <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-500">Пока нет сохраненных версий</div>
              ) : versions.map((version, index) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelectedVersionId(version.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                    (selectedVersion?.id ?? versions[0]?.id) === version.id
                      ? "border-emerald-300/35 bg-emerald-400/10 text-slate-100"
                      : "border-transparent bg-white/[0.04] text-slate-500 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="font-black">Версия {versions.length - index}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {version.created_at ? new Date(version.created_at).toLocaleString() : "без даты"}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-emerald-300">
                    {version.change_type === "code" ? "код" : version.change_type === "image" ? "фото" : "файл"}
                  </div>
                </button>
              ))}
            </div>
            <div className="min-w-0 rounded-lg border border-white/10 bg-[#0A1522] p-3">
              {selectedVersion ? (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black text-white">
                      Изменено строк: {changedLineCount}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCode(selectedVersion.code ?? "")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-white/[0.06]"
                    >
                      <Eye size={12} />
                      Вернуть в редактор
                    </button>
                  </div>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/[0.04] p-3 text-[11px] leading-relaxed text-slate-300">
                    {selectedVersion.code || "В этой версии был сохранен файл или фото без текста кода."}
                  </pre>
                </>
              ) : (
                <div className="text-xs font-semibold text-slate-500">Выберите версию, чтобы посмотреть код</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex shrink-0 flex-wrap items-center gap-3">
          {comments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComments((value) => !value)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-slate-300 hover:bg-white/[0.07]"
            >
              <MessageSquare size={13} />
              {showComments ? "Скрыть комментарии" : "Показать комментарии"}
            </button>
          )}
          {saved && <span className="text-xs font-semibold text-emerald-300">Сохранено</span>}
          {activeTab === "code" && fileHref && (
            <a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:underline">
              <ExternalLink size={12} />
              Открыть файл
            </a>
          )}
        </div>
        </div>
        </div>
      </div>
      {showHelpColumn && (
        <aside className="flex min-h-[720px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[radial-gradient(circle_at_100%_10%,rgba(16,185,129,0.18),transparent_38%),#061119]">
          <div className="shrink-0 border-b border-white/10 px-7 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-8">
                <button
                  type="button"
                  onClick={() => setHelpTab("ai")}
                  className={`inline-flex h-11 items-center border-b-2 px-0 text-sm font-black transition ${helpTab === "ai" ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-500 hover:text-slate-200"}`}
                >
                  AI Наставник
                </button>
                <button
                  type="button"
                  onClick={() => setHelpTab("teacher")}
                  className={`inline-flex h-11 items-center border-b-2 px-0 text-sm font-black transition ${helpTab === "teacher" ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-500 hover:text-slate-200"}`}
                >
                  Преподаватель
                </button>
              </div>              <div className="flex shrink-0 items-center gap-2">
                {helpThread && helpTab === "teacher" && (
                  <div className={`rounded-full px-2.5 py-1 text-[10px] font-black ${helpThread.is_resolved ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                    {helpThread.is_resolved ? "Решён" : "Открыт"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setHelpPanelOpen(false);
                    setHelpTab("ai");
                    onHelpClose?.();
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] text-slate-400 transition hover:bg-white/[0.09] hover:text-white"
                  title="Закрыть чат"
                  aria-label="Закрыть чат"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>

          {helpTab === "ai" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  {aiMessages.map((message, index) => {
                    const mine = message.role === "user";
                    return (
                      <div key={index} className={`flex items-start gap-3 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine && (
                          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25 shadow-[0_0_18px_rgba(16,185,129,0.24)]">
                            <Bot size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className={`max-w-[310px] rounded-[14px] border border-white/[0.06] px-4 py-3 text-sm leading-relaxed shadow-[0_16px_38px_rgba(0,0,0,0.18)] ${mine ? "bg-[#16222D] text-slate-100" : "bg-white/[0.07] text-slate-100"}`}>
                            {message.code && (
                              <pre className="mb-2 max-h-40 overflow-auto rounded-xl bg-black/20 p-3 text-[11px] leading-relaxed text-slate-200">{message.code}</pre>
                            )}
                            <div className="whitespace-pre-wrap">{message.text}</div>
                          </div>
                          <div className={`mt-1 text-[10px] text-slate-600 ${mine ? "text-right" : "text-left"}`}>
                            {mine ? "21:49" : index === 0 ? "21:48" : "21:49"}
                          </div>
                        </div>
                        {mine && (
                          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-[#061119] shadow-[0_0_18px_rgba(16,185,129,0.24)]">
                            Я
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {aiAssist.isPending && (
                    <div className="ml-12 max-w-[310px] rounded-[14px] bg-white/[0.07] px-4 py-3 text-sm text-slate-400">Проверяю решение...</div>
                  )}
                </div>
              </div>
              <div className="shrink-0 px-5 pb-5">
                <div className="flex gap-2 rounded-[14px] border border-white/10 bg-[#07111D]/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <input
                    value={aiMessage}
                    onChange={(event) => setAiMessage(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && sendAiMessage()}
                    disabled={aiAssist.isPending}
                    placeholder="Напиши сообщение..."
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={sendAiMessage}
                    disabled={aiAssist.isPending || (!aiMessage.trim() && !code.trim())}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_10px_22px_rgba(16,185,129,0.22)] hover:bg-emerald-400 disabled:opacity-45"
                  >
                    {aiAssist.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : helpThread ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  {helpThread.messages.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4 text-sm text-slate-500">
                      Сообщений пока нет.
                    </div>
                  ) : helpThread.messages.map((message) => {
                const mine = message.author_role === "student";
                return (
                  <div key={message.id} className={`relative flex items-start gap-3 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && (
                    <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${message.kind === "system" ? "bg-white/[0.07] text-slate-400" : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25"}`}>
                      {message.kind === "system" ? "i" : mine ? "Я" : "П"}
                    </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-black text-slate-200">
                          {message.kind === "system" ? "Событие" : mine ? "Вы" : message.author_name || "Преподаватель"}
                        </div>
                        {message.created_at && (
                          <div className="shrink-0 text-[10px] font-semibold text-slate-600">
                            {new Date(message.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                      <div className={`mt-1 max-w-[310px] whitespace-pre-wrap rounded-[14px] border border-white/[0.06] px-4 py-3 text-sm leading-relaxed ${message.kind === "system" ? "bg-white/[0.04] text-slate-400" : mine ? "bg-[#123F37] text-emerald-50" : "bg-white/[0.07] text-slate-100"}`}>
                        {message.text}
                      </div>
                    </div>
                    {mine && (
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-[#061119]">
                        Я
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              </div>

              <div className="shrink-0 px-5 pb-5">
                <textarea
                  value={helpMessage}
                  onChange={(event) => setHelpMessage(event.target.value)}
                  disabled={helpThread.is_resolved || sendHelpMessage.isPending}
                  rows={3}
                  placeholder={helpThread.is_resolved ? "Диалог закрыт" : "Напишите, что именно не получается"}
                  className="min-h-20 w-full resize-none rounded-[14px] border border-white/10 bg-[#07111D] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-400/40 disabled:opacity-50"
                />
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={sendHelpThreadMessage}
                    disabled={helpThread.is_resolved || sendHelpMessage.isPending || !helpMessage.trim()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {sendHelpMessage.isPending ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                    Отправить
                  </button>
                  {!helpThread.is_resolved && (
                    <button
                      type="button"
                      onClick={markHelpThreadResolved}
                      disabled={resolveHelpThread.isPending}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-slate-300 hover:bg-white/[0.07] disabled:opacity-50"
                    >
                      Я решил задачу
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center p-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-sm font-black text-white">Диалог с преподавателем ещё не создан</div>
                <div className="mt-2 text-sm leading-relaxed text-slate-400">
                  Можно отправить решение на проверку или попросить преподавателя помочь с конкретным местом.
                </div>
                <button
                  type="button"
                  onClick={requestTeacherHelp}
                  disabled={helpRequest.isPending}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  {helpRequest.isPending ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />}
                  Попросить помощи
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => upload("file", e.target.files?.[0])} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("image", e.target.files?.[0])} />
      {imagePreviewOpen && imageHref && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Закрыть просмотр картинки"
            onClick={() => setImagePreviewOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative z-10 flex h-[calc(100dvh-32px)] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#07111D] shadow-[0_24px_80px_rgba(0,0,0,0.30)]">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-black text-white">Прикрепленная картинка</div>
              <button
                type="button"
                onClick={() => setImagePreviewOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 overflow-auto bg-[#030A12] p-4">
              <div className="relative m-auto">
                <img src={imageHref} alt="Прикрепленное решение" className="max-h-[calc(100dvh-120px)] max-w-full object-contain" />
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {imageComments.flatMap((comment) => (comment.image_drawing ?? []).map((stroke, strokeIndex) => (
                    <polyline
                      key={`${comment.id}-${strokeIndex}`}
                      points={strokePoints(stroke)}
                      fill="none"
                      stroke={stroke.color || "#e96025"}
                      strokeWidth={stroke.width || 2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )))}
                </svg>
                {imageComments.map((comment, index) => (
                  <span
                    key={comment.id}
                    title={comment.text}
                    className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white shadow-[0_8px_20px_rgba(249,115,22,0.32)] ring-2 ring-[#07111D]"
                    style={{ left: `${comment.image_x}%`, top: `${comment.image_y}%` }}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {closeWarningOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0A1522] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 text-orange-300">
                <AlertCircle size={18} />
              </div>
              <div>
                <div className="text-sm font-black text-white">Код не сохранён</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-400">
                  Сохраните код перед закрытием или вернитесь к редактированию.
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseWarningOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-slate-300 hover:bg-white/[0.07]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={closeWithoutSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-300/20 bg-orange-400/10 px-4 text-xs font-black text-orange-200 hover:bg-orange-400/15"
              >
                Всё равно выйти
              </button>
              <button
                type="button"
                onClick={saveCodeAndClose}
                disabled={saving || loading || disabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.20)] hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Сохранить код
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

