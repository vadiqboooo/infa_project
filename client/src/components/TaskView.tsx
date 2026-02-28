import React, { useMemo } from "react";
import parse from "html-react-parser";
import type { HTMLReactParserOptions } from "html-react-parser";
import "katex/dist/katex.min.css";
import type { TaskFile } from "../api/types";
import "./TaskView.css";

interface Props {
    content: string;
    title?: string;
    files?: TaskFile[];
}

const parseOptions: HTMLReactParserOptions = {};

export default function TaskView({ content, title, files }: Props) {
    const parsedContent = useMemo(() => parse(content, parseOptions), [content]);

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
