import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Pencil, Send, Trash2 } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

type Props = {
  text: string;
  sending?: boolean;
  sent?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onSendReview?: () => void;
};

type Token =
  | { type: "math"; content: string; display: boolean }
  | { type: "table"; rows: string[][] }
  | { type: "paragraph"; content: string[] };

function stripCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:latex|tex|text|markdown|md)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function stripMathDelimiters(value: string): string {
  return stripCodeFence(value)
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/^\$\$/, "")
    .replace(/\$\$$/, "")
    .replace(/^\$/, "")
    .replace(/\$$/, "")
    .trim();
}

function renderKatex(math: string, displayMode: boolean): string {
  const normalized = stripMathDelimiters(math)
    .replace(/\\begin\{align\}/g, "\\begin{aligned}")
    .replace(/\\end\{align\}/g, "\\end{aligned}");
  return katex.renderToString(normalized, {
    throwOnError: false,
    displayMode,
    strict: false,
  });
}

function normalizeRecognizedText(value: string): string {
  return stripCodeFence(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\begin\{cases\}/g, "\\begin{cases}")
    .replace(/\\end\{cases\}/g, "\\end{cases}")
    .trim();
}

function isMarkdownTableLine(line: string): boolean {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function parseTable(lines: string[]): string[][] {
  return lines
    .filter((line) => !isMarkdownTableSeparator(line))
    .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
}

function tokenize(text: string): Token[] {
  const source = normalizeRecognizedText(text);
  const tokens: Token[] = [];
  const lines = source.split("\n");
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const content = paragraph.map((item) => item.trim()).filter(Boolean);
    if (content.length > 0) tokens.push({ type: "paragraph", content });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line.startsWith("\\[") || line.startsWith("$$")) {
      flushParagraph();
      const end = line.startsWith("\\[") ? "\\]" : "$$";
      const block = [line];
      const isOpenOnly = line === "\\[" || line === "$$";
      while ((isOpenOnly || !block.join("\n").trim().endsWith(end)) && index + 1 < lines.length) {
        index += 1;
        block.push(lines[index]);
        if (lines[index].trim() === end || (!isOpenOnly && block.join("\n").trim().endsWith(end))) break;
      }
      tokens.push({ type: "math", content: block.join("\n"), display: true });
      continue;
    }

    if (/^\\begin\{(?:aligned|align|cases|array|pmatrix|bmatrix)\}/.test(line)) {
      flushParagraph();
      const environment = line.match(/^\\begin\{([^}]+)\}/)?.[1];
      const block = [line];
      while (environment && !block.join("\n").includes(`\\end{${environment}}`) && index + 1 < lines.length) {
        index += 1;
        block.push(lines[index]);
      }
      tokens.push({ type: "math", content: block.join("\n"), display: true });
      continue;
    }

    if (isMarkdownTableLine(line)) {
      flushParagraph();
      const tableLines = [line];
      while (index + 1 < lines.length && isMarkdownTableLine(lines[index + 1])) {
        index += 1;
        tableLines.push(lines[index].trim());
      }
      tokens.push({ type: "table", rows: parseTable(tableLines) });
      continue;
    }

    const lineMath = line.match(/^\s*(?:\\\(([\s\S]+)\\\)|\$([^$]+)\$)\s*$/);
    if (lineMath) {
      flushParagraph();
      tokens.push({ type: "math", content: line, display: true });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return tokens;
}

function renderInlineMath(content: string) {
  const parts = content.split(/(\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    const isMath = (part.startsWith("\\(") && part.endsWith("\\)")) || (part.startsWith("$") && part.endsWith("$"));
    if (!isMath) return <span key={index}>{part}</span>;

    return (
      <span
        key={index}
        className="recognized-solution-inline-math"
        dangerouslySetInnerHTML={{ __html: renderKatex(part, false) }}
      />
    );
  });
}

function renderToken(token: Token, index: number) {
  if (token.type === "math") {
    return (
      <div
        key={index}
        className="recognized-solution-math"
        dangerouslySetInnerHTML={{ __html: renderKatex(token.content, true) }}
      />
    );
  }

  if (token.type === "table") {
    return (
      <div key={index} className="recognized-solution-table-wrap">
        <table className="recognized-solution-table">
          <tbody>
            {token.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInlineMath(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div key={index} className="recognized-solution-text-group">
      {token.content.map((line, lineIndex) => (
        <p key={lineIndex} className="recognized-solution-text">
          {renderInlineMath(line)}
        </p>
      ))}
    </div>
  );
}

export default function RecognizedSolutionBlock({ text, sending = false, sent = false, onEdit, onDelete, onSendReview }: Props) {
  const [open, setOpen] = useState(false);
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  return (
    <div className="recognized-solution-block">
      <button
        type="button"
        className="recognized-solution-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="recognized-solution-title">Моё решение</span>
          <span className="recognized-solution-subtitle">Сохраненное решение с распознанным LaTeX</span>
        </span>
        <span className="recognized-solution-toggle-label">
          {open ? "Скрыть" : "Показать"}
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>
      {open && (
        <>
          <div className="recognized-solution-actions">
            <button type="button" onClick={onEdit} disabled={!onEdit}>
              <Pencil size={14} />
              Изменить
            </button>
            <button type="button" onClick={onSendReview} disabled={!onSendReview || sending || sent}>
              {sent ? <CheckCircle2 size={14} /> : <Send size={14} />}
              {sent ? "Отправлено" : sending ? "Отправка..." : "На проверку"}
            </button>
            <button type="button" className="danger" onClick={onDelete} disabled={!onDelete}>
              <Trash2 size={14} />
              Удалить
            </button>
          </div>
          <div className="recognized-solution-content">
            {tokens.map(renderToken)}
          </div>
        </>
      )}
    </div>
  );
}
