import React, { useState, useEffect } from "react";
import type { AnswerType, AnswerVal } from "../api/types";
import "./AnswerInput.css";

interface Props {
    type: AnswerType;
    value: AnswerVal;
    onChange: (val: AnswerVal) => void;
    disabled?: boolean;
}

export default function AnswerInput({ type, value, onChange, disabled }: Props) {
    // Handle text
    if (type === "text") {
        return (
            <input
                type="text"
                className="input answer-input-single"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="Введите ответ"
            />
        );
    }

    // Handle single_number
    if (type === "single_number") {
        return (
            <input
                type="number"
                className="input answer-input-single"
                value={typeof value === "number" ? value : ""}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                disabled={disabled}
                placeholder="Введите число"
            />
        );
    }

    // Handle pair
    if (type === "pair") {
        const val = Array.isArray(value) && !Array.isArray(value[0]) ? (value as number[]) : [0, 0];
        return (
            <div className="pair-inputs">
                <input
                    type="number"
                    className="input"
                    value={val[0] ?? ""}
                    onChange={(e) => onChange([parseFloat(e.target.value), val[1]])}
                    disabled={disabled}
                    placeholder="X"
                />
                <input
                    type="number"
                    className="input"
                    value={val[1] ?? ""}
                    onChange={(e) => onChange([val[0], parseFloat(e.target.value)])}
                    disabled={disabled}
                    placeholder="Y"
                />
            </div>
        );
    }

    // Handle table
    if (type === "table") {
        const val = Array.isArray(value) && Array.isArray(value[0]) ? (value as number[][]) : [[0, 0], [0, 0]];
        return (
            <div
                className="table-grid"
                style={{ gridTemplateColumns: `repeat(${val[0].length}, 1fr)` }}
            >
                {val.map((row, rIdx) =>
                    row.map((cell, cIdx) => (
                        <input
                            key={`${rIdx}-${cIdx}`}
                            type="number"
                            className="input table-input"
                            value={cell ?? ""}
                            onChange={(e) => {
                                const newVal = val.map((r, ri) =>
                                    r.map((c, ci) => (ri === rIdx && ci === cIdx ? parseFloat(e.target.value) : c))
                                );
                                onChange(newVal);
                            }}
                            disabled={disabled}
                            placeholder="0"
                        />
                    ))
                )}
            </div>
        );
    }

    return null;
}
