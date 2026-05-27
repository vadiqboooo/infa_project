import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import { EditorView, type EditorView as EditorViewType } from "@codemirror/view";
import {
  BookOpen,
  Code2,
  ExternalLink,
  Eye,
  Eraser,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Minus,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { ImageDrawingStroke, StudentTaskSolutionReview, TaskSolutionComment, TaskSolutionHelpThread } from "../../api/types";
import { commentRangeToOffsets, createCodeCommentExtensions } from "../codeCommentExtensions";
import TaskView from "../TaskView";

const API_BASE = "/api";
const BOARD_COLORS = ["#ffffff", "#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
const BOARD_WIDTHS = [2, 4, 7, 11];

function adminFetch<T>(path: string, apiKey?: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("jwt_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
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

function commentLabel(comment: TaskSolutionComment) {
  if (comment.target_type === "image") return "Комментарий на картинке";
  return rangeLabel(comment);
}

function strokePoints(stroke: ImageDrawingStroke) {
  return stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
}

function formatAnswer(answer: { val: any } | null | undefined): string {
  if (!answer || answer.val == null) return "";
  const value = answer.val;
  if (Array.isArray(value)) {
    if (Array.isArray(value[0])) return (value as any[][]).map((row) => row.join(", ")).join(" / ");
    return value.join(", ");
  }
  return String(value);
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

type ReviewView = "draft" | "code" | "file" | "image";
type ImageTool = "pen" | "eraser";
type CodeCommentAnchor = { left: number; top: number } | null;

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
  const [helpMessage, setHelpMessage] = useState("");
  const [activeView, setActiveView] = useState<ReviewView>("code");
  const [conditionVisible, setConditionVisible] = useState(false);
  const [selectedRange, setSelectedRange] = useState<ReturnType<typeof selectionToRange>>(null);
  const [codeCommentAnchor, setCodeCommentAnchor] = useState<CodeCommentAnchor>(null);
  const [selectedImagePoint, setSelectedImagePoint] = useState<{ x: number; y: number } | null>(null);
  const [imageDraftStrokes, setImageDraftStrokes] = useState<ImageDrawingStroke[]>([]);
  const [imageTool, setImageTool] = useState<ImageTool>("pen");
  const [imageColor, setImageColor] = useState("#ef4444");
  const [imageWidth, setImageWidth] = useState(2);
  const [isDrawingImage, setIsDrawingImage] = useState(false);
  const [imageBoardZoom, setImageBoardZoom] = useState(1);
  const [spacePressed, setSpacePressed] = useState(false);
  const [panningImage, setPanningImage] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<EditorViewType | null>(null);
  const imageBoardRef = useRef<HTMLDivElement | null>(null);
  const helpMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const imagePanRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  useEffect(() => {
    if (activeView !== "image") return;

    const board = imageBoardRef.current;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setImageBoardZoom((value) => Math.max(0.45, Math.min(2.5, Number((value + (event.deltaY > 0 ? -0.1 : 0.1)).toFixed(2)))));
    };

    board?.addEventListener("wheel", handleWheel, { passive: false });

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) {
          setSpacePressed(true);
          setIsDrawingImage(false);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ") {
        event.preventDefault();
        setImageDraftStrokes((strokes) => strokes.slice(0, -1));
        return;
      }

      if (event.code === "Escape") {
        event.preventDefault();
        setSelectedImagePoint(null);
        setIsDrawingImage(false);
        return;
      }

      if (event.code === "KeyP") {
        event.preventDefault();
        setImageTool("pen");
        return;
      }

      if (event.code === "KeyE") {
        event.preventDefault();
        setImageTool("eraser");
        return;
      }

      if (/^Digit[1-4]$/.test(event.code)) {
        event.preventDefault();
        setImageWidth(BOARD_WIDTHS[Number(event.code.slice(-1)) - 1]);
        setImageTool("pen");
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      setSpacePressed(false);
      setPanningImage(false);
      imagePanRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      board?.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeView]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminFetch<StudentTaskSolutionReview>(`/admin/students/${studentId}/tasks/${taskId}/solution-review`, apiKey)
      .then((data) => {
        if (cancelled) return;
        setReview(data);
        setActiveView(
          data.image_url || data.board_data?.length
            ? "image"
            : data.recognized_text?.trim()
              ? "draft"
              : data.code?.trim()
                ? "code"
                : data.file_url
                  ? "file"
                  : "code",
        );
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

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token && !apiKey) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ student_id: String(studentId) });
    if (token) params.set("token", token);
    if (apiKey) params.set("api_key", apiKey);
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/tasks/${taskId}/solution/help-thread/admin/ws?${params.toString()}`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: "help_thread_updated"; thread: TaskSolutionHelpThread }
          | { type: "board_data_updated"; board_data: ImageDrawingStroke[]; updated_at?: string | null };
        if (payload.type === "help_thread_updated") {
          setReview((prev) => prev ? { ...prev, help_thread: payload.thread } : prev);
        } else if (payload.type === "board_data_updated") {
          setReview((prev) => prev ? {
            ...prev,
            board_data: payload.board_data,
            updated_at: payload.updated_at ?? prev.updated_at,
          } : prev);
          if (payload.board_data.length > 0) setActiveView("image");
        } else {
          return;
        }
        onChanged?.();
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    return () => ws.close();
  }, [apiKey, onChanged, studentId, taskId]);

  useEffect(() => {
    helpMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [review?.help_thread?.messages.length]);

  const commentExtensions = useMemo(
    () => createCodeCommentExtensions((review?.comments ?? []).filter((comment) => comment.target_type !== "image").map((comment) => ({ ...comment }))),
    [review?.comments],
  );

  const fileHref = review?.file_url ? `/api${review.file_url}` : null;
  const imageHref = review?.image_url ? `/api${review.image_url}` : null;
  const code = review?.code ?? "";
  const recognizedText = review?.recognized_text ?? "";
  const boardData = review?.board_data ?? [];
  const hasBoardData = boardData.length > 0;
  const imageComments = (review?.comments ?? []).filter((comment) => comment.target_type === "image" && comment.image_x != null && comment.image_y != null);
  const boardMaxX = Math.max(
    100,
    ...boardData.map((stroke) => stroke.board_width ?? 0),
    ...boardData.flatMap((stroke) => stroke.points.map((point) => point.x)),
  );
  const boardMaxY = Math.max(
    100,
    ...boardData.map((stroke) => stroke.board_height ?? 0),
    ...boardData.flatMap((stroke) => stroke.points.map((point) => point.y)),
  );
  const boardCoordinateMode = hasBoardData;
  const imageBoardViewWidth = boardCoordinateMode ? boardMaxX : 100;
  const imageBoardViewHeight = boardCoordinateMode ? boardMaxY : 100;
  const boardStrokePoints = (stroke: ImageDrawingStroke) => stroke.points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const userAnswer = formatAnswer(review?.user_answer);
  const correctAnswer = formatAnswer(review?.correct_answer);
  const hasCondition = Boolean(review?.task_content_html || review?.task_description || review?.task_title || userAnswer || correctAnswer);
  const reviewViews = [
    { id: "draft" as const, label: "Черновик", icon: PenLine, enabled: Boolean(recognizedText.trim()) },
    { id: "code" as const, label: "Код", icon: Code2, enabled: Boolean(code.trim()) },
    { id: "file" as const, label: "Файл", icon: FileText, enabled: Boolean(fileHref) },
    { id: "image" as const, label: hasBoardData ? "Доска" : "Картинка", icon: ImageIcon, enabled: Boolean(imageHref || hasBoardData) },
  ];
  const enabledViews = reviewViews.filter((view) => view.enabled);

  const pointFromImageEvent = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, (event.clientX - rect.left + event.currentTarget.scrollLeft) / imageBoardZoom);
    const y = Math.max(0, (event.clientY - rect.top + event.currentTarget.scrollTop) / imageBoardZoom);
    if (boardCoordinateMode) {
      return {
        x: Math.max(0, Math.min(imageBoardViewWidth, (x / Math.max(1, event.currentTarget.scrollWidth / imageBoardZoom)) * imageBoardViewWidth)),
        y: Math.max(0, Math.min(imageBoardViewHeight, (y / Math.max(1, event.currentTarget.scrollHeight / imageBoardZoom)) * imageBoardViewHeight)),
      };
    }
    return {
      x: Math.max(0, Math.min(100, (x / Math.max(1, event.currentTarget.scrollWidth / imageBoardZoom)) * 100)),
      y: Math.max(0, Math.min(100, (y / Math.max(1, event.currentTarget.scrollHeight / imageBoardZoom)) * 100)),
    };
  }, [boardCoordinateMode, imageBoardViewHeight, imageBoardViewWidth, imageBoardZoom]);

  const imageStrokePoints = useCallback((stroke: ImageDrawingStroke) => {
    if (!boardCoordinateMode || stroke.coordinate_space === "board") {
      return strokePoints(stroke);
    }
    return stroke.points
      .map((point) => `${(point.x / 100) * imageBoardViewWidth},${(point.y / 100) * imageBoardViewHeight}`)
      .join(" ");
  }, [boardCoordinateMode, imageBoardViewHeight, imageBoardViewWidth]);

  const imageMarkerStyle = useCallback((comment: TaskSolutionComment) => {
    if (boardCoordinateMode && comment.image_x != null && comment.image_y != null) {
      const isBoardComment = comment.image_drawing?.some((stroke) => stroke.coordinate_space === "board");
      if (!isBoardComment) {
        return { left: `${comment.image_x}%`, top: `${comment.image_y}%` };
      }
      return {
        left: `${(comment.image_x / imageBoardViewWidth) * 100}%`,
        top: `${(comment.image_y / imageBoardViewHeight) * 100}%`,
      };
    }
    return { left: `${comment.image_x}%`, top: `${comment.image_y}%` };
  }, [boardCoordinateMode, imageBoardViewHeight, imageBoardViewWidth]);

  function updateCodeSelection(view: EditorViewType | null) {
    const range = selectionToRange(view);
    setSelectedRange(range);
    setSelectedImagePoint(null);
    setImageDraftStrokes([]);

    if (!view || !range || activeView !== "code") {
      setCodeCommentAnchor(null);
      return;
    }

    const { to } = commentRangeToOffsets(view, range);
    const coords = view.coordsAtPos(to) ?? view.coordsAtPos(Math.max(0, to - 1));
    if (!coords) {
      setCodeCommentAnchor(null);
      return;
    }

    setCodeCommentAnchor({
      left: Math.max(12, Math.min(window.innerWidth - 380, coords.left)),
      top: Math.max(12, Math.min(window.innerHeight - 250, coords.bottom + 10)),
    });
  }

  function eraseImageDraftAt(point: { x: number; y: number }) {
    const threshold = Math.max(1.4, imageWidth * 0.45);
    setImageDraftStrokes((strokes) => strokes.filter((stroke) => (
      !stroke.points.some((strokePoint) => {
        const dx = strokePoint.x - point.x;
        const dy = strokePoint.y - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      })
    )));
  }

  function startImageDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if ((!imageHref && !hasBoardData) || activeView !== "image") return;
    event.preventDefault();
    if (spacePressed) {
      imagePanRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: event.currentTarget.scrollLeft,
        scrollTop: event.currentTarget.scrollTop,
      };
      setPanningImage(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const point = pointFromImageEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedRange(null);
    setCodeCommentAnchor(null);
    setSelectedImagePoint(point);
    if (imageTool === "eraser") {
      eraseImageDraftAt(point);
      setIsDrawingImage(true);
      return;
    }
    setImageDraftStrokes((strokes) => [
      ...strokes,
      {
        points: [point],
        color: imageColor,
        width: imageWidth,
        coordinate_space: boardCoordinateMode ? "board" : "percent",
        board_width: boardCoordinateMode ? imageBoardViewWidth : undefined,
        board_height: boardCoordinateMode ? imageBoardViewHeight : undefined,
      },
    ]);
    setIsDrawingImage(true);
  }

  function continueImageDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    const activePan = imagePanRef.current;
    if (activePan && activePan.pointerId === event.pointerId) {
      event.preventDefault();
      event.currentTarget.scrollLeft = activePan.scrollLeft - (event.clientX - activePan.clientX);
      event.currentTarget.scrollTop = activePan.scrollTop - (event.clientY - activePan.clientY);
      return;
    }
    if (!isDrawingImage) return;
    const point = pointFromImageEvent(event);
    setSelectedImagePoint(point);
    if (imageTool === "eraser") {
      eraseImageDraftAt(point);
      return;
    }
    setImageDraftStrokes((strokes) => {
      const next = [...strokes];
      const active = next[next.length - 1];
      if (!active) return strokes;
      next[next.length - 1] = { ...active, points: [...active.points, point] };
      return next;
    });
  }

  function finishImageDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    imagePanRef.current = null;
    setPanningImage(false);
    if (!isDrawingImage) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
    setIsDrawingImage(false);
  }

  async function saveComment() {
    const isImageMarkup = Boolean(selectedImagePoint && imageDraftStrokes.length > 0);
    const text = commentText.trim() || (isImageMarkup ? "Пометка преподавателя" : "");
    const range = selectedRange ?? selectionToRange(editorRef.current);
    if (!text || (!range && !selectedImagePoint)) return;
    setSaving(true);
    setError("");
    try {
      const payload = selectedImagePoint
        ? {
            target_type: "image",
            image_x: boardCoordinateMode ? (selectedImagePoint.x / imageBoardViewWidth) * 100 : selectedImagePoint.x,
            image_y: boardCoordinateMode ? (selectedImagePoint.y / imageBoardViewHeight) * 100 : selectedImagePoint.y,
            image_drawing: imageDraftStrokes.length > 0 ? imageDraftStrokes : null,
            text,
          }
        : { ...range, target_type: "code", text };
      const comment = await adminFetch<TaskSolutionComment>(
        `/admin/students/${studentId}/tasks/${taskId}/solution-comments`,
        apiKey,
        { method: "POST", body: JSON.stringify(payload) },
      );
      setReview((prev) => prev ? { ...prev, comments: [...prev.comments, comment] } : prev);
      setCommentText("");
      setSelectedRange(null);
      setCodeCommentAnchor(null);
      setSelectedImagePoint(null);
      setImageDraftStrokes([]);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить комментарий");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (activeView !== "image") return;
    if (isDrawingImage || saving) return;
    if (!selectedImagePoint || imageDraftStrokes.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      void saveComment();
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [activeView, imageDraftStrokes, isDrawingImage, saving, selectedImagePoint]);

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

  async function sendHelpMessage() {
    const text = helpMessage.trim();
    const threadId = review?.help_thread?.id;
    if (!text || !threadId) return;
    setSaving(true);
    setError("");
    try {
      const message = await adminFetch(`/admin/help-requests/${threadId}/messages`, apiKey, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setReview((prev) => prev?.help_thread ? {
        ...prev,
        help_thread: {
          ...prev.help_thread,
          messages: [...prev.help_thread.messages, message as any],
          is_resolved: false,
          status: "open",
        },
      } : prev);
      setHelpMessage("");
      onChanged?.();
    } catch (err: any) {
      setError(err.message || "Не удалось отправить сообщение");
    } finally {
      setSaving(false);
    }
  }

  async function closeHelpThread() {
    const threadId = review?.help_thread?.id;
    if (!threadId) return;
    setSaving(true);
    setError("");
    try {
      const thread = await adminFetch(`/admin/help-requests/${threadId}/resolve`, apiKey, {
        method: "POST",
        body: JSON.stringify({ reason: "teacher_marked_solved" }),
      });
      setReview((prev) => prev ? { ...prev, help_thread: thread as any } : prev);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || "Не удалось закрыть вопрос");
    } finally {
      setSaving(false);
    }
  }

  function selectComment(comment: TaskSolutionComment) {
    if (comment.target_type === "image") {
      setActiveView("image");
      setCodeCommentAnchor(null);
      setSelectedImagePoint(
        comment.image_x != null && comment.image_y != null ? { x: comment.image_x, y: comment.image_y } : null,
      );
      setImageDraftStrokes(comment.image_drawing ?? []);
      return;
    }
    setActiveView("code");
    setCodeCommentAnchor(null);
    setImageDraftStrokes([]);
    const view = editorRef.current;
    if (!view) return;
    const { from, to } = commentRangeToOffsets(view, comment);
    view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
    view.focus();
  }

  function openView(view: ReviewView) {
    setActiveView(view);
    setSelectedRange(null);
    setCodeCommentAnchor(null);
    setSelectedImagePoint(null);
    setImageDraftStrokes([]);
  }

  function renderCodeLike(value: string, empty: string, withCommentMarks: boolean) {
    if (!value.trim()) {
      return (
        <div className="flex h-[calc(100dvh-275px)] min-h-[430px] items-center justify-center px-6 text-center text-sm text-gray-400">
          {empty}
        </div>
      );
    }
    return (
      <div className="h-[calc(100dvh-275px)] min-h-[430px]">
        <CodeMirror
          value={value}
          editable={false}
          extensions={[python(), EditorView.lineWrapping, ...(withCommentMarks ? commentExtensions : [])]}
          theme={githubLight}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          height="100%"
          maxHeight="100%"
          onCreateEditor={(view) => {
            editorRef.current = view;
          }}
          onUpdate={(update) => updateCodeSelection(update.view)}
          style={{ height: "100%", fontSize: "15px" }}
        />
      </div>
    );
  }

  function renderImageBoard() {
    if (!imageHref && !hasBoardData) {
      return (
        <div className="flex h-[calc(100dvh-275px)] min-h-[430px] items-center justify-center px-6 text-center text-sm text-gray-400">
          Картинка не прикреплена.
        </div>
      );
    }
    return (
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#8fe9c8] bg-[#d7fff0] p-2 shadow-[0_12px_30px_rgba(0,197,141,0.12)]">
          <button
            type="button"
            onClick={() => setImageTool("pen")}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-[#0f5138] ${imageTool === "pen" ? "border-[#3F8C62] bg-[#bff4df]" : "border-[#bdebd9] bg-white/70"}`}
            title="Карандаш"
          >
            <PenLine size={16} />
          </button>
          <button
            type="button"
            onClick={() => setImageTool("eraser")}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-[#0f5138] ${imageTool === "eraser" ? "border-[#3F8C62] bg-[#bff4df]" : "border-[#bdebd9] bg-white/70"}`}
            title="Ластик"
          >
            <Eraser size={16} />
          </button>
          <span className="mx-1 h-8 w-px bg-[#9edfc7]" />
          {BOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setImageColor(color);
                setImageTool("pen");
              }}
              className={`h-8 w-8 rounded-full border shadow-sm ${imageColor === color ? "ring-2 ring-[#3F8C62] ring-offset-2 ring-offset-[#d7fff0]" : "border-white/80"}`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          <span className="mx-1 h-8 w-px bg-[#9edfc7]" />
          {BOARD_WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => {
                setImageWidth(width);
                setImageTool("pen");
              }}
              className={`inline-flex h-9 w-10 items-center justify-center rounded-xl border ${imageWidth === width ? "border-[#3F8C62] bg-[#bff4df]" : "border-[#bdebd9] bg-white/70"}`}
              title={`${width}px`}
            >
              <span className="rounded-full bg-[#0f5138]" style={{ width: width * 2 + 8, height: width }} />
            </button>
          ))}
          <span className="mx-1 h-8 w-px bg-[#9edfc7]" />
          <button
            type="button"
            onClick={() => setImageBoardZoom((value) => Math.max(0.45, Number((value - 0.15).toFixed(2))))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#bdebd9] bg-white/70 text-[#0f5138]"
            title="Уменьшить доску"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={() => setImageBoardZoom(1)}
            className="inline-flex h-9 min-w-14 items-center justify-center rounded-xl border border-[#bdebd9] bg-white/70 px-2 text-xs font-black text-[#0f5138]"
            title="Масштаб 100%"
          >
            {Math.round(imageBoardZoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setImageBoardZoom((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#bdebd9] bg-white/70 text-[#0f5138]"
            title="Приблизить доску"
          >
            <Plus size={16} />
          </button>
          <span className="mx-1 h-8 w-px bg-[#9edfc7]" />
          <button
            type="button"
            onClick={() => setImageDraftStrokes((strokes) => strokes.slice(0, -1))}
            disabled={imageDraftStrokes.length === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#bdebd9] bg-white/70 text-[#0f5138] disabled:opacity-40"
            title="Отменить"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={saveComment}
            disabled={saving || imageDraftStrokes.length === 0 || !selectedImagePoint}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#3F8C62] bg-[#3F8C62] px-3 text-xs font-black text-white disabled:opacity-40"
            title="Сохранить пометку, чтобы ученик её увидел"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Сохранить пометку
          </button>
          <button
            type="button"
            onClick={() => {
              setImageDraftStrokes([]);
              setSelectedImagePoint(null);
            }}
            disabled={imageDraftStrokes.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[#bdebd9] bg-white/70 px-3 text-xs font-black text-[#0f5138] disabled:opacity-40"
            title="Очистить"
          >
            Очистить
          </button>
          <div className="ml-auto hidden text-[10px] font-bold uppercase tracking-[0.08em] text-[#3F8C62] lg:block">
            P карандаш · E ластик · 1-4 толщина · Ctrl+Z отмена
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#3F8C62]">
            <ImageIcon size={14} />
            Можно писать поверх картинки
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
            <PenLine size={12} />
            Нарисуйте маркером место ошибки
          </div>
        </div>
        <div
          ref={imageBoardRef}
          className={`relative max-h-[calc(100dvh-345px)] min-h-[430px] touch-none overflow-auto rounded-2xl border border-[#8fe9c8] bg-[#071522] shadow-[inset_0_0_0_1px_rgba(143,233,200,0.18)] ${spacePressed ? (panningImage ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"}`}
          style={{
            backgroundImage:
              "linear-gradient(rgba(143,233,200,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(143,233,200,0.10) 1px, transparent 1px), linear-gradient(rgba(143,233,200,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(143,233,200,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px, 40px 40px, 8px 8px, 8px 8px",
          }}
          onPointerDown={startImageDrawing}
          onPointerMove={continueImageDrawing}
          onPointerUp={finishImageDrawing}
          onPointerCancel={finishImageDrawing}
          onClick={(event) => {
            setSelectedRange(null);
            if (spacePressed) return;
            setSelectedImagePoint(pointFromImageEvent(event));
          }}
        >
          <div
            className="relative min-h-[430px] origin-top-left"
            style={{
              width: `${imageBoardZoom * 100}%`,
              minWidth: "100%",
              height: hasBoardData ? `max(430px, calc((100dvh - 365px) * ${imageBoardZoom}))` : undefined,
            }}
          >
          {imageHref && !hasBoardData && <img src={imageHref} alt="Фото решения" className="block w-full object-contain" />}
          {hasBoardData && (
            <svg className="block h-full min-h-[430px] w-full" viewBox={`0 0 ${imageBoardViewWidth} ${imageBoardViewHeight}`} preserveAspectRatio="none">
              {boardData.map((stroke, strokeIndex) => (
                <polyline
                  key={`board-${strokeIndex}`}
                  points={boardStrokePoints(stroke)}
                  fill="none"
                  stroke={stroke.color || "#ef4444"}
                  strokeWidth={Math.max(0.25, (stroke.width || 2) / 3)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${imageBoardViewWidth} ${imageBoardViewHeight}`} preserveAspectRatio="none">
            {imageComments.flatMap((comment) => (comment.image_drawing ?? []).map((stroke, strokeIndex) => (
              <polyline
                key={`${comment.id}-${strokeIndex}`}
                points={imageStrokePoints(stroke)}
                fill="none"
                stroke={stroke.color || "#e96025"}
                strokeWidth={stroke.width || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )))}
            {imageDraftStrokes.map((stroke, strokeIndex) => (
              <polyline
                key={`draft-${strokeIndex}`}
                points={imageStrokePoints(stroke)}
                fill="none"
                stroke={stroke.color || "#e96025"}
                strokeWidth={stroke.width || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {imageComments.map((comment, index) => (
            <button
              key={comment.id}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                selectComment(comment);
              }}
              title={comment.text}
              className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#e96025] text-xs font-black text-white shadow-[0_8px_20px_rgba(233,96,37,0.32)] ring-2 ring-white"
              style={imageMarkerStyle(comment)}
            >
              {index + 1}
            </button>
          ))}
          </div>
        </div>
        {imageDraftStrokes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setImageDraftStrokes([]);
              setSelectedImagePoint(null);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-black text-[#526058] hover:bg-[#f8fbf8]"
          >
            <RotateCcw size={13} />
            Очистить разметку
          </button>
        )}
      </div>
    );
  }

  function renderMainView() {
    if (activeView === "draft") return renderCodeLike(recognizedText, "Черновик пока пустой.", false);
    if (activeView === "code") return renderCodeLike(code, "У ученика пока нет сохранённого кода.", true);
    if (activeView === "image") return renderImageBoard();
    return (
      <div className="flex h-[calc(100dvh-275px)] min-h-[430px] items-center justify-center px-6">
        {fileHref ? (
          <a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-[#3F8C62] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(63,140,98,0.24)]">
            <ExternalLink size={16} />
            Открыть файл ученика
          </a>
        ) : (
          <div className="text-sm text-gray-400">Файл не прикреплён.</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-[#eef5ef] p-0 sm:p-4">
      <div className="grid h-full w-full overflow-hidden border border-[#dfe8df] bg-[#eef5ef] shadow-[0_18px_55px_rgba(15,23,20,0.10)] sm:rounded-[28px] lg:grid-cols-[minmax(0,1fr)_430px]">
        {loading ? (
          <div className="col-span-full flex items-center justify-center text-[#3F8C62]">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <>
            <section className="flex min-h-0 min-w-0 flex-col border-r border-[#dfe8df] bg-[#f8fbf8]">
              <div className="flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#dfe8df] bg-white/80 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 text-sm font-black text-[#08140d]">
                    <span className="h-2 w-2 rounded-full bg-[#00c58d]" />
                    Решение ученика
                  </div>
                  {enabledViews.length === 0 && (
                    <div className="rounded-full border border-[#dfe8df] bg-white px-3 py-2 text-xs font-black text-[#7a877c]">
                      Материалов нет
                    </div>
                  )}
                  {enabledViews.map((view) => {
                    const Icon = view.icon;
                    const active = activeView === view.id;
                    return (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => openView(view.id)}
                        className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-black transition-colors ${
                          active
                            ? "border-[#8fe9c8] bg-[#d7fff0] text-[#007a52]"
                            : "border-[#dfe8df] bg-white text-[#526058] hover:bg-[#f4faf5]"
                        }`}
                      >
                        <Icon size={14} />
                        {view.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  {hasCondition && (
                    <button
                      type="button"
                      onClick={() => setConditionVisible((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#dfe8df] bg-white px-4 py-2.5 text-xs font-black text-[#18251d] hover:bg-[#f4faf5]"
                    >
                      <Eye size={14} />
                      {conditionVisible ? "Скрыть условие" : "Показать условие"}
                    </button>
                  )}
                  <button onClick={onClose} className="rounded-2xl border border-[#dfe8df] bg-white p-2.5 text-[#526058] transition-colors hover:bg-[#f4faf5] hover:text-[#18251d]">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                {conditionVisible && hasCondition && (
                  <div className="mb-4 rounded-[22px] border border-[#dfe8df] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,20,0.05)]">
                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#3F8C62]">
                      <BookOpen size={14} />
                      Условие задачи
                    </div>
                    {review?.task_title && <div className="mb-2 text-sm font-black text-[#18251d]">{review.task_title}</div>}
                    {review?.task_description && (
                      <div className="mb-3 text-sm leading-relaxed text-[#526058]">
                        <TaskView content={review.task_description} />
                      </div>
                    )}
                    {(userAnswer || correctAnswer) && (
                      <div className="mb-3 grid gap-2 rounded-2xl border border-[#edf3ed] bg-[#f8fbf8] p-3 sm:grid-cols-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Ответ ученика</div>
                          <div className="mt-1 text-sm font-black text-[#18251d]">{userAnswer || "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Правильный ответ</div>
                          <div className="mt-1 text-sm font-black text-[#3F8C62]">{correctAnswer || "—"}</div>
                        </div>
                      </div>
                    )}
                    {review?.task_content_html && (
                      <div className="text-sm leading-relaxed text-[#18251d]">
                        <TaskView content={review.task_content_html} />
                      </div>
                    )}
                  </div>
                )}

                <div className="overflow-hidden rounded-[24px] border border-[#dfe8df] bg-white shadow-[0_12px_36px_rgba(15,23,20,0.06)]">
                  {renderMainView()}
                </div>

                <div className={`mt-4 max-w-[460px] ${activeView === "image" ? "" : "hidden"}`}>
                  <div className="rounded-[22px] border border-[#dfe8df] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,20,0.05)]">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Замечание</div>
                    <div className="mt-3 rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] px-3 py-2 text-xs text-[#3F8C62]">
                      {selectedImagePoint
                        ? `Точка на картинке: ${selectedImagePoint.x.toFixed(0)}%, ${selectedImagePoint.y.toFixed(0)}%`
                        : selectedRange
                          ? rangeLabel(selectedRange)
                          : "Выделите фрагмент в тексте/коде или нарисуйте на картинке"}
                    </div>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={4}
                      placeholder="Что нужно исправить"
                      className="mt-3 w-full resize-none rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] px-3 py-3 text-sm text-[#18251d] outline-none placeholder:text-gray-300 focus:border-[#3F8C62]"
                    />
                    <button
                      onClick={saveComment}
                      disabled={saving || (!commentText.trim() && imageDraftStrokes.length === 0) || (!selectedRange && !selectedImagePoint)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3F8C62] px-4 py-3 text-xs font-black text-white transition-opacity disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Сохранить замечание
                    </button>
                    {error && <div className="mt-2 text-xs font-semibold text-red-400">{error}</div>}
                  </div>

                  <div className="hidden rounded-[22px] border border-[#dfe8df] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,20,0.05)]">
                    <div className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                      Комментарии {review?.comments.length ? `(${review.comments.length})` : ""}
                    </div>
                    <div className="grid max-h-64 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                      {review?.comments.map((comment) => (
                        <div key={comment.id} className="rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] p-3">
                          <button onClick={() => selectComment(comment)} className="text-left text-[11px] font-black text-[#b7791f] hover:underline">
                            {commentLabel(comment)}
                          </button>
                          {comment.reaction && (
                            <div className="mt-2 inline-flex rounded-full bg-[#eef3ee] px-2 py-1 text-[10px] font-black text-[#3F8C62]">
                              {comment.reaction === "fixed" ? "Исправлено учеником" : "Нужна помощь"}
                            </div>
                          )}
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#18251d]">{comment.text}</div>
                          <button onClick={() => deleteComment(comment.id)} disabled={saving} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-400 disabled:opacity-40">
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
                </div>
              </div>
            </section>

            <aside className="flex min-h-0 flex-col bg-white">
              <div className="flex min-h-[68px] shrink-0 items-center justify-between border-b border-[#dfe8df] px-5">
                <div className="flex items-center gap-6">
                  <div className="text-sm font-black text-[#526058]">AI Наставник</div>
                  <div className="border-b-2 border-[#22e6a8] py-5 text-sm font-black text-[#22d99f]">Преподаватель</div>
                </div>
                <button onClick={onClose} className="rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] p-2.5 text-[#526058] hover:bg-[#eef5ef]">
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {review?.help_thread ? (
                  <div className="flex min-h-full flex-col">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#eafff5] px-3 py-1.5 text-xs font-black text-[#007a52]">
                        <MessageCircle size={13} />
                        Чат с учеником
                      </div>
                      <div className={`rounded-full px-2.5 py-1.5 text-[10px] font-black ${review.help_thread.is_resolved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {review.help_thread.is_resolved ? "Решён" : "Открыт"}
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                      {review.help_thread.messages.length === 0 ? (
                        <div className="rounded-2xl bg-[#f3f6f3] px-4 py-3 text-sm text-[#7a877c]">Сообщений пока нет.</div>
                      ) : review.help_thread.messages.map((message) => {
                        const teacher = message.author_role === "teacher";
                        const system = message.kind === "system";
                        const authorLabel = system
                          ? "Событие"
                          : teacher
                            ? "Преподаватель"
                            : studentName || message.author_name || "Ученик";
                        return (
                          <div key={message.id} className={`flex items-start gap-3 ${teacher ? "justify-end" : "justify-start"}`}>
                            {!teacher && (
                              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7fff0] text-[11px] font-black text-[#007a52] ring-1 ring-[#8fe9c8]">
                                {system ? "i" : "У"}
                              </div>
                            )}
                            <div className={`flex min-w-0 max-w-[82%] flex-col ${teacher ? "items-end" : "items-start"}`}>
                              <div className={`mb-1 flex max-w-full items-center gap-2 text-[10px] font-black uppercase tracking-wide ${teacher ? "justify-end text-[#3F8C62]" : "justify-start text-[#526058]"}`}>
                                <span className="truncate">{authorLabel}</span>
                                {message.created_at && (
                                  <span className="shrink-0 font-bold normal-case tracking-normal text-[#9aa79f]">
                                    {new Date(message.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                              <div className={`max-w-full break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-[0_10px_28px_rgba(15,23,20,0.06)] ${
                                system
                                  ? "bg-[#f3f6f3] text-[#526058]"
                                  : teacher
                                    ? "bg-[#3F8C62] text-white"
                                    : "bg-[#f3f6f3] text-[#18251d]"
                              }`}>
                                <div className="whitespace-pre-wrap">{message.text}</div>
                              </div>
                            </div>
                            {teacher && (
                              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3F8C62] text-[11px] font-black text-white shadow-[0_8px_18px_rgba(63,140,98,0.25)]">
                                П
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={helpMessagesEndRef} />
                    </div>
                    {!review.help_thread.is_resolved && (
                      <div className="mt-4 space-y-2">
                        <textarea
                          value={helpMessage}
                          onChange={(event) => setHelpMessage(event.target.value)}
                          rows={3}
                          placeholder="Ответ ученику"
                          className="w-full resize-none rounded-2xl border border-[#dfe8df] bg-[#f8fbf8] px-3 py-3 text-sm text-[#18251d] outline-none placeholder:text-gray-300 focus:border-[#3F8C62]"
                        />
                        <button type="button" onClick={sendHelpMessage} disabled={saving || !helpMessage.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00c58d] px-4 py-3 text-xs font-black text-[#06261b] disabled:opacity-40">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Отправить
                        </button>
                        <button type="button" onClick={closeHelpThread} disabled={saving} className="inline-flex w-full items-center justify-center rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 text-xs font-black text-[#526058] hover:bg-[#f8fbf8] disabled:opacity-40">
                          Закрыть вопрос
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-full items-center">
                    <div className="w-full rounded-[20px] border border-[#dfe8df] bg-[#f3f6f3] p-5">
                      <div className="text-sm font-black text-[#08140d]">Диалог с учеником ещё не создан</div>
                      <div className="mt-2 text-sm leading-relaxed text-[#526058]">
                        Когда ученик попросит помощь или отправит решение на проверку, здесь появится переписка.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
      {codeCommentAnchor && selectedRange && activeView === "code" && (
        <div
          className="fixed z-[120] w-[360px] rounded-2xl border border-[#dfe8df] bg-white p-3 shadow-[0_18px_44px_rgba(15,23,20,0.22)]"
          style={{ left: codeCommentAnchor.left, top: codeCommentAnchor.top }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#3F8C62]">
            {rangeLabel(selectedRange)}
          </div>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={3}
            autoFocus
            placeholder="Комментарий к выделенному коду"
            className="w-full resize-none rounded-xl border border-[#dfe8df] bg-[#f8fbf8] px-3 py-2.5 text-sm text-[#18251d] outline-none placeholder:text-gray-300 focus:border-[#3F8C62]"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCodeCommentAnchor(null);
                setCommentText("");
              }}
              className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-black text-[#526058] hover:bg-[#f8fbf8]"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={saveComment}
              disabled={saving || !commentText.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3F8C62] px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Сохранить
            </button>
          </div>
          {error && <div className="mt-2 text-xs font-semibold text-red-400">{error}</div>}
        </div>
      )}
    </div>
  );
}
