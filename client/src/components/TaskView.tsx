import React, { useMemo } from "react";
import parse from "html-react-parser";
import type { HTMLReactParserOptions } from "html-react-parser";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { TaskFile } from "../api/types";
import "./TaskView.css";

interface Props {
    content: string;
    title?: string;
    files?: TaskFile[];
}

const parseOptions: HTMLReactParserOptions = {};

// Маппинг HTML-сущностей на LaTeX-команды для логических операций
const HTML_ENTITY_TO_LATEX: Record<string, string> = {
    "&and;": "\\land",
    "&or;": "\\lor",
    "&not;": "\\lnot ",
    "&oplus;": "\\oplus",
    "&rarr;": "\\rightarrow",
    "&larr;": "\\leftarrow",
    "&harr;": "\\leftrightarrow",
    "&rArr;": "\\Rightarrow",
    "&lArr;": "\\Leftarrow",
    "&hArr;": "\\Leftrightarrow",
    "&forall;": "\\forall",
    "&exist;": "\\exists",
    "&empty;": "\\emptyset",
    "&isin;": "\\in",
    "&notin;": "\\notin",
    "&sub;": "\\subset",
    "&sup;": "\\supset",
    "&cup;": "\\cup",
    "&cap;": "\\cap",
    "&le;": "\\leq",
    "&ge;": "\\geq",
    "&ne;": "\\neq",
    "&equiv;": "\\equiv",
    "&sdot;": "\\cdot",
    "&times;": "\\times",
    "&divide;": "\\div",
    "&plusmn;": "\\pm",
    "&infin;": "\\infty",
    "&sum;": "\\sum",
    "&prod;": "\\prod",
    "&radic;": "\\sqrt{}",
    "&part;": "\\partial",
    "&nabla;": "\\nabla",
    "&alpha;": "\\alpha",
    "&beta;": "\\beta",
    "&gamma;": "\\gamma",
    "&delta;": "\\delta",
    "&epsilon;": "\\epsilon",
    "&lambda;": "\\lambda",
    "&mu;": "\\mu",
    "&pi;": "\\pi",
    "&sigma;": "\\sigma",
    "&tau;": "\\tau",
    "&phi;": "\\phi",
    "&omega;": "\\omega",
};

const htmlEntityPattern = new RegExp(
    Object.keys(HTML_ENTITY_TO_LATEX).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "gi"
);

// Unicode math symbols → LaTeX commands (for undelimited content)
const UNICODE_TO_LATEX: Record<string, string> = {
    "∧": "\\land ", "∨": "\\lor ", "¬": "\\lnot ", "⊕": "\\oplus ",
    "→": "\\rightarrow ", "←": "\\leftarrow ", "↔": "\\leftrightarrow ",
    "≡": "\\equiv ", "∀": "\\forall ", "∃": "\\exists ",
    "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ",
    "∪": "\\cup ", "∩": "\\cap ",
    "≤": "\\leq ", "≥": "\\geq ", "≠": "\\neq ",
    "·": "\\cdot ", "×": "\\times ", "÷": "\\div ",
    "±": "\\pm ", "∞": "\\infty ",
};

// Известные LaTeX-команды математики
const MATH_CMD_RE = /\\(?:l(?:or|and|not|eq|eftarrow|eftrightarrow)|r(?:ightarrow|eq)|n(?:eg|ot|eq|otin)|equiv|oplus|forall|exists|in(?:fty)?|notin|subset|supset|cup|cap|cdot|times|div|pm|geq|leq|overline|underline|hat|bar|vec|alpha|beta|gamma|delta|epsilon|lambda|mu|pi|sigma|tau|phi|omega|sum|prod|sqrt|frac)(?![a-zA-Z])/;

// Добавляет пробел после LaTeX-команды, если следующий символ — буква/цифра
function fixConcatenatedCommands(formula: string): string {
    return formula.replace(
        /\\(lor|land|neg|lnot|equiv|rightarrow|leftarrow|leftrightarrow|oplus|forall|exists|leq|geq|neq|in|notin|subset|cup|cap|cdot|times|div|pm|overline|underline|hat|bar|vec)([a-zA-Z0-9])/g,
        "\\$1 $2"
    );
}

// Декодируем HTML-сущности внутри формулы в LaTeX-команды
function decodeHtmlEntitiesInFormula(formula: string): string {
    return formula.replace(htmlEntityPattern, (match) => {
        return HTML_ENTITY_TO_LATEX[match.toLowerCase()] || match;
    });
}

// Конвертирует Unicode-символы в LaTeX-команды внутри строки
function unicodeToLatex(text: string): string {
    for (const [sym, cmd] of Object.entries(UNICODE_TO_LATEX)) {
        text = text.split(sym).join(cmd);
    }
    return text;
}

// Обрабатывает текстовые узлы между HTML-тегами, содержащие LaTeX-команды без $...$
function autoWrapUndelimitedLatex(html: string): string {
    // Находим текстовые сегменты между тегами (не содержат <)
    return html.replace(/(?<=>|^)([^<]+)(?=<|$)/gm, (textNode) => {
        // Уже есть разделители — пропускаем
        if (/\$|\\\(|\\\[/.test(textNode)) return textNode;
        // Нет LaTeX-команд — пропускаем
        if (!MATH_CMD_RE.test(textNode)) return textNode;
        // Если содержит кириллицу — пропускаем (это проза, не формула)
        if (/[А-Яа-яЁё]/.test(textNode)) return textNode;

        const formula = fixConcatenatedCommands(
            decodeHtmlEntitiesInFormula(
                unicodeToLatex(textNode.trim())
            )
        );
        try {
            return katex.renderToString(formula, { throwOnError: false, displayMode: false });
        } catch {
            return textNode;
        }
    });
}

// Функция для рендеринга LaTeX-формул
function renderLatex(text: string): string {
    // Обрабатываем display-формулы $$...$$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        try {
            return katex.renderToString(decodeHtmlEntitiesInFormula(formula), { displayMode: true, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем inline-формулы $...$
    text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
        try {
            return katex.renderToString(decodeHtmlEntitiesInFormula(fixConcatenatedCommands(formula)), { displayMode: false, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем формулы в нотации \(...\) для inline
    text = text.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
        try {
            return katex.renderToString(decodeHtmlEntitiesInFormula(formula), { displayMode: false, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем формулы в нотации \[...\] для display
    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
        try {
            return katex.renderToString(decodeHtmlEntitiesInFormula(formula), { displayMode: true, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем текстовые узлы с LaTeX-командами без $...$ (смешанный формат)
    text = autoWrapUndelimitedLatex(text);

    return text;
}

// Decode double-encoded HTML entities: &amp;gt; → &gt; (which the parser then renders as >)
function normalizeEntities(html: string): string {
    return html.replace(/&amp;((?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, "&$1");
}

export default function TaskView({ content, title, files }: Props) {
    const parsedContent = useMemo(() => {
        const processedContent = renderLatex(normalizeEntities(content));
        return parse(processedContent, parseOptions);
    }, [content]);

    return (
        <div className="task-view fade-in">
            {title && <h1 className="task-title">{title}</h1>}
            <div className="task-body">
                {parsedContent}
            </div>
            {files && files.length > 0 && (
                <div className="task-files">
                    <span className="task-files-label">Файлы к заданию:</span>
                    {files.map((f) => (
                        <a
                            key={f.url}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="task-file-link"
                            download
                        >
                            📎 {f.name || "Скачать файл"}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
