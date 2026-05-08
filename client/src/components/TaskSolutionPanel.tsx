import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { AlertCircle, Code2, ExternalLink, Eye, FileUp, HelpCircle, History, ImageUp, Loader2, MessageSquare, Save } from "lucide-react";
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
  text: string;
  created_at: string | null;
  updated_at?: string | null;
  reaction?: string | null;
};

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

  async function upload(kind: "file" | "image", file: File | undefined) {
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
  }

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
      showComments ? comments.map((comment) => ({ ...comment })) : [],
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[18px] bg-[radial-gradient(circle_at_15%_10%,rgba(78,140,90,0.08),transparent_34%),linear-gradient(135deg,#fbfefb_0%,#f5fbf6_48%,#ffffff_100%)]">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[#d8eadb] px-5 py-4 sm:px-6">
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
                      ? "bg-[#3F8C62] text-white shadow-[0_10px_24px_rgba(63,140,98,0.28)]"
                      : "bg-transparent text-[#526052] shadow-none hover:bg-white hover:text-[#3F8C62]"
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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#f1a063] bg-white px-4 text-xs font-black text-[#e96025] shadow-sm hover:bg-[#fff7f2] disabled:opacity-55"
            >
              {helpRequest.isPending ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />}
              {helpRequested ? "Запрос отправлен" : "Попросить помощи"}
            </button>
            {loading && <Loader2 size={16} className="animate-spin text-[#3F8C62]" />}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-6">
        {activeTab === "code" && (
          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-[#8fe2ad] bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <button
              type="button"
              onClick={saveCode}
              disabled={disabled || loading || saving}
              title="Сохранить код"
              className={`absolute right-12 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe8df] bg-white shadow-sm hover:bg-[#f3faf4] disabled:opacity-50 ${
                !isCodeDirty && code.trim().length > 0
                  ? "text-[#3F8C62]"
                  : "text-[#687569] hover:text-[#3F8C62]"
              }`}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              title="История решений"
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe8df] bg-white text-[#687569] shadow-sm hover:bg-[#f3faf4] hover:text-[#3F8C62]"
            >
              <History size={15} />
            </button>
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
          <div className="flex min-h-[280px] flex-1 flex-col justify-center rounded-xl border border-[#d8eadb] bg-white/75 p-6">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <FileUp size={34} className="mb-3 text-[#3F8C62]" />
              <div className="text-sm font-black text-[#18251d]">Прикрепить файл решения</div>
              <div className="mt-1 text-xs leading-relaxed text-gray-500">
                Можно загрузить код, документ, таблицу, архив или PDF.
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3F8C62] px-5 py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(63,140,98,0.24)] hover:bg-[#357A54] disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                Выбрать файл
              </button>
              {fileHref && (
                <a href={fileHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8C62] hover:underline">
                  <ExternalLink size={12} />
                  Открыть текущий файл
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === "image" && (
          <div className="flex min-h-[280px] flex-1 flex-col justify-center rounded-xl border border-[#d8eadb] bg-white/75 p-6">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <ImageUp size={34} className="mb-3 text-[#3F8C62]" />
              <div className="text-sm font-black text-[#18251d]">Прикрепить картинку</div>
              <div className="mt-1 text-xs leading-relaxed text-gray-500">
                Подойдет фото листа, скриншот решения или изображение с пояснением.
              </div>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={disabled || saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3F8C62] px-5 py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(63,140,98,0.24)] hover:bg-[#357A54] disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <ImageUp size={13} />}
                Выбрать картинку
              </button>
              {imageHref && (
                <a href={imageHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8C62] hover:underline">
                  <ExternalLink size={12} />
                  Открыть текущую картинку
                </a>
              )}
            </div>
          </div>
        )}

        {historyOpen && (
          <div className="mt-4 grid max-h-[220px] shrink-0 grid-cols-1 gap-3 overflow-y-auto rounded-xl border border-[#d8eadb] bg-white/70 p-3 lg:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">История решений</div>
              {versions.length === 0 ? (
                <div className="bg-white px-3 py-2 text-xs font-semibold text-gray-400">Пока нет сохраненных версий</div>
              ) : versions.map((version, index) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelectedVersionId(version.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                    (selectedVersion?.id ?? versions[0]?.id) === version.id
                      ? "border-[#3F8C62] bg-white text-[#18251d]"
                      : "border-transparent bg-white/60 text-gray-500 hover:bg-white"
                  }`}
                >
                  <div className="font-black">Версия {versions.length - index}</div>
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    {version.created_at ? new Date(version.created_at).toLocaleString() : "без даты"}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-[#3F8C62]">
                    {version.change_type === "code" ? "код" : version.change_type === "image" ? "фото" : "файл"}
                  </div>
                </button>
              ))}
            </div>
            <div className="min-w-0 rounded-lg border border-[#e8efe8] bg-white p-3">
              {selectedVersion ? (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black text-[#18251d]">
                      Изменено строк: {changedLineCount}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCode(selectedVersion.code ?? "")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe8df] px-3 py-1.5 text-[11px] font-black text-[#3F8C62] hover:bg-[#f3faf4]"
                    >
                      <Eye size={12} />
                      Вернуть в редактор
                    </button>
                  </div>
                  <pre className="max-h-32 overflow-auto rounded-lg bg-[#f8fbf8] p-3 text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                    {selectedVersion.code || "В этой версии был сохранен файл или фото без текста кода."}
                  </pre>
                </>
              ) : (
                <div className="text-xs font-semibold text-gray-400">Выберите версию, чтобы посмотреть код</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex shrink-0 flex-wrap items-center gap-3">
          {comments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComments((value) => !value)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-white px-4 text-xs font-black text-gray-600 hover:bg-[#f3faf4]"
            >
              <MessageSquare size={13} />
              {showComments ? "Скрыть комментарии" : "Показать комментарии"}
            </button>
          )}
          {saved && <span className="text-xs font-semibold text-emerald-600">Сохранено</span>}
          {activeTab === "code" && fileHref && (
            <a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8C62] hover:underline">
              <ExternalLink size={12} />
              Открыть файл
            </a>
          )}
          {activeTab === "code" && imageHref && (
            <a href={imageHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8C62] hover:underline">
              <ExternalLink size={12} />
              Открыть фото
            </a>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => upload("file", e.target.files?.[0])} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("image", e.target.files?.[0])} />
      {closeWarningOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#18251d]/25 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#d8eadb] bg-white p-5 shadow-[0_20px_60px_rgba(24,37,29,0.22)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff7f2] text-[#e96025]">
                <AlertCircle size={18} />
              </div>
              <div>
                <div className="text-sm font-black text-[#18251d]">Код не сохранён</div>
                <div className="mt-1 text-xs leading-relaxed text-[#667568]">
                  Сохраните код перед закрытием или вернитесь к редактированию.
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseWarningOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#cfd9d0] bg-white px-4 text-xs font-black text-[#526052] hover:bg-[#f6faf6]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={closeWithoutSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#f1a063] bg-white px-4 text-xs font-black text-[#e96025] hover:bg-[#fff7f2]"
              >
                Всё равно выйти
              </button>
              <button
                type="button"
                onClick={saveCodeAndClose}
                disabled={saving || loading || disabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3F8C62] px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(63,140,98,0.24)] hover:bg-[#357A54] disabled:opacity-50"
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
