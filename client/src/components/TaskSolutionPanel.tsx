import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent } from "react";
import { createPortal } from "react-dom";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubDark } from "@uiw/codemirror-theme-github";
import { AlertCircle, Code2, ExternalLink, Eye, FileUp, HelpCircle, History, ImageUp, Loader2, Maximize2, MessageSquare, Save, X } from "lucide-react";
import { api, authFetch } from "../api/client";
import { createCodeCommentExtensions } from "./codeCommentExtensions";
import { useRequestTeacherHelp } from "../hooks/useApi";

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
  file_url: string | null;
  image_url: string | null;
  updated_at: string | null;
  comments?: SolutionComment[];
  versions?: SolutionVersion[];
}

export function TaskSolutionPanel({
  taskId,
  disabled = false,
  onChanged,
  onClose,
  registerBeforeClose,
}: {
  taskId: number;
  disabled?: boolean;
  onChanged?: () => void;
  onClose?: () => void;
  registerBeforeClose?: (handler: (() => boolean) | null) => void;
}) {
  const [solution, setSolution] = useState<TaskSolution | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [helpRequested, setHelpRequested] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "file" | "image">("code");
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const helpRequest = useRequestTeacherHelp(taskId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSolution(null);
    setCode("");
    setSaved(false);
    setHelpRequested(false);
    api<TaskSolution>(`/tasks/${taskId}/solution`)
      .then((data) => {
        if (cancelled) return;
        setSolution(data);
        setCode(data.code ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

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
          | { type: "comment_deleted"; comment_id: number };

        setSolution((prev) => {
          const current = prev ?? { task_id: taskId, code: null, file_url: null, image_url: null, updated_at: null, comments: [], versions: [] };
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
  }, [taskId]);

  async function saveCode() {
    setSaving(true);
    setSaved(false);
    try {
      const data = await api<TaskSolution>(`/tasks/${taskId}/solution`, {
        method: "PUT",
        body: JSON.stringify({ code }),
      });
      setSolution(data);
      onChanged?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
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
  }

  const fileHref = solution?.file_url ? `/api${solution.file_url}` : null;
  const imageHref = solution?.image_url ? `/api${solution.image_url}` : null;
  const comments = solution?.comments ?? [];
  const imageComments = comments.filter((comment) => comment.target_type === "image" && comment.image_x != null && comment.image_y != null);
  const versions = solution?.versions ?? [];
  const isCodeDirty = code !== (solution?.code ?? "");
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[18px] bg-[#07111D]">
      <div className="flex shrink-0 flex-col gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {[
              { key: "code" as const, label: "Код", icon: Code2 },
              { key: "file" as const, label: "Файл", icon: FileUp },
              { key: "image" as const, label: "Картинка", icon: ImageUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black transition shadow-sm ${
                    active
                      ? "bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.20)]"
                      : "bg-transparent text-slate-400 shadow-none hover:bg-white/[0.06] hover:text-emerald-200"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={requestTeacherHelp}
              disabled={disabled || loading || helpRequest.isPending || helpRequested}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 text-xs font-black text-amber-200 shadow-sm hover:bg-amber-400/15 disabled:opacity-55"
            >
              {helpRequest.isPending ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />}
              {helpRequested ? "Запрос отправлен" : "Попросить помощи"}
            </button>
            {loading && <Loader2 size={16} className="animate-spin text-emerald-300" />}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-6">
        {activeTab === "code" && (
          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0A1522]">
            <button
              type="button"
              onClick={saveCode}
              disabled={disabled || loading || saving}
              title="Сохранить код"
              className={`absolute right-12 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#111E2C] shadow-sm hover:bg-white/[0.08] disabled:opacity-50 ${
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
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#111E2C] text-slate-400 shadow-sm hover:bg-white/[0.08] hover:text-emerald-300"
            >
              <History size={15} />
            </button>
            <CodeMirror
              key={editorKey}
              value={code}
              onChange={setCode}
              editable={!disabled && !loading}
              extensions={[python(), ...commentExtensions]}
              theme={githubDark}
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
              minHeight="280px"
              maxHeight="calc(100dvh - 330px)"
              placeholder="# Вставьте код или текст своего решения..."
              style={{
                fontSize: "14px",
                opacity: disabled || loading ? 0.6 : 1,
              }}
            />
          </div>
        )}

        {activeTab === "file" && (
          <div className="flex min-h-[280px] flex-1 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] p-6">
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
                : "border-white/10 bg-white/[0.04]"
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
          {activeTab === "code" && imageHref && (
            <button type="button" onClick={() => setImagePreviewOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:underline">
              <ImageUp size={12} />
              Открыть фото
            </button>
          )}
        </div>
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
