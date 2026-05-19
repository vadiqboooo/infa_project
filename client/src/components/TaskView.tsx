import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import parse, { attributesToProps, domToReact } from "html-react-parser";
import type { HTMLReactParserOptions } from "html-react-parser";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Check, Eraser, Loader2, Minus, PenLine, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { authFetch } from "../api/client";
import type { TaskFile } from "../api/types";
import { useTheme } from "../context/ThemeContext";
import "./TaskView.css";

interface Props {
    content: string;
    title?: string;
    files?: TaskFile[];
    annotatable?: boolean;
    annotationKey?: string;
    annotationTaskId?: number;
    annotationPanelOpen?: boolean;
    onAnnotationPanelOpenChange?: (open: boolean) => void;
    showAnnotationToggle?: boolean;
    annotationToolbarHostId?: string;
}

type AnnotationTool = "none" | "pen" | "eraser";

type StrokePoint = {
    x: number;
    y: number;
};

type AnnotationStroke = {
    id: string;
    color: string;
    width: number;
    points: StrokePoint[];
};

type AnnotationRect = {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
};

const NOTE_COLORS = ["#ffffff", "#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
const NOTE_WIDTHS = [2, 4, 7, 11];

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
const INLINE_LATEX_CMD_RE = /\\(?:frac\s*(?:\{[^{}]+\}|[^\s{}])\s*(?:\{[^{}]+\}|[^\s{}])|sqrt\s*(?:\{[^{}]+\}|[^\s{}])|(?:sin|cos|tan|tg|log|ln|pi|alpha|beta|gamma|varphi|omega|leq|geq|neq|cdot|times|infty)(?![a-zA-Z])(?:\s*[A-Za-z0-9^_{}()+\-.,]+)?)/g;

// Добавляет пробел после LaTeX-команды, если следующий символ — буква/цифра
function fixConcatenatedCommands(formula: string): string {
    return formula.replace(
        /\\(lor|land|neg|lnot|equiv|rightarrow|leftarrow|leftrightarrow|oplus|forall|exists|leq|geq|neq|in|notin|subset|cup|cap|cdot|times|div|pm|overline|underline|hat|bar|vec|sqrt|frac)([a-zA-Z0-9])/g,
        "\\$1 $2"
    );
}

function normalizeLatexFractions(formula: string): string {
    return formula
        .replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])/g, "\\frac{$1}{$2}")
        .replace(/\\frac\s*([A-Za-z0-9])\s*\{([^{}]+)\}/g, "\\frac{$1}{$2}")
        .replace(/\\frac\s*\{([^{}]+)\}\s*([A-Za-z0-9])/g, "\\frac{$1}{$2}");
}

function normalizeBareRoots(html: string): string {
    return html.replace(
        /(\d*)\s*(?:√|&radic;|&#8730;|&#x221a;|&#x221A;|в€љ)\s*(\([^()]+\)|[A-Za-zА-Яа-яЁё0-9]+(?:[,.][0-9]+)?)/g,
        (_match, coefficient: string, radicand: string) => {
            const value = radicand.startsWith("(") && radicand.endsWith(")")
                ? radicand.slice(1, -1)
                : radicand;
            return `\\(${coefficient || ""}\\sqrt{${value}}\\)`;
        }
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

function renderBareInlineLatex(html: string): string {
    return html.replace(/(?<=>|^)([^<]+)(?=<|$)/gm, (textNode) => {
        if (!MATH_CMD_RE.test(textNode)) return textNode;
        MATH_CMD_RE.lastIndex = 0;

        return textNode.replace(INLINE_LATEX_CMD_RE, (formula) => {
            const normalized = normalizeLatexFractions(
                fixConcatenatedCommands(
                    decodeHtmlEntitiesInFormula(formula.trim())
                )
            );
            try {
                return katex.renderToString(normalized, { throwOnError: false, displayMode: false });
            } catch {
                return formula;
            }
        });
    });
}

function normalizeStackedFractions(html: string): string {
    const formula = String.raw`\\\[([\s\S]*?)\\\]`;
    const separator = String.raw`(?:<br\s*\/?>\s*)+(?:[._\-–—−]+\s*)`;
    const pattern = new RegExp(`${formula}${separator}(?:<br\\s*\\/?>\\s*)+${formula}`, "g");

    return html.replace(pattern, (_match, numerator, denominator) => {
        const top = normalizeLatexFractions(fixConcatenatedCommands(numerator.trim()));
        const bottom = normalizeLatexFractions(fixConcatenatedCommands(denominator.trim()));
        return `\\[\\frac{${top}}{${bottom}}\\]`;
    });
}

// Функция для рендеринга LaTeX-формул
function renderLatex(text: string): string {
    text = normalizeStackedFractions(text);
    text = normalizeBareRoots(text);

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
    text = renderBareInlineLatex(text);

    return text;
}

// Decode HTML entities that the parser may not handle automatically
function normalizeEntities(html: string): string {
    // 1. Un-double-encode: &amp;gt; → &gt; etc.
    let result = html.replace(/&amp;((?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, "&$1");
    // 2. &gt; → > is safe: a bare > in text content doesn't confuse the HTML parser
    //    &lt; is intentionally left encoded — decoding it to < before parse() would
    //    cause htmlparser2 to interpret it as a tag delimiter and break structure
    result = result.replace(/&gt;/g, ">");
    result = result.replace(/&lt;/g, "<");
    result = result.replace(/&nbsp;/g, "\u00A0");
    return result;
}

function pointsToPath(points: StrokePoint[]): string {
    if (points.length === 0) return "";
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function isNearStroke(stroke: AnnotationStroke, point: StrokePoint, radius: number): boolean {
    const threshold = radius + stroke.width;
    return stroke.points.some((strokePoint) => {
        const dx = strokePoint.x - point.x;
        const dy = strokePoint.y - point.y;
        return Math.hypot(dx, dy) <= threshold;
    });
}

function renderStrokesToPngBlob(strokes: AnnotationStroke[], size: { width: number; height: number }): Promise<Blob> {
    const width = Math.max(320, Math.ceil(size.width || 1));
    const height = Math.max(220, Math.ceil(size.height || 1));
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("Canvas is not supported"));

    ctx.scale(scale, scale);
    ctx.fillStyle = "#0b1724";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 40; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    strokes.forEach((stroke) => {
        if (stroke.points.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    });

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Не удалось подготовить изображение"));
        }, "image/png");
    });
}

function isSvgImageSrc(src?: string): boolean {
    if (!src) return false;
    return src.startsWith("data:image/svg+xml") || /\.svg(?:[?#].*)?$/i.test(src);
}

function decodeSvgDataUri(src: string): string | null {
    const commaIndex = src.indexOf(",");
    if (!src.startsWith("data:image/svg+xml") || commaIndex < 0) return null;
    const payload = src.slice(commaIndex + 1);
    try {
        return src.includes(";base64,")
            ? atob(payload)
            : decodeURIComponent(payload);
    } catch {
        return null;
    }
}

function encodeSvgDataUri(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function applySvgTheme(svg: string, theme: "dark" | "light"): string {
    const ink = theme === "dark" ? "#e5edf5" : "#13231b";
    const softInk = theme === "dark" ? "#94a3b8" : "#607064";
    const paper = theme === "dark" ? "#07111d" : "#ffffff";

    let themed = svg
        .replace(/(stroke=["'])(?:#000000|#000|black|rgb\(0,\s*0,\s*0\))(["'])/gi, `$1${ink}$2`)
        .replace(/(fill=["'])(?:#000000|#000|black|rgb\(0,\s*0,\s*0\))(["'])/gi, `$1${ink}$2`)
        .replace(/(stroke=["'])(?:#333333|#333|#444444|#444)(["'])/gi, `$1${softInk}$2`)
        .replace(/(fill=["'])(?:#333333|#333|#444444|#444)(["'])/gi, `$1${softInk}$2`)
        .replace(/(fill=["'])(?:#ffffff|#fff|white|rgb\(255,\s*255,\s*255\))(["'])/gi, `$1${paper}$2`);

    if (theme === "light") {
        themed = themed
            .replace(/(stroke=["'])(?:#e5edf5|#e2e8f0|#cbd5e1)(["'])/gi, `$1${ink}$2`)
            .replace(/(fill=["'])(?:#e5edf5|#e2e8f0|#cbd5e1)(["'])/gi, `$1${ink}$2`)
            .replace(/(stroke=["'])(?:#94a3b8|#64748b|#6b7280)(["'])/gi, `$1${softInk}$2`)
            .replace(/(fill=["'])(?:#94a3b8|#64748b|#6b7280)(["'])/gi, `$1${softInk}$2`)
            .replace(/(stroke=["'])rgba?\(\s*(?:226|229|203|148)\s*,\s*(?:232|237|213|163)\s*,\s*(?:240|245|225|184)(?:\s*,\s*[\d.]+)?\s*\)(["'])/gi, `$1${softInk}$2`)
            .replace(/(fill=["'])rgba?\(\s*(?:226|229|203|148)\s*,\s*(?:232|237|213|163)\s*,\s*(?:240|245|225|184)(?:\s*,\s*[\d.]+)?\s*\)(["'])/gi, `$1${softInk}$2`)
            .replace(/(stroke=["'])(?!(?:none|transparent)\2)[^"']+(["'])/gi, "$1#000000$2")
            .replace(/(style=["'][^"']*?stroke\s*:\s*)(?!none\b|transparent\b)[^;"']+/gi, "$1#000000")
            .replace(/(<text\b[^>]*\sfill=["'])(?!(?:none|transparent)\2)[^"']+(["'])/gi, "$1#000000$2")
            .replace(/(<text\b[^>]*\sstyle=["'][^"']*?fill\s*:\s*)(?!none\b|transparent\b)[^;"']+/gi, "$1#000000")
            .replace(/(<(?:tspan|textPath)\b[^>]*\sfill=["'])(?!(?:none|transparent)\2)[^"']+(["'])/gi, "$1#000000$2")
            .replace(/(<(?:tspan|textPath)\b[^>]*\sstyle=["'][^"']*?fill\s*:\s*)(?!none\b|transparent\b)[^;"']+/gi, "$1#000000");
    }

    return themed;
}

function themeSvgImageSrc(src: string | undefined, theme: "dark" | "light"): string | undefined {
    if (!src) return src;
    const svg = decodeSvgDataUri(src);
    if (!svg) return src;
    return encodeSvgDataUri(applySvgTheme(svg, theme));
}

function parseStyleAttribute(style?: string): React.CSSProperties {
    if (!style) return {};

    return style.split(";").reduce<React.CSSProperties>((styles, declaration) => {
        const [rawName, ...rawValue] = declaration.split(":");
        const value = rawValue.join(":").trim();
        if (!rawName || !value) return styles;

        const property = rawName.trim().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        return { ...styles, [property]: value };
    }, {});
}

function getSvgViewBoxSize(viewBox?: string): { width: number; height: number } | null {
    if (!viewBox) return null;
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length < 4 || parts.some((part) => !Number.isFinite(part))) return null;
    return { width: Math.max(1, parts[2]), height: Math.max(1, parts[3]) };
}

function hasAncestorClass(node: any, className: string): boolean {
    let current = node?.parent;
    while (current) {
        const classes = String(current.attribs?.class ?? "").split(/\s+/);
        if (classes.includes(className)) return true;
        current = current.parent;
    }
    return false;
}

function InlineTaskSvg({
    attribs,
    children,
}: {
    attribs: Record<string, string>;
    children: React.ReactNode;
}) {
    const props = attributesToProps(attribs) as React.SVGProps<SVGSVGElement>;
    const viewBox = props.viewBox ?? attribs.viewbox ?? attribs.viewBox;
    const viewBoxSize = getSvgViewBoxSize(viewBox);
    const style = props.style && typeof props.style === "object" ? props.style : {};
    const width = props.width ?? style.width ?? (viewBoxSize ? `${Math.min(viewBoxSize.width, 760)}px` : undefined);

    return (
        <svg
            {...props}
            viewBox={viewBox}
            className={`task-inline-svg ${props.className ?? ""}`.trim()}
            style={{
                ...style,
                width,
                maxWidth: "100%",
                height: "auto",
            }}
        >
            {children}
        </svg>
    );
}

function toAnnotationRect(rect: DOMRect, planeRect: DOMRect): AnnotationRect {
    const left = rect.left - planeRect.left;
    const top = rect.top - planeRect.top;
    return {
        left,
        top,
        width: rect.width,
        height: rect.height,
        right: left + rect.width,
        bottom: top + rect.height,
    };
}

function SvgZoomImage({
    attribs,
    theme,
    getPlaneRect,
    onZoomChange,
}: {
    attribs: Record<string, string>;
    theme: "dark" | "light";
    getPlaneRect: () => DOMRect | null;
    onZoomChange: (oldRect: AnnotationRect, newRect: AnnotationRect) => void;
}) {
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [baseWidth, setBaseWidth] = useState<number | null>(null);
    const pendingZoomRectRef = useRef<AnnotationRect | null>(null);
    const imageStyle = parseStyleAttribute(attribs.style);

    const rememberBaseWidth = () => {
        if (!imageRef.current || baseWidth) return;
        const rect = imageRef.current.getBoundingClientRect();
        if (rect.width > 0) setBaseWidth(rect.width);
    };

    const nextWidth = baseWidth
        ? `${Math.round(baseWidth * zoom)}px`
        : imageStyle.width ?? (attribs.width ? `${Number(attribs.width) || attribs.width}px` : undefined);

    const measureImageRect = () => {
        const image = imageRef.current;
        const planeRect = getPlaneRect();
        if (!image || !planeRect) return null;

        const rect = image.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        return toAnnotationRect(rect, planeRect);
    };

    const changeZoom = (delta: number) => {
        const oldRect = measureImageRect();
        const nextZoom = Math.max(0.6, Math.min(2.5, Number((zoom + delta).toFixed(2))));
        if (nextZoom === zoom) return;

        pendingZoomRectRef.current = oldRect;
        setZoom(nextZoom);
    };

    useEffect(() => {
        const oldRect = pendingZoomRectRef.current;
        if (!oldRect) return;

        const frameId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const newRect = measureImageRect();
                if (newRect) onZoomChange(oldRect, newRect);
                pendingZoomRectRef.current = null;
            });
        });

        return () => cancelAnimationFrame(frameId);
    }, [zoom, onZoomChange]);

    return (
        <span className="task-svg-zoom-wrap">
            <span className="task-svg-zoom-controls">
                <button
                    type="button"
                    onClick={() => changeZoom(-0.1)}
                    title="Уменьшить SVG"
                >
                    <Minus size={14} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                    type="button"
                    onClick={() => changeZoom(0.1)}
                    title="Увеличить SVG"
                >
                    <Plus size={14} />
                </button>
            </span>
            <img
                src={themeSvgImageSrc(attribs.src, theme)}
                alt={attribs.alt ?? ""}
                title={attribs.title}
                decoding="async"
                ref={imageRef}
                onLoad={() => {
                    rememberBaseWidth();
                }}
                style={{
                    ...imageStyle,
                    width: nextWidth,
                    maxWidth: "none",
                }}
            />
        </span>
    );
}

export default function TaskView({
    content,
    title,
    files,
    annotatable = false,
    annotationKey,
    annotationTaskId,
    annotationPanelOpen,
    onAnnotationPanelOpenChange,
    showAnnotationToggle = true,
    annotationToolbarHostId,
}: Props) {
    const { theme } = useTheme();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const planeRef = useRef<HTMLDivElement | null>(null);
    const [tool, setTool] = useState<AnnotationTool>("none");
    const [color, setColor] = useState("#ef4444");
    const [width, setWidth] = useState(4);
    const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
    const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
    const [activeStrokeId, setActiveStrokeId] = useState<string | null>(null);
    const [activeStrokeStart, setActiveStrokeStart] = useState<StrokePoint | null>(null);
    const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
    const [internalAnnotationPanelOpen, setInternalAnnotationPanelOpen] = useState(false);
    const [savingDrawing, setSavingDrawing] = useState(false);
    const [drawingSaved, setDrawingSaved] = useState(false);
    const [drawingSaveError, setDrawingSaveError] = useState<string | null>(null);
    const [annotationToolbarHost, setAnnotationToolbarHost] = useState<HTMLElement | null>(null);

    const getPlaneRect = useCallback(() => {
        return planeRef.current?.getBoundingClientRect() ?? null;
    }, []);

    const panelOpen = annotationPanelOpen ?? internalAnnotationPanelOpen;
    const drawingSize = useMemo(() => ({
        width: contentSize.width,
        height: panelOpen ? Math.max(contentSize.height + 640, 760) : contentSize.height,
    }), [contentSize.height, contentSize.width, panelOpen]);

    const setPanelOpen = useCallback((open: boolean) => {
        if (!open) setTool("none");
        if (onAnnotationPanelOpenChange) {
            onAnnotationPanelOpenChange(open);
        } else {
            setInternalAnnotationPanelOpen(open);
        }
    }, [onAnnotationPanelOpenChange]);

    useEffect(() => {
        if (!annotationToolbarHostId) {
            setAnnotationToolbarHost(null);
            return;
        }
        setAnnotationToolbarHost(document.getElementById(annotationToolbarHostId));
    }, [annotationToolbarHostId, panelOpen]);

    const handleSvgZoomChange = useCallback((oldRect: AnnotationRect, newRect: AnnotationRect) => {
        const scaleX = newRect.width / oldRect.width;
        const scaleY = newRect.height / oldRect.height;
        const heightDelta = newRect.height - oldRect.height;

        const transformPoint = (point: StrokePoint): StrokePoint => {
            const pointInsideSvg =
                point.x >= oldRect.left &&
                point.x <= oldRect.right &&
                point.y >= oldRect.top &&
                point.y <= oldRect.bottom;

            if (pointInsideSvg) {
                return {
                    x: newRect.left + (point.x - oldRect.left) * scaleX,
                    y: newRect.top + (point.y - oldRect.top) * scaleY,
                };
            }

            if (point.y > oldRect.bottom) {
                return {
                    x: point.x,
                    y: point.y + heightDelta,
                };
            }

            return point;
        };

        setStrokes((current) => current.map((stroke) => ({
            ...stroke,
            points: stroke.points.map(transformPoint),
        })));
        setActiveStrokeStart((point) => point ? transformPoint(point) : null);
    }, []);

    const parseOptions = useMemo<HTMLReactParserOptions>(() => {
        const options: HTMLReactParserOptions = {
            replace: (domNode) => {
            const node = domNode as any;
            if (node.type !== "tag") {
                return undefined;
            }

            if (node.name === "svg" && !hasAncestorClass(node, "katex")) {
                return (
                    <InlineTaskSvg attribs={node.attribs ?? {}}>
                        {domToReact(node.children ?? [], options)}
                    </InlineTaskSvg>
                );
            }

            if (!annotatable || node.name !== "img" || !isSvgImageSrc(node.attribs?.src)) {
                if (node.name === "img" && isSvgImageSrc(node.attribs?.src)) {
                    const props = attributesToProps(node.attribs ?? {}) as React.ImgHTMLAttributes<HTMLImageElement>;
                    return <img {...props} src={themeSvgImageSrc(node.attribs?.src, theme)} />;
                }
                return undefined;
            }

            return (
                <SvgZoomImage
                    attribs={node.attribs}
                    theme={theme}
                    getPlaneRect={getPlaneRect}
                    onZoomChange={handleSvgZoomChange}
                />
            );
            },
        };

        return options;
    }, [annotatable, getPlaneRect, handleSvgZoomChange, theme]);

    const parsedContent = useMemo(() => {
        const processedContent = renderLatex(normalizeEntities(content));
        return parse(processedContent, parseOptions);
    }, [content, parseOptions]);

    const storageKey = annotationKey ? `task-annotations:${annotationKey}` : "";

    useEffect(() => {
        setAnnotationsLoaded(false);

        if (!annotatable || !storageKey) {
            setStrokes([]);
            return;
        }

        try {
            const raw = localStorage.getItem(storageKey);
            setStrokes(raw ? JSON.parse(raw) : []);
        } catch {
            setStrokes([]);
        }
        setAnnotationsLoaded(true);
    }, [annotatable, storageKey]);

    useEffect(() => {
        if (!annotatable || !storageKey || !annotationsLoaded) return;
        localStorage.setItem(storageKey, JSON.stringify(strokes));
    }, [annotatable, annotationsLoaded, storageKey, strokes]);

    useEffect(() => {
        if (!annotatable || !contentRef.current) return;

        const element = contentRef.current;
        const updateSize = () => {
            setContentSize({
                width: Math.max(1, element.scrollWidth),
                height: Math.max(1, element.scrollHeight),
            });
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(element);
        window.addEventListener("resize", updateSize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateSize);
        };
    }, [annotatable, content, files?.length]);

    useEffect(() => {
        if (!annotatable) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isEditingText = target?.closest("input, textarea, [contenteditable='true']");
            if (isEditingText) return;

            if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ") {
                event.preventDefault();
                setStrokes((current) => current.slice(0, -1));
                setActiveStrokeId(null);
                setActiveStrokeStart(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [annotatable]);

    const getPointerPoint = (event: React.PointerEvent<SVGSVGElement>): StrokePoint | null => {
        const plane = planeRef.current;
        if (!plane) return null;

        const rect = plane.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(drawingSize.width, event.clientX - rect.left)),
            y: Math.max(0, Math.min(drawingSize.height, event.clientY - rect.top)),
        };
    };

    const eraseAtPoint = (point: StrokePoint) => {
        setStrokes((current) => current.filter((stroke) => !isNearStroke(stroke, point, 12)));
    };

    const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
        if (tool === "none") return;

        const point = getPointerPoint(event);
        if (!point) return;

        event.currentTarget.setPointerCapture(event.pointerId);

        if (tool === "eraser") {
            eraseAtPoint(point);
            return;
        }

        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setActiveStrokeId(id);
        setActiveStrokeStart(point);
        setStrokes((current) => [...current, { id, color, width, points: [point] }]);
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        if (tool === "none") return;

        const point = getPointerPoint(event);
        if (!point) return;

        if (tool === "eraser") {
            if (event.buttons === 1) eraseAtPoint(point);
            return;
        }

        if (!activeStrokeId || event.buttons !== 1) return;
        setStrokes((current) => current.map((stroke) => (
            stroke.id === activeStrokeId
                ? { ...stroke, points: event.shiftKey && activeStrokeStart ? [activeStrokeStart, point] : [...stroke.points, point] }
                : stroke
        )));
    };

    const stopDrawing = () => {
        setActiveStrokeId(null);
        setActiveStrokeStart(null);
    };

    const saveDrawingSolution = async () => {
        if (!annotationTaskId) {
            setDrawingSaveError("Не найден id задания для сохранения");
            return;
        }
        if (strokes.length === 0) {
            setDrawingSaveError("Сначала сделайте пометки");
            return;
        }

        setSavingDrawing(true);
        setDrawingSaved(false);
        setDrawingSaveError(null);
        try {
            const blob = await renderStrokesToPngBlob(strokes, drawingSize);
            const form = new FormData();
            form.append("file", blob, `task-${annotationTaskId}-drawing.png`);
            const response = await authFetch(`/api/tasks/${annotationTaskId}/solution/upload/image`, {
                method: "POST",
                body: form,
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: "Не удалось сохранить решение" }));
                throw new Error(error.detail || "Не удалось сохранить решение");
            }
            setDrawingSaved(true);
        } catch (error) {
            setDrawingSaveError(error instanceof Error ? error.message : "Не удалось сохранить решение");
        } finally {
            setSavingDrawing(false);
        }
    };

    const body = (
        <div ref={contentRef} className="task-body">
            {parsedContent}
        </div>
    );

    const annotationToolbar = panelOpen ? (
        <div
            className={`task-annotation-toolbar ${annotationToolbarHost ? "in-header" : ""}`}
            aria-label="Панель заметок"
        >
            <button
                type="button"
                className={tool === "pen" ? "active" : ""}
                onClick={() => setTool((current) => current === "pen" ? "none" : "pen")}
                title="Карандаш"
            >
                <PenLine size={16} />
            </button>
            <button
                type="button"
                className={tool === "eraser" ? "active" : ""}
                onClick={() => setTool((current) => current === "eraser" ? "none" : "eraser")}
                title="Ластик"
            >
                <Eraser size={16} />
            </button>
            <span className="task-annotation-divider" />
            <div className="task-annotation-swatches" aria-label="Цвет">
                {NOTE_COLORS.map((noteColor) => (
                    <button
                        key={noteColor}
                        type="button"
                        className={color === noteColor ? "active" : ""}
                        style={{ backgroundColor: noteColor }}
                        onClick={() => setColor(noteColor)}
                        title={noteColor}
                    />
                ))}
            </div>
            <div className="task-annotation-widths" aria-label="Размер">
                {NOTE_WIDTHS.map((noteWidth) => (
                    <button
                        key={noteWidth}
                        type="button"
                        className={width === noteWidth ? "active" : ""}
                        onClick={() => setWidth(noteWidth)}
                        title={`${noteWidth}px`}
                    >
                        <span style={{ width: noteWidth * 2, height: noteWidth }} />
                    </button>
                ))}
            </div>
            <span className="task-annotation-divider" />
            <button
                type="button"
                onClick={() => setStrokes((current) => current.slice(0, -1))}
                disabled={strokes.length === 0}
                title="Отменить"
            >
                <RotateCcw size={16} />
            </button>
            <button
                type="button"
                onClick={() => setStrokes([])}
                disabled={strokes.length === 0}
                title="Очистить"
            >
                <Trash2 size={16} />
            </button>
            <button
                type="button"
                onClick={saveDrawingSolution}
                disabled={savingDrawing || strokes.length === 0 || !annotationTaskId}
                title="Сохранить решение"
            >
                {savingDrawing ? (
                    <Loader2 size={16} className="task-annotation-spin" />
                ) : drawingSaved ? (
                    <Check size={16} />
                ) : (
                    <Save size={16} />
                )}
            </button>
            <button
                type="button"
                onClick={() => setPanelOpen(false)}
                title="Скрыть черновик"
            >
                <X size={16} />
            </button>
            {!showAnnotationToggle && drawingSaved && (
                <span className="task-annotation-status"><Check size={14} /> Сохранено</span>
            )}
            {!showAnnotationToggle && drawingSaveError && (
                <span className="task-annotation-error">{drawingSaveError}</span>
            )}
        </div>
    ) : null;

    return (
        <div className="task-view fade-in">
            {title && <h1 className="task-title">{title}</h1>}
            {annotatable ? (
                <div className="task-annotator">
                    {annotationToolbarHost && annotationToolbar ? createPortal(annotationToolbar, annotationToolbarHost) : null}
                    {showAnnotationToggle && (
                        <div className="task-annotation-actions">
                            <button
                                type="button"
                                className={`task-annotation-toggle ${panelOpen ? "active" : ""}`}
                                onClick={() => setPanelOpen(!panelOpen)}
                            >
                                <PenLine size={16} />
                                {panelOpen ? "Скрыть черновик" : "Открыть черновик"}
                            </button>
                            {drawingSaved && <span className="task-annotation-status"><Check size={14} /> Сохранено</span>}
                            {drawingSaveError && <span className="task-annotation-error">{drawingSaveError}</span>}
                        </div>
                    )}
                    {!annotationToolbarHostId && !annotationToolbarHost && annotationToolbar}
                    <div
                        className="task-annotation-canvas"
                        style={{
                            width: drawingSize.width ? `${drawingSize.width}px` : undefined,
                            minHeight: drawingSize.height ? `${drawingSize.height}px` : undefined,
                        }}
                    >
                        <div
                            ref={planeRef}
                            className="task-annotation-plane"
                            style={{
                                width: drawingSize.width ? `${drawingSize.width}px` : "100%",
                                minHeight: drawingSize.height ? `${drawingSize.height}px` : undefined,
                            }}
                        >
                            {body}
                            <svg
                                className={`task-annotation-layer ${panelOpen && tool !== "none" ? "drawing" : ""}`}
                                width={drawingSize.width || 1}
                                height={drawingSize.height || 1}
                                viewBox={`0 0 ${drawingSize.width || 1} ${drawingSize.height || 1}`}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={stopDrawing}
                                onPointerCancel={stopDrawing}
                                onPointerLeave={stopDrawing}
                            >
                                {strokes.map((stroke) => (
                                    <path
                                        key={stroke.id}
                                        d={pointsToPath(stroke.points)}
                                        fill="none"
                                        stroke={stroke.color}
                                        strokeWidth={stroke.width}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                ))}
                            </svg>
                        </div>
                    </div>
                </div>
            ) : body}
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
