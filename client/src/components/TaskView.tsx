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

// Функция для рендеринга LaTeX-формул
function renderLatex(text: string): string {
    // Обрабатываем display-формулы $$...$$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем inline-формулы $...$
    text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: false, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем формулы в нотации \(...\) для inline
    text = text.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: false, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // Обрабатываем формулы в нотации \[...\] для display
    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: true, throwOnError: false });
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
