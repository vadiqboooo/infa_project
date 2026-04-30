import React, { useMemo } from "react";
import type { AnswerType, AnswerVal } from "../api/types";
import "./AnswerInput.css";

interface Props {
    type: AnswerType;
    value: AnswerVal;
    onChange: (val: AnswerVal) => void;
    disabled?: boolean;
    egeNumber?: number;
    // Per-element correctness feedback (for tasks 26/27 after check)
    // pair (26): boolean[] of length 2
    // table (27): boolean[][] shape 2x2
    feedback?: boolean[] | boolean[][] | null;
}

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

const parseTableString = (val: any, egeNumber?: number): (number | string)[][] => {
    let rows: (number | string)[][] = [];
    
    if (Array.isArray(val) && Array.isArray(val[0])) {
        rows = JSON.parse(JSON.stringify(val));
    } else if (typeof val === 'string' && val.trim()) {
        rows = val.trim().split('\n').map(row => 
            row.trim().split(/\s+/).map(cell => cell.trim())
        );
    }

    if (rows.length === 0) {
        if (egeNumber === 27) {
            rows = [["", ""], ["", ""]];
        } else {
            rows = [["", ""]];
        }
    }

    if (rows[0] && rows[0].length === 1) {
        rows = rows.map(r => [r[0], ""]);
    }

    if (egeNumber !== 27) {
        const lastRow = rows[rows.length - 1];
        const isLastRowNotEmpty = lastRow && lastRow.some(cell => String(cell).trim() !== "");
        if (isLastRowNotEmpty) {
            rows.push(new Array(lastRow.length).fill(""));
        }
    } else {
        while (rows.length < 2) rows.push(["", ""]);
    }

    return rows;
};

const stringifyTable = (arr: (number | string)[][]): string => {
    const trimmed = [...arr];
    while (trimmed.length > 1 && trimmed[trimmed.length - 1].every(cell => String(cell).trim() === "")) {
        trimmed.pop();
    }
    return trimmed.map(row => row.join(' ')).join('\n');
};

export default function AnswerInput({ type, value, onChange, disabled, egeNumber, feedback }: Props) {
    const formatValue = (v: any) => (v === null || v === undefined ? "" : String(v));

    // Tailwind classes for per-cell feedback color
    const cellCls = (ok: boolean | undefined) =>
        ok === true ? "!border-emerald-500 !bg-emerald-50 !text-emerald-700" :
        ok === false ? "!border-red-400 !bg-red-50 !text-red-700" : "";

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
        const tableData = useMemo(() => parseTableString(value, egeNumber), [value, egeNumber]);
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
                ))}
            </div>
        );
    }

    return null;
}
