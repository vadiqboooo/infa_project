import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { Code2, ExternalLink, FileUp, ImageUp, Loader2, Save } from "lucide-react";
import { api, authFetch } from "../api/client";
import { createCodeCommentExtensions } from "./codeCommentExtensions";

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

interface TaskSolution {
  task_id: number;
  code: string | null;
  file_url: string | null;
  image_url: string | null;
  updated_at: string | null;
  comments?: SolutionComment[];
}

export function TaskSolutionPanel({
  taskId,
  disabled = false,
  onChanged,
}: {
  taskId: number;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const [solution, setSolution] = useState<TaskSolution | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSolution(null);
    setCode("");
    setSaved(false);
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
          const current = prev ?? { task_id: taskId, code: null, file_url: null, image_url: null, updated_at: null, comments: [] };
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

  const fileHref = solution?.file_url ? `/api${solution.file_url}` : null;
  const imageHref = solution?.image_url ? `/api${solution.image_url}` : null;
  const comments = solution?.comments ?? [];
  const editorKey = `${taskId}:${solution?.updated_at ?? "empty"}:${comments.map((comment) => `${comment.id}:${comment.updated_at ?? ""}`).join("|")}`;
  const commentExtensions = useMemo(
    () => createCodeCommentExtensions(
      comments.map((comment) => ({ ...comment })),
      { onReaction: setCommentReaction },
    ),
    [comments, setCommentReaction],
  );

  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-[#dfe8df] bg-white shadow-[0_20px_40px_rgba(15,23,20,0.08)]">
      <div className="flex items-center justify-between border-b border-[#dfe8df] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3F8C62]/10 text-[#3F8C62]">
            <Code2 size={15} />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#18251d]">Code</div>
            <div className="text-[11px] text-gray-400">Сохраненное решение и комментарии преподавателя</div>
          </div>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-[#3F8C62]" />}
      </div>

      <div className="px-4 py-4">
        <div className="overflow-hidden rounded-[22px] border border-[#dfe8df] bg-[#fbfdfb]">
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
            minHeight="520px"
            maxHeight="720px"
            placeholder="# Вставьте код или текст своего решения..."
            style={{
              fontSize: "14px",
              opacity: disabled || loading ? 0.6 : 1,
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={saveCode}
            disabled={disabled || loading || saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#3F8C62] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Сохранить
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-4 py-2 text-xs font-black text-[#3F8C62] hover:bg-[#f3faf4] disabled:opacity-50"
          >
            <FileUp size={13} />
            Файл
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-4 py-2 text-xs font-black text-[#3F8C62] hover:bg-[#f3faf4] disabled:opacity-50"
          >
            <ImageUp size={13} />
            Фото
          </button>
          {saved && <span className="text-xs font-semibold text-emerald-600">Сохранено</span>}
          {fileHref && (
            <a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8C62] hover:underline">
              <ExternalLink size={12} />
              Открыть файл
            </a>
          )}
          {imageHref && (
            <a href={imageHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8C62] hover:underline">
              <ExternalLink size={12} />
              Открыть фото
            </a>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => upload("file", e.target.files?.[0])} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("image", e.target.files?.[0])} />
    </div>
  );
}
