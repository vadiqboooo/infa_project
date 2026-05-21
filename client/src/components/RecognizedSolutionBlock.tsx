import katex from "katex";
import "katex/dist/katex.min.css";

type Props = {
  text: string;
  imageSrc?: string;
};

function stripMathDelimiters(value: string): string {
  return value
    .trim()
    .replace(/^```(?:latex|tex|text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/^\$\$/, "")
    .replace(/\$\$$/, "")
    .trim();
}

function renderKatex(math: string, displayMode: boolean): string {
  return katex.renderToString(stripMathDelimiters(math), {
    throwOnError: false,
    displayMode,
  });
}

function renderLine(line: string, index: number) {
  const trimmed = stripMathDelimiters(line);
  if (!trimmed) return null;

  const hasCyrillic = /[а-яё]/i.test(trimmed);
  const looksLikeMath = /\\|[_^=<>+\-*/()]|\d/.test(trimmed) && !hasCyrillic;

  if (looksLikeMath) {
    return (
      <div
        key={index}
        className="recognized-solution-math"
        dangerouslySetInnerHTML={{ __html: renderKatex(trimmed, true) }}
      />
    );
  }

  const parts = trimmed.split(/(\$[^$]+\$)/g);
  return (
    <p key={index} className="recognized-solution-text">
      {parts.map((part, partIndex) => {
        if (part.startsWith("$") && part.endsWith("$")) {
          return (
            <span
              key={partIndex}
              dangerouslySetInnerHTML={{ __html: renderKatex(part.slice(1, -1), false) }}
            />
          );
        }
        return <span key={partIndex}>{part}</span>;
      })}
    </p>
  );
}

export default function RecognizedSolutionBlock({ text, imageSrc }: Props) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0 && !imageSrc) return null;

  return (
    <div className="recognized-solution-block">
      <div className="recognized-solution-title">Распознанное решение</div>
      {imageSrc && (
        <div className="recognized-solution-image-wrap">
          <div className="recognized-solution-image-label">Рукописный черновик</div>
          <img className="recognized-solution-image" src={imageSrc} alt="Рукописный черновик решения" />
        </div>
      )}
      <div className="recognized-solution-content">
        {lines.map(renderLine)}
      </div>
    </div>
  );
}
