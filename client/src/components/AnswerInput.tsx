import React, { useEffect, useMemo } from "react";
import { Upload } from "lucide-react";
import type { AnswerType, AnswerVal } from "../api/types";
import "./AnswerInput.css";
import { parseTableString } from "../lib/tableAnswer";

interface Props {
    type: AnswerType;
    value: AnswerVal;
    table?: { cols: number; rows: number } | null;
    onChange: (val: AnswerVal) => void;
    disabled?: boolean;
    egeNumber?: number;
    isMath?: boolean;
    examType?: 'ege' | 'oge';
    // Per-element correctness feedback (for tasks 26/27 after check)
    // pair (26): boolean[] of length 2
    // table (27): boolean[][] shape 2x2
    feedback?: boolean[] | boolean[][] | null;
    // File answers: the value is the uploaded file URL; the parent performs the upload
    onFileUpload?: (file: File) => void;
    fileUploading?: boolean;
    fileError?: string | null;
}

const ANSWER_FILE_ACCEPT = ".py,.txt,.doc,.docx,.pdf,.xlsx,.xls,.csv,.ods,.odt,.zip,.png,.jpg,.jpeg,.pas,.cpp,.c,.java,.cs";

const parseInputValue = (s: string): number | string => {
    if (s === "") return "";
    const normalized = s.replace(',', '.');
    if (normalized === "-") return "-";
    const parsed = parseFloat(normalized);
    if (normalized.endsWith('.') && !isNaN(parseFloat(normalized.slice(0, -1)))) {
        return normalized;
    }
    return isNaN(parsed) ? s : parsed;
};

const stringifyTable = (arr: (number | string)[][]): string => {
    const trimmed = [...arr];
    while (trimmed.length > 1 && trimmed[trimmed.length - 1].every(cell => String(cell).trim() === "")) {
        trimmed.pop();
    }
    return trimmed.map(row => row.join(' ')).join('\n');
};

const getArrayValue = (value: AnswerVal, size: number): (number | string)[] => {
    const source = Array.isArray(value) && !Array.isArray(value[0]) ? value as (number | string)[] : [];
    return Array.from({ length: size }, (_, index) => source[index] ?? "");
};

export default function AnswerInput({ type, table, value, onChange, disabled, egeNumber, isMath, examType, feedback, onFileUpload, fileUploading, fileError }: Props) {
    useEffect(() => {
        const hasMathParts = isMath && examType === 'ege' && [13, 14, 17, 19].includes(egeNumber ?? 0);
        if (disabled || hasMathParts || type !== "table" || egeNumber === 27 || !table || table.cols === 2) return;
        const normalized = parseTableString(value, egeNumber, table);
        if (JSON.stringify(value) !== JSON.stringify(normalized)) onChange(normalized);
    }, [type, value, egeNumber, table, onChange, disabled, isMath, examType]);

    const formatValue = (v: any) => (v === null || v === undefined ? "" : String(v));

    if (type === 'file') {
        const fileUrl = typeof value === "string" ? value : "";
        const fileName = fileUrl ? decodeURIComponent(fileUrl.split("/").pop() || "") : "";
        return (
            <div className="flex flex-col gap-2 w-full">
                {fileUrl && (
                    <a
                        href={`/api${fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-[#3F8C62] break-all hover:underline"
                    >
                        Прикреплён файл: {fileName}
                    </a>
                )}
                <label className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 px-4 py-4 text-sm font-bold text-emerald-500 transition hover:bg-emerald-500/10 ${disabled || fileUploading || !onFileUpload ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <Upload size={16} />
                    {fileUploading ? "Загрузка..." : fileUrl ? "Заменить файл" : "Прикрепить файл с ответом"}
                    <input
                        type="file"
                        className="hidden"
                        accept={ANSWER_FILE_ACCEPT}
                        disabled={disabled || fileUploading || !onFileUpload}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f && onFileUpload) onFileUpload(f);
                        }}
                    />
                </label>
                {fileError && <span className="text-xs text-red-500">{fileError}</span>}
                <span className="text-xs opacity-70">До 10 МБ. Файл проверит учитель.</span>
            </div>
        );
    }

    // Tailwind classes for per-cell feedback color
    const cellCls = (ok: boolean | undefined) =>
        ok === true ? "!border-emerald-400 !bg-emerald-400/10 !text-emerald-200" :
        ok === false ? "!border-red-400 !bg-red-400/10 !text-red-200" : "";

    if (type === 'math_expression') {
        return (
            <label className="flex flex-col gap-2 w-full">
                <input
                    type="text"
                    className="input answer-input-single"
                    value={formatValue(value)}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    maxLength={256}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Математический ответ"
                    placeholder="Например: -sqrt(2)"
                />
                <span className="text-xs opacity-70">
                    Корень: sqrt(2) или √2; дробь: 1/2; степень: x^2; sin(alpha), cos(α), tg(α), ctg(α). Можно вводить LaTeX. Ответ — точный, без округления.
                </span>
            </label>
        );
    }

    if (isMath && examType === 'ege' && (egeNumber === 13 || egeNumber === 19)) {
        const labels = egeNumber === 13 ? ["А", "Б"] : ["А", "Б", "В"];
        const val = getArrayValue(value, labels.length);

        return (
            <div className="math-part-inputs">
                {labels.map((label, index) => (
                    <label key={label} className="math-part-field">
                        <span className="math-part-label">Ответ {label}</span>
                        <input
                            type="text"
                            className="input answer-input-single"
                            value={formatValue(val[index])}
                            onChange={(e) => {
                                const next = [...val];
                                next[index] = e.target.value;
                                onChange(next);
                            }}
                            disabled={disabled}
                            placeholder=""
                        />
                    </label>
                ))}
            </div>
        );
    }

    if (isMath && examType === 'ege' && (egeNumber === 14 || egeNumber === 17)) {
        const val = getArrayValue(value, 2);

        return (
            <div className="math-part-inputs">
                <label className="math-part-field">
                    <span className="math-part-label">Ответ А - доказательство</span>
                    <textarea
                        className="input math-proof-input"
                        value={formatValue(val[0])}
                        onChange={(e) => onChange([e.target.value, val[1]])}
                        disabled={disabled}
                        placeholder=""
                        rows={4}
                    />
                </label>
                <label className="math-part-field">
                    <span className="math-part-label">Ответ Б - число</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="input answer-input-single"
                        value={formatValue(val[1])}
                        onChange={(e) => onChange([val[0], parseInputValue(e.target.value)])}
                        disabled={disabled}
                        placeholder=""
                    />
                </label>
            </div>
        );
    }

    if (type === "text") {
        return (
            <input
                type="text"
                className="input answer-input-single"
                value={typeof value === "string" ? value : formatValue(value)}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder=""
            />
        );
    }

    if (type === "single_number") {
        return (
            <input
                type="text"
                inputMode="decimal"
                className="input answer-input-single"
                value={formatValue(value)}
                onChange={(e) => onChange(parseInputValue(e.target.value))}
                disabled={disabled}
                placeholder=""
            />
        );
    }

    if (type === "pair") {
        const val = Array.isArray(value) && !Array.isArray(value[0]) ? (value as (number | string)[]) : ["", ""];
        const fb = Array.isArray(feedback) && typeof feedback[0] === 'boolean' ? feedback as boolean[] : null;
        return (
            <div className="pair-inputs">
                <input
                    type="text"
                    inputMode="decimal"
                    className={`input ${cellCls(fb?.[0])}`}
                    value={formatValue(val[0])}
                    onChange={(e) => onChange([parseInputValue(e.target.value), val[1]])}
                    disabled={disabled}
                    placeholder=""
                />
                <div className="input-separator">•</div>
                <input
                    type="text"
                    inputMode="decimal"
                    className={`input ${cellCls(fb?.[1])}`}
                    value={formatValue(val[1])}
                    onChange={(e) => onChange([val[0], parseInputValue(e.target.value)])}
                    disabled={disabled}
                    placeholder=""
                />
            </div>
        );
    }

    if (type === "table") {
        const tableData = useMemo(() => parseTableString(value, egeNumber, table), [value, egeNumber, table]);
        const fb = Array.isArray(feedback) && Array.isArray(feedback[0]) ? feedback as boolean[][] : null;

        if (egeNumber === 27) {
            return (
                <div className="task-27-wrapper">
                    {tableData.slice(0, 2).map((row, rIdx) => (
                        <div key={rIdx} className="task-27-section">
                            <span className="task-27-label">Ответ на {rIdx === 0 ? "А" : "Б"}</span>
                            <div className="task-27-row">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className={`input table-input ${cellCls(fb?.[rIdx]?.[0])}`}
                                    value={formatValue(row[0])}
                                    onChange={(e) => {
                                        const newVal = tableData.map((r, ri) =>
                                            r.map((c, ci) => (ri === rIdx && ci === 0 ? parseInputValue(e.target.value) : c))
                                        );
                                        onChange(newVal);
                                    }}
                                    disabled={disabled}
                                    placeholder=""
                                />
                                <div className="input-separator">•</div>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className={`input table-input ${cellCls(fb?.[rIdx]?.[1])}`}
                                    value={formatValue(row[1])}
                                    onChange={(e) => {
                                        const newVal = tableData.map((r, ri) =>
                                            r.map((c, ci) => (ri === rIdx && ci === 1 ? parseInputValue(e.target.value) : c))
                                        );
                                        onChange(newVal);
                                    }}
                                    disabled={disabled}
                                    placeholder=""
                                />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="table-grid-wrapper">
                {tableData.map((row, rIdx) => (
                    <div key={rIdx} className="table-row-dynamic">
                        {row.map((cell, cIdx) => (
                            <React.Fragment key={cIdx}>
                                {cIdx > 0 && <div className="input-separator">•</div>}
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className={`input table-input ${cellCls(fb?.[rIdx]?.[cIdx])}`}
                                    value={formatValue(cell)}
                                    onChange={(e) => {
                                        const newVal = tableData.map((r, ri) =>
                                            r.map((c, ci) => (ri === rIdx && ci === cIdx ? parseInputValue(e.target.value) : c))
                                        );
                                        onChange(newVal);
                                    }}
                                    disabled={disabled}
                                    placeholder=""
                                />
                            </React.Fragment>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    return null;
}
