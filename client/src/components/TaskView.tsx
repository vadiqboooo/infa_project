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

// Декодируем HTML-сущности внутри формулы в LaTeX-команды
function decodeHtmlEntitiesInFormula(formula: string): string {
    return formula.replace(htmlEntityPattern, (match) => {
        return HTML_ENTITY_TO_LATEX[match.toLowerCase()] || match;
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
            return katex.renderToString(decodeHtmlEntitiesInFormula(formula), { displayMode: false, throwOnError: false });
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

    return text;
}

export default function TaskView({ content, title, files }: Props) {
    const parsedContent = useMemo(() => {
        const processedContent = renderLatex(content);
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
