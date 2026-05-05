import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, hoverTooltip, type Tooltip } from "@codemirror/view";

export type CodeCommentRange = {
  id: number;
  from_offset?: number | null;
  to_offset?: number | null;
  from_line: number;
  from_col: number;
  to_line: number;
  to_col: number;
  text: string;
  reaction?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function commentRangeToOffsets(view: EditorView, comment: Omit<CodeCommentRange, "id" | "text">) {
  const doc = view.state.doc;
  if (typeof comment.from_offset === "number" && typeof comment.to_offset === "number") {
    const from = clamp(comment.from_offset, 0, doc.length);
    const rawTo = clamp(comment.to_offset, 0, doc.length);
    const to = Math.max(Math.min(from + 1, doc.length), rawTo);
    return { from, to };
  }
  const lastLine = doc.lines;
  const fromLine = doc.line(clamp(comment.from_line, 1, lastLine));
  const toLine = doc.line(clamp(comment.to_line, 1, lastLine));
  const from = clamp(fromLine.from + Math.max(0, comment.from_col - 1), fromLine.from, fromLine.to);
  const rawTo = clamp(toLine.from + Math.max(0, comment.to_col - 1), toLine.from, toLine.to);
  const to = Math.max(from + 1, rawTo);
  return { from, to };
}

type CodeCommentOptions = {
  onReaction?: (commentId: number, reaction: "fixed" | "need_help") => void;
};

export function createCodeCommentExtensions(comments: CodeCommentRange[], options: CodeCommentOptions = {}) {
  const commentMarks = EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const viewLike = { state } as EditorView;
    const ranges = comments
      .map((comment) => ({ comment, ...commentRangeToOffsets(viewLike, comment) }))
      .sort((a, b) => a.from - b.from || a.to - b.to || a.comment.id - b.comment.id);

    for (const { comment, from, to } of ranges) {
      builder.add(
        from,
        to,
        Decoration.mark({
          class: "cm-solution-comment-range",
          attributes: {
            "data-comment-id": String(comment.id),
            style: "background-color: rgba(255, 208, 92, 0.34); border-bottom: 2px solid rgba(217, 145, 0, 0.82); border-radius: 3px; cursor: help;",
          },
        }),
      );
    }
    return builder.finish();
  });

  const tooltip = hoverTooltip((view, pos): Tooltip | null => {
    const comment = comments.find((item) => {
      const { from, to } = commentRangeToOffsets(view, item);
      return pos >= from && pos <= to;
    });
    if (!comment) return null;
    const { from, to } = commentRangeToOffsets(view, comment);
    return {
      pos: from,
      end: to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-solution-comment-tooltip";

        const body = document.createElement("div");
        body.className = "cm-solution-comment-tooltip-body";
        body.textContent = comment.text;

        const reactions = document.createElement("div");
        reactions.className = "cm-solution-comment-tooltip-reactions";

        const fixedButton = document.createElement("button");
        fixedButton.type = "button";
        fixedButton.className = `cm-solution-comment-tooltip-reaction${comment.reaction === "fixed" ? " is-active" : ""}`;
        fixedButton.textContent = "Получилось исправить";
        fixedButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onReaction?.(comment.id, "fixed");
        });

        const helpButton = document.createElement("button");
        helpButton.type = "button";
        helpButton.className = `cm-solution-comment-tooltip-reaction${comment.reaction === "need_help" ? " is-active" : ""}`;
        helpButton.textContent = "Нужна помощь с ошибкой";
        helpButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onReaction?.(comment.id, "need_help");
        });

        reactions.append(fixedButton, helpButton);
        dom.append(body, reactions);
        return { dom };
      },
    };
  }, { hoverTime: 120 });

  const theme = EditorView.baseTheme({
    ".cm-solution-comment-range": {
      backgroundColor: "rgba(255, 208, 92, 0.22)",
      borderBottom: "1px solid rgba(217, 145, 0, 0.65)",
      borderRadius: "2px",
      cursor: "help",
    },
    ".cm-tooltip.cm-tooltip-hover": {
      border: "none",
      background: "transparent",
      boxShadow: "none",
    },
    ".cm-solution-comment-tooltip": {
      maxWidth: "320px",
      borderRadius: "14px",
      padding: "10px 12px",
      backgroundColor: "#ffffff",
      color: "#1b261f",
      boxShadow: "0 18px 44px rgba(15, 23, 20, 0.18)",
      border: "1px solid rgba(212, 223, 214, 0.95)",
      fontSize: "12px",
      lineHeight: "1.5",
    },
    ".cm-solution-comment-tooltip-body": {
      whiteSpace: "pre-wrap",
    },
    ".cm-solution-comment-tooltip-reactions": {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      marginTop: "10px",
    },
    ".cm-solution-comment-tooltip-reaction": {
      width: "100%",
      border: "1px solid rgba(212, 223, 214, 0.95)",
      borderRadius: "10px",
      backgroundColor: "#f8fbf8",
      color: "#3f8c62",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "800",
      lineHeight: "1.2",
      padding: "7px 9px",
      textAlign: "left",
    },
    ".cm-solution-comment-tooltip-reaction:hover, .cm-solution-comment-tooltip-reaction.is-active": {
      backgroundColor: "#3f8c62",
      borderColor: "#3f8c62",
      color: "#ffffff",
    },
  });

  return [commentMarks, tooltip, theme];
}
