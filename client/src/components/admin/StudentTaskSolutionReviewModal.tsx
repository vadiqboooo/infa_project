import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import type { EditorView } from "@codemirror/view";
import { Code2, ExternalLink, Loader2, Save, Trash2, X } from "lucide-react";
import type { StudentTaskSolutionReview, TaskSolutionComment } from "../../api/types";
import { commentRangeToOffsets, createCodeCommentExtensions } from "../codeCommentExtensions";

const API_BASE = "/api";

function adminFetch<T>(path: string, apiKey?: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("jwt_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (apiKey) headers["X-API-Key"] = apiKey;
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_BASE}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Ошибка запроса");
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  });
}

function rangeLabel(comment: Pick<TaskSolutionComment, "from_line" | "from_col" | "to_line" | "to_col">) {
  const linePart = comment.from_line === comment.to_line
    ? `строка ${comment.from_line}`
    : `строки ${comment.from_line}-${comment.to_line}`;
  return `${linePart}, символы ${comment.from_col}-${comment.to_col}`;
}

function selectionToRange(view: EditorView | null) {
  if (!view) return null;
  const selection = view.state.selection.main;
  if (selection.empty) return null;
  const from = Math.min(selection.from, selection.to);
  const to = Math.max(selection.from, selection.to);
  const fromLine = view.state.doc.lineAt(from);
  const toLine = view.state.doc.lineAt(to);
  return {
    from_offset: from,
    to_offset: to,
    from_line: fromLine.number,
    from_col: from - fromLine.from + 1,
    to_line: toLine.number,
    to_col: Math.max(1, to - toLine.from + 1),
  };
}

export function StudentTaskSolutionReviewModal({
  studentId,
  taskId,
  studentName,
  apiKey,
  onClose,
  onChanged,
}: {
  studentId: number;
  taskId: number;
  studentName: string;
  apiKey?: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [review, setReview] = useState<StudentTaskSolutionReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectedRange, setSelectedRange] = useState<ReturnType<typeof selectionToRange>>(null);
  const [error, setError] = useState("");
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminFetch<StudentTaskSolutionReview>(`/admin/students/${studentId}/tasks/${taskId}/solution-review`, apiKey)
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Не удалось загрузить решение");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, studentId, taskId]);

  const commentExtensions = useMemo(
    () => createCodeCommentExtensions((review?.comments ?? []).map((comment) => ({ ...comment }))),
    [review?.comments],
  );

  async function saveComment() {
    const text = commentText.trim();
    const range = selectedRange ?? selectionToRange(editorRef.current);
    if (!text || !range) return;
    setSaving(true);
    setError("");
    try {
      const comment = await adminFetch<TaskSolutionComment>(
        `/admin/students/${studentId}/tasks/${taskId}/solution-comments`,
        apiKey,
        { method: "POST", body: JSON.stringify({ ...range, text }) },
      );
      setReview((prev) => prev ? { ...prev, comments: [...prev.comments, comment] } : prev);
      setCommentText("");
      setSelectedRange(null);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить комментарий");
    } finally {
      setSaving(false);
    }
  }

  async function deleteComment(commentId: number) {
    setSaving(true);
    setError("");
    try {
      await adminFetch(`/admin/solution-comments/${commentId}`, apiKey, { method: "DELETE" });
      setReview((prev) => prev ? {
        ...prev,
        comments: prev.comments.filter((comment) => comment.id !== commentId),
      } : prev);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || "Не удалось удалить комментарий");
    } finally {
      setSaving(false);
    }
  }

  function selectComment(comment: TaskSolutionComment) {
    const view = editorRef.current;
    if (!view) return;
    const { from, to } = commentRangeToOffsets(view, comment);
    view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
    view.focus();
  }

  const fileHref = review?.file_url ? `/api${review.file_url}` : null;
  const imageHref = review?.image_url ? `/api${review.image_url}` : null;
  const code = review?.code ?? "";

  return (
    <div className="fixed inset-0 z-[80] flex bg-black/30 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />
      <div className="flex h-full w-[min(1560px,calc(100vw-20px))] flex-col border-l border-[#dfe8df] bg-[#f7faf7] shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#dfe8df] px-6 py-5">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3F8C62]">Code Review</div>
            <div className="mt-1 truncate text-sm font-semibold text-[#18251d]">
              {studentName} · {review?.ege_number ? `задание ${review.ege_number}` : `задача ${taskId}`}
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-black/5 hover:text-[#18251d]">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[#3F8C62]">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-h-0 min-w-0 overflow-hidden p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe8df] bg-white px-3 py-1.5 text-xs font-semibold text-[#18251d]">
                  <Code2 size={13} />
                  Code
                </div>
                {fileHref && (
                  <a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-3 py-1.5 text-xs font-semibold text-[#3F8C62] hover:bg-[#f3faf4]">
                    <ExternalLink size={12} />
                    Файл
                  </a>
                )}
                {imageHref && (
                  <a href={imageHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-3 py-1.5 text-xs font-semibold text-[#3F8C62] hover:bg-[#f3faf4]">
                    <ExternalLink size={12} />
                    Фото
                  </a>
                )}
              </div>

              {code.trim() ? (
                <div className="h-full min-h-[760px] overflow-hidden rounded-[26px] border border-[#dfe8df] bg-white shadow-[0_12px_36px_rgba(15,23,20,0.06)]">
                  <CodeMirror
                    value={code}
                    editable={false}
                    extensions={[python(), ...commentExtensions]}
                    theme={githubLight}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: false,
                      highlightActiveLine: false,
                      highlightActiveLineGutter: false,
                    }}
                    minHeight="760px"
                    onCreateEditor={(view) => {
                      editorRef.current = view;
                    }}
                    onUpdate={() => {
                      setSelectedRange(selectionToRange(editorRef.current));
                    }}
                    style={{ height: "100%", fontSize: "15px" }}
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-[760px] items-center justify-center rounded-[26px] border border-dashed border-[#dfe8df] bg-white px-6 text-center text-sm text-gray-400">
                  У этой задачи пока нет сохраненного кода.
                </div>
              )}
            </div>

            <aside className="flex min-h-0 flex-col border-l border-[#dfe8df] bg-white">
              <div className="border-b border-[#edf3ed] px-5 py-5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Комментарий</div>
                <div className="mt-3 rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] px-3 py-2 text-xs text-[#3F8C62]">
                  {selectedRange ? rangeLabel(selectedRange) : "Выделите фрагмент в коде"}
                </div>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={5}
                  placeholder="Почему здесь ошибка или что нужно поправить"
                  className="mt-3 w-full resize-none rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] px-3 py-3 text-sm text-[#18251d] outline-none placeholder:text-gray-300 focus:border-[#3F8C62]"
                />
                <button
                  onClick={saveComment}
                  disabled={saving || !commentText.trim() || !selectedRange}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3F8C62] px-4 py-3 text-xs font-black text-white transition-opacity disabled:opacity-40"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Сохранить
                </button>
                {error && <div className="mt-2 text-xs font-semibold text-red-400">{error}</div>}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                  Комментарии {review?.comments.length ? `(${review.comments.length})` : ""}
                </div>
                <div className="space-y-3">
                  {review?.comments.map((comment) => (
                    <div key={comment.id} className="rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] p-3">
                      <button onClick={() => selectComment(comment)} className="text-left text-[11px] font-black text-[#b7791f] hover:underline">
                        {rangeLabel(comment)}
                      </button>
                      {comment.reaction && (
                        <div className="mt-2 inline-flex rounded-full bg-[#eef3ee] px-2 py-1 text-[10px] font-black text-[#3F8C62]">
                          {comment.reaction === "fixed" ? "Получилось исправить" : "Нужна помощь с ошибкой"}
                        </div>
                      )}
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#18251d]">{comment.text}</div>
                      <button
                        onClick={() => deleteComment(comment.id)}
                        disabled={saving}
                        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 size={11} />
                        Удалить
                      </button>
                    </div>
                  ))}
                  {review?.comments.length === 0 && (
                    <div className="rounded-2xl border border-[#edf3ed] bg-[#f8fbf8] px-3 py-4 text-sm text-gray-400">
                      Комментариев пока нет.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
