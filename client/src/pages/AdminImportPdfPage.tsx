import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Upload, FileText, AlertCircle, Loader2,
    CheckCircle2, ImagePlus, Trash2, Plus, Eye, EyeOff,
    Cpu, Zap, Copy, PanelLeftOpen, PanelLeftClose,
    Paperclip, X, Scissors, MousePointerClick,
} from 'lucide-react';
import { clsx } from 'clsx';

const API_BASE = '/api';

function apiFetch<T>(path: string, apiKey: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('jwt_token');
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, { ...options, headers }).then(async (res) => {
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || 'Ошибка запроса');
        }
        return res.json();
    });
}

type TopicCategory = 'tutorial' | 'homework' | 'control' | 'variants' | 'mock';

interface TaskFile {
    url: string;
    name: string;
}

interface ParsedSubTask {
    number: number | null;
    content_html: string;
    answer_type: string;
    correct_answer: unknown;
    table?: { cols: number; rows: number } | null;
}

interface ParsedTask {
    index: number;
    ege_number: number | null;
    title: string;
    content_html: string;
    answer_type: string;
    correct_answer: unknown;
    images: string[];
    files: TaskFile[];
    sub_tasks: ParsedSubTask[];
}

// Predefined options for the EGE number selector
const EGE_NUMBER_OPTIONS: { value: string; label: string; isComposite?: boolean }[] = [
    ...Array.from({ length: 27 }, (_, i) => ({ value: String(i + 1), label: `№${i + 1}` })),
    { value: '19-21', label: '№19-21 (теория игр)', isComposite: true },
];

const ANSWER_TYPES = [
    { value: 'single_number', label: 'Одно число' },
    { value: 'pair', label: 'Пара чисел' },
    { value: 'table', label: 'Таблица' },
    { value: 'text', label: 'Текст' },
];

// Format the stored correct_answer ({val: x} or x) into a human-editable string
function formatAnswerForInput(correct: any): string {
    if (correct == null) return '';
    const val = (typeof correct === 'object' && correct !== null && 'val' in correct) ? correct.val : correct;
    if (val == null) return '';
    if (typeof val === 'number' || typeof val === 'string') return String(val);
    if (Array.isArray(val)) {
        if (val.length > 0 && Array.isArray(val[0])) {
            return val.map((row: any[]) => row.join(' ')).join('\n');
        }
        return val.join(' ');
    }
    return '';
}

// Parse user input back into stored shape {val: ...} based on answer_type
function parseAnswerInput(text: string, answerType: string): any | null {
    if (!text || !text.trim()) return null;
    const trimmed = text.trim();
    if (answerType === 'text') return { val: trimmed };
    if (answerType === 'single_number') {
        const n = parseFloat(trimmed.replace(',', '.'));
        return isNaN(n) ? { val: trimmed } : { val: n };
    }
    if (answerType === 'pair') {
        const parts = trimmed.split(/\s+/).map(p => {
            const n = parseFloat(p.replace(',', '.'));
            return isNaN(n) ? p : n;
        });
        return { val: parts };
    }
    if (answerType === 'table') {
        const rows = trimmed.split('\n').map(row =>
            row.trim().split(/\s+/).map(p => {
                const n = parseFloat(p.replace(',', '.'));
                return isNaN(n) ? p : n;
            })
        );
        return { val: rows };
    }
    return { val: trimmed };
}

const CATEGORIES: { value: TopicCategory; label: string }[] = [
    { value: 'variants', label: 'Вариант ЕГЭ' },
    { value: 'control', label: 'Контрольная работа' },
    { value: 'mock', label: 'Пробник' },
    { value: 'tutorial', label: 'Разбор заданий' },
    { value: 'homework', label: 'Домашняя работа' },
];

interface AdminImportPdfPageProps {
    apiKey: string;
}

export default function AdminImportPdfPage({ apiKey }: AdminImportPdfPageProps) {
    const navigate = useNavigate();
    const location = useLocation();
    // Optional initial state from another import flow (e.g. kompege preview)
    const initial = (location.state ?? null) as null | {
        source?: 'kompege';
        tasks?: ParsedTask[];
        topic_title?: string;
        category?: TopicCategory;
        time_limit_minutes?: number;
        is_mock?: boolean;
        ege_number?: number | null;
        ege_number_end?: number | null;
    };

    // ── Upload step state ─────────────────────────────────────
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [topicTitle, setTopicTitle] = useState(initial?.topic_title ?? '');
    const [category, setCategory] = useState<TopicCategory>(initial?.category ?? 'variants');
    const [isMock, setIsMock] = useState(initial?.is_mock ?? false);
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(initial?.time_limit_minutes ?? 235);
    const [topicEgeNumber, setTopicEgeNumber] = useState<number | null>(initial?.ege_number ?? null);
    const [topicEgeNumberEnd, setTopicEgeNumberEnd] = useState<number | null>(initial?.ege_number_end ?? null);
    const [parseMode, setParseMode] = useState<'auto' | 'llm' | 'manual'>('auto');

    // ── App state ─────────────────────────────────────────────
    const [step, setStep] = useState<'upload' | 'annotate' | 'review' | 'done'>(initial?.tasks?.length ? 'review' : 'upload');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Annotate step state ───────────────────────────────────
    const [annotatedText, setAnnotatedText] = useState('');
    const [nextTaskNum, setNextTaskNum] = useState(1);
    const annotateRef = useRef<HTMLTextAreaElement>(null);

    // ── Review step state ─────────────────────────────────────
    const [tasks, setTasks] = useState<ParsedTask[]>(() =>
        (initial?.tasks ?? []).map((t, i) => ({
            index: i,
            ege_number: t.ege_number ?? null,
            title: t.title ?? '',
            content_html: t.content_html ?? '',
            answer_type: t.answer_type ?? 'single_number',
            correct_answer: t.correct_answer ?? null,
            images: t.images ?? [],
            files: t.files ?? [],
            sub_tasks: t.sub_tasks ?? [],
        })),
    );
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [previewMode, setPreviewMode] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const fileAttachRef = useRef<HTMLInputElement>(null);
    const [fullText, setFullText] = useState('');
    const [showFullText, setShowFullText] = useState(false);

    // ── Handlers ──────────────────────────────────────────────
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f?.type === 'application/pdf') { setPdfFile(f); setError(null); }
        else setError('Пожалуйста, загрузите PDF файл');
    }, []);

    const handleParse = async () => {
        if (!pdfFile) { setError('Выберите PDF файл'); return; }
        if (!topicTitle.trim()) { setError('Введите название топика'); return; }
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('jwt_token');
            const headers: Record<string, string> = { 'X-API-Key': apiKey };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const fd = new FormData();
            fd.append('file', pdfFile);
            fd.append('use_llm', parseMode === 'llm' ? 'true' : 'false');
            const res = await fetch(`${API_BASE}/admin/import-pdf/parse`, { method: 'POST', headers, body: fd });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Ошибка разбора');
            }
            const data: { tasks: ParsedTask[]; page_count: number; full_text?: string } = await res.json();
            const text = data.full_text || '';
            setFullText(text);

            if (parseMode === 'manual') {
                // Go to annotation step: show raw text, let user place markers
                setAnnotatedText(text);
                setNextTaskNum(1);
                setStep('annotate');
                return;
            }

            if (!data.tasks?.length) {
                // Auto-parse found nothing → fall back to annotation mode
                setAnnotatedText(text);
                setNextTaskNum(1);
                setStep('annotate');
            } else {
                setTasks(data.tasks.map(t => ({
                    ...t,
                    title: (t as any).title ?? '',
                    files: t.files ?? [],
                    sub_tasks: (t as any).sub_tasks ?? [],
                })));
                setSelectedIdx(0);
                setStep('review');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Marker format: === Задание N ===
    const MARKER_RE = /^===\s*Задание\s*(\d+)\s*===/m;

    const insertMarker = () => {
        const ta = annotateRef.current;
        if (!ta) return;
        const marker = `\n=== Задание ${nextTaskNum} ===\n`;
        const start = ta.selectionStart;
        const before = annotatedText.slice(0, start);
        const after = annotatedText.slice(start);
        const newText = before + marker + after;
        setAnnotatedText(newText);
        setNextTaskNum(n => n + 1);
        // Restore cursor after the inserted marker
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + marker.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    const countMarkers = () => {
        return (annotatedText.match(/^===\s*Задание\s*\d+\s*===/gm) || []).length;
    };

    const handleSplitByMarkers = () => {
        const textToHtml = (text: string) => {
            const escaped = text
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const paragraphs = escaped.split(/\n{2,}/);
            return paragraphs
                .map(p => p.trim())
                .filter(Boolean)
                .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                .join('\n') || `<p>${escaped}</p>`;
        };

        // Split on marker lines: === Задание N ===
        const parts = annotatedText.split(/^===\s*Задание\s*(\d+)\s*===\s*$/m);
        // parts = [before-first, num, content, num, content, ...]
        const result: ParsedTask[] = [];
        for (let i = 1; i < parts.length; i += 2) {
            const num = parseInt(parts[i]);
            const content = (parts[i + 1] ?? '').trim();
            // Strip trailing "Ответ:" from content
            const cutIdx = content.search(/^\s*Ответ\s*[:.]/im);
            const body = cutIdx >= 0 ? content.slice(0, cutIdx).trim() : content;
            if (body) {
                result.push({
                    index: result.length,
                    ege_number: isNaN(num) ? null : num,
                    title: '',
                    content_html: textToHtml(body),
                    answer_type: 'single_number',
                    correct_answer: null,
                    images: [],
                    files: [],
                    sub_tasks: [],
                });
            }
        }
        if (!result.length) {
            setError('Маркеры не найдены. Вставьте хотя бы один маркер задания.');
            return;
        }
        setTasks(result);
        setSelectedIdx(0);
        setStep('review');
    };

    const updateTask = (idx: number, patch: Partial<ParsedTask>) => {
        setTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
    };

    const removeTask = (idx: number) => {
        setTasks(prev => {
            const next = prev.filter((_, i) => i !== idx);
            setSelectedIdx(Math.min(idx, next.length - 1));
            return next;
        });
    };

    const addTask = () => {
        setTasks(prev => [...prev, {
            index: prev.length, ege_number: null, title: '', content_html: '',
            answer_type: 'single_number', correct_answer: null, images: [], files: [], sub_tasks: [],
        }]);
        setSelectedIdx(tasks.length);
    };

    const createEmptyTasks = (count: number) => {
        setTasks(Array.from({ length: count }, (_, i) => ({
            index: i, ege_number: i + 1, title: '', content_html: '',
            answer_type: 'single_number' as const, correct_answer: null, images: [], files: [], sub_tasks: [],
        })));
        setSelectedIdx(0);
    };

    const updateSubTask = (taskIdx: number, subIdx: number, patch: Partial<ParsedSubTask>) => {
        setTasks(prev => prev.map((t, i) => {
            if (i !== taskIdx) return t;
            return {
                ...t,
                sub_tasks: t.sub_tasks.map((s, si) => si === subIdx ? { ...s, ...patch } : s),
            };
        }));
    };

    // When EGE number changes, auto-create/clear sub_tasks for composite (e.g. 19-21)
    const setEgeNumber = (taskIdx: number, value: string) => {
        const opt = EGE_NUMBER_OPTIONS.find(o => o.value === value);
        if (opt?.isComposite && value === '19-21') {
            setTasks(prev => prev.map((t, i) => {
                if (i !== taskIdx) return t;
                // Only create sub_tasks if not already composite
                const existingSubs = t.sub_tasks || [];
                const sub_tasks: ParsedSubTask[] = existingSubs.length >= 2
                    ? existingSubs
                    : [
                        { number: 20, content_html: '', answer_type: 'single_number', correct_answer: null },
                        { number: 21, content_html: '', answer_type: 'single_number', correct_answer: null },
                    ];
                return { ...t, ege_number: 19, sub_tasks };
            }));
        } else {
            const num = value ? parseInt(value) : null;
            updateTask(taskIdx, { ege_number: num, sub_tasks: [] });
        }
    };

    const getEgeValue = (t: ParsedTask): string => {
        if (t.sub_tasks && t.sub_tasks.length >= 2 && t.ege_number === 19) return '19-21';
        return t.ege_number != null ? String(t.ege_number) : '';
    };

    const getEgeDisplay = (t: ParsedTask): string | null => {
        if (t.sub_tasks && t.sub_tasks.length > 0) {
            const nums = [t.ege_number, ...t.sub_tasks.map(s => s.number)].filter((n): n is number => typeof n === 'number');
            if (nums.length >= 2) return `${Math.min(...nums)}–${Math.max(...nums)}`;
        }
        return t.ege_number != null ? String(t.ege_number) : null;
    };

    const uploadImageFile = async (file: File) => {
        setUploadingImage(true);
        try {
            const token = localStorage.getItem('jwt_token');
            const headers: Record<string, string> = { 'X-API-Key': apiKey };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${API_BASE}/admin/import-pdf/upload-image`, { method: 'POST', headers, body: fd });
            if (!res.ok) throw new Error('Ошибка загрузки');
            const data: { url: string } = await res.json();
            updateTask(selectedIdx, { images: [...(tasks[selectedIdx]?.images ?? []), data.url] });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        await uploadImageFile(f);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    useEffect(() => {
        if (step !== 'review') return;
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) uploadImageFile(file);
                    return;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [step, selectedIdx, tasks]);

    const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setUploadingFile(true);
        try {
            const token = localStorage.getItem('jwt_token');
            const headers: Record<string, string> = { 'X-API-Key': apiKey };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const fd = new FormData();
            fd.append('file', f);
            const res = await fetch(`${API_BASE}/admin/import-pdf/upload-file`, { method: 'POST', headers, body: fd });
            if (!res.ok) throw new Error('Ошибка загрузки файла');
            const data: { url: string; name: string } = await res.json();
            updateTask(selectedIdx, { files: [...(tasks[selectedIdx]?.files ?? []), data] });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploadingFile(false);
            if (fileAttachRef.current) fileAttachRef.current.value = '';
        }
    };

    const removeFile = (taskIdx: number, fileIdx: number) => {
        updateTask(taskIdx, { files: tasks[taskIdx].files.filter((_, i) => i !== fileIdx) });
    };

    const handleConfirm = async () => {
        if (!tasks.length) { setError('Нет заданий для сохранения'); return; }
        setLoading(true);
        setError(null);
        try {
            await apiFetch('/admin/import-pdf/confirm', apiKey, {
                method: 'POST',
                body: JSON.stringify({
                    topic_title: topicTitle.trim(),
                    category, is_mock: isMock,
                    time_limit_minutes: timeLimitMinutes,
                    ege_number: topicEgeNumber,
                    ege_number_end: topicEgeNumberEnd,
                    tasks: tasks.map(t => ({
                        ege_number: t.ege_number,
                        title: t.title || null,
                        content_html: t.content_html,
                        answer_type: t.answer_type,
                        correct_answer: t.correct_answer ?? null,
                        images: t.images,
                        files: t.files,
                        sub_tasks: t.sub_tasks ?? [],
                    })),
                }),
            });
            setStep('done');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const currentTask = tasks[selectedIdx];

    // ── Upload step ───────────────────────────────────────────
    if (step === 'upload') {
        return (
            <div className="min-h-full bg-[#F8F7F4] flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                            <FileText size={16} className="text-orange-600" />
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 text-sm">Импорт из PDF</h1>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Шаг 1 — Настройки и загрузка</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex items-start justify-center p-8">
                    <div className="w-full max-w-2xl space-y-6">
                        {/* Dropzone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={clsx(
                                'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
                                dragOver ? 'border-orange-400 bg-orange-50' :
                                    pdfFile ? 'border-green-400 bg-green-50' :
                                        'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30',
                            )}
                        >
                            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setError(null); } }} />
                            {pdfFile ? (
                                <div className="flex flex-col items-center gap-3">
                                    <CheckCircle2 size={40} className="text-green-500" />
                                    <p className="font-bold text-gray-900 text-lg">{pdfFile.name}</p>
                                    <p className="text-sm text-gray-400">{(pdfFile.size / 1024).toFixed(0)} KB — нажмите чтобы заменить</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <Upload size={40} className="text-gray-300" />
                                    <p className="font-semibold text-gray-600 text-lg">Перетащите PDF или нажмите для выбора</p>
                                    <p className="text-sm text-gray-400">Поддерживаются текстовые PDF (Статград, ФИПИ, варианты ЕГЭ)</p>
                                </div>
                            )}
                        </div>

                        {/* Settings */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
                            <h2 className="font-bold text-gray-900">Настройки топика</h2>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Название *</label>
                                <input
                                    type="text"
                                    value={topicTitle}
                                    onChange={e => setTopicTitle(e.target.value)}
                                    placeholder="Напр. Статград 14.04.2026 Вариант 1"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition-all"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Категория</label>
                                    <select
                                        value={category}
                                        onChange={e => { const v = e.target.value as TopicCategory; setCategory(v); setIsMock(v === 'mock'); }}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition-all"
                                    >
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Лимит (мин)</label>
                                    <input
                                        type="number"
                                        value={timeLimitMinutes}
                                        onChange={e => setTimeLimitMinutes(parseInt(e.target.value) || 235)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Parser mode */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <h2 className="font-bold text-gray-900 mb-4">Режим разбора</h2>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => setParseMode('auto')}
                                    className={clsx(
                                        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all',
                                        parseMode === 'auto' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300',
                                    )}
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <Zap size={15} className={parseMode === 'auto' ? 'text-orange-500' : 'text-gray-400'} />
                                        <span className={clsx('font-bold text-xs', parseMode === 'auto' ? 'text-orange-700' : 'text-gray-600')}>Авто</span>
                                        {parseMode === 'auto' && <span className="ml-auto text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded-full font-bold">★</span>}
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-relaxed">Находит задания по номерам. Мгновенно.</p>
                                </button>
                                <button
                                    onClick={() => setParseMode('llm')}
                                    className={clsx(
                                        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all',
                                        parseMode === 'llm' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Cpu size={15} className={parseMode === 'llm' ? 'text-blue-500' : 'text-gray-400'} />
                                        <span className={clsx('font-bold text-xs', parseMode === 'llm' ? 'text-blue-700' : 'text-gray-600')}>ИИ</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-relaxed">Языковая модель. Для сложных форматов.</p>
                                </button>
                                <button
                                    onClick={() => setParseMode('manual')}
                                    className={clsx(
                                        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all',
                                        parseMode === 'manual' ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <MousePointerClick size={15} className={parseMode === 'manual' ? 'text-violet-500' : 'text-gray-400'} />
                                        <span className={clsx('font-bold text-xs', parseMode === 'manual' ? 'text-violet-700' : 'text-gray-600')}>Вручную</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-relaxed">Просмотр текста и расстановка границ.</p>
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleParse}
                            disabled={loading || !pdfFile || !topicTitle.trim()}
                            className={clsx(
                                'w-full flex items-center justify-center gap-3 py-4 bg-orange-500 text-white rounded-2xl text-base font-bold shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all disabled:opacity-50 disabled:shadow-none',
                                loading && 'cursor-wait',
                            )}
                        >
                            {loading
                                ? <><Loader2 size={20} className="animate-spin" />{parseMode === 'llm' ? 'Анализирую с помощью ИИ...' : 'Извлекаю текст...'}</>
                                : parseMode === 'manual'
                                    ? <><MousePointerClick size={20} />Открыть для разметки</>
                                    : <><FileText size={20} />Разобрать задания</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Annotate step ─────────────────────────────────────────
    if (step === 'annotate') {
        const markerCount = countMarkers();
        return (
            <div className="h-full flex flex-col bg-[#F8F7F4]">
                {/* Top bar */}
                <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
                    <button onClick={() => setStep('upload')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                            <Scissors size={14} className="text-violet-600" />
                        </div>
                        <div>
                            <span className="font-bold text-gray-900 text-sm">Разметка заданий</span>
                            <span className="text-xs text-gray-400 ml-2">— {topicTitle}</span>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        {/* Insert marker button */}
                        <button
                            onClick={insertMarker}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-xl text-sm font-bold transition-all"
                        >
                            <Plus size={15} />
                            Вставить «Задание {nextTaskNum}»
                        </button>

                        {/* Marker counter */}
                        {markerCount > 0 && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-semibold">
                                {markerCount} {markerCount === 1 ? 'задание' : markerCount < 5 ? 'задания' : 'заданий'} размечено
                            </span>
                        )}

                        {/* Copy text button */}
                        <button
                            onClick={() => navigator.clipboard.writeText(annotatedText)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
                        >
                            <Copy size={13} />
                            Копировать
                        </button>

                        {/* Split button */}
                        <button
                            onClick={handleSplitByMarkers}
                            disabled={markerCount === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#3F8C62] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#3F8C62]/20 hover:bg-[#357A54] transition-all disabled:opacity-40 disabled:shadow-none"
                        >
                            <Scissors size={15} />
                            Разбить на задания →
                        </button>
                    </div>
                </div>

                {/* Instruction banner */}
                <div className="shrink-0 bg-violet-50 border-b border-violet-100 px-6 py-2.5 flex items-center gap-3">
                    <MousePointerClick size={15} className="text-violet-500 shrink-0" />
                    <p className="text-xs text-violet-700">
                        Поставьте курсор в тексте <strong>перед началом каждого задания</strong> и нажмите
                        <kbd className="mx-1 px-1.5 py-0.5 bg-white border border-violet-200 rounded text-[10px] font-mono">+ Вставить «Задание N»</kbd>.
                        Маркер будет вставлен и счётчик увеличится. Затем нажмите «Разбить на задания».
                    </p>
                </div>

                {/* Annotate textarea */}
                <div className="flex-1 min-h-0 p-4">
                    <textarea
                        ref={annotateRef}
                        value={annotatedText}
                        onChange={e => setAnnotatedText(e.target.value)}
                        className="w-full h-full resize-none bg-white border border-gray-200 rounded-2xl p-5 text-sm font-mono leading-relaxed focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 shadow-sm"
                        spellCheck={false}
                        placeholder="Текст из PDF появится здесь. Поставьте курсор перед каждым заданием и нажмите кнопку вставки маркера."
                    />
                </div>

                {error && (
                    <div className="shrink-0 mx-4 mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={15} />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // ── Done step ─────────────────────────────────────────────
    if (step === 'done') {
        return (
            <div className="min-h-full bg-[#F8F7F4] flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12 text-center max-w-md w-full">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Импорт завершён!</h2>
                    <p className="text-gray-500 mb-1">Топик <strong>«{topicTitle}»</strong> создан</p>
                    <p className="text-gray-400 text-sm mb-8">{tasks.length} заданий сохранено</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate('/admin')}
                            className="w-full py-3 bg-[#3F8C62] text-white rounded-xl font-bold hover:bg-[#357A54] transition-all shadow-lg shadow-[#3F8C62]/20"
                        >
                            Вернуться в панель
                        </button>
                        <button
                            onClick={() => { setStep('upload'); setTasks([]); setPdfFile(null); setTopicTitle(''); setFullText(''); setShowFullText(false); setAnnotatedText(''); setNextTaskNum(1); }}
                            className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                        >
                            Импортировать ещё
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Review step ───────────────────────────────────────────
    const topicEgeValue = topicEgeNumberEnd != null && topicEgeNumber != null
        ? `${topicEgeNumber}-${topicEgeNumberEnd}`
        : (topicEgeNumber != null ? String(topicEgeNumber) : '');
    const setTopicEgeValue = (v: string) => {
        if (v === '') {
            setTopicEgeNumber(null);
            setTopicEgeNumberEnd(null);
        } else if (v.includes('-')) {
            const [a, b] = v.split('-').map(n => parseInt(n));
            setTopicEgeNumber(a);
            setTopicEgeNumberEnd(b);
        } else {
            setTopicEgeNumber(parseInt(v));
            setTopicEgeNumberEnd(null);
        }
    };
    const needsTopicEgeNumber = category === 'tutorial' || category === 'homework';

    return (
        <div className="h-full flex flex-col bg-[#F8F7F4]">
            {/* Top bar — row 1 */}
            <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
                <button onClick={() => setStep('upload')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                        <FileText size={14} className="text-orange-600" />
                    </div>
                </div>
                <input
                    type="text"
                    value={topicTitle}
                    onChange={e => setTopicTitle(e.target.value)}
                    placeholder="Название топика..."
                    className="font-bold text-gray-900 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62]/20 transition-all w-72"
                />
                <span className="text-xs text-gray-400">{tasks.length} заданий</span>

                <div className="ml-auto flex items-center gap-3">
                    {fullText && (
                        <button
                            onClick={() => setShowFullText(v => !v)}
                            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border',
                                showFullText ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            )}
                        >
                            {showFullText ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                            {showFullText ? 'Скрыть текст PDF' : 'Текст PDF'}
                        </button>
                    )}
                    <button
                        onClick={() => setPreviewMode(v => !v)}
                        className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border',
                            previewMode ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        )}
                    >
                        {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
                        {previewMode ? 'Редактор' : 'Превью'}
                    </button>

                    {error && (
                        <div className="flex items-center gap-1.5 text-red-500 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                            <AlertCircle size={13} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleConfirm}
                        disabled={loading || !tasks.length}
                        className={clsx(
                            'flex items-center gap-2 px-5 py-2.5 bg-[#3F8C62] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#3F8C62]/20 hover:bg-[#357A54] transition-all disabled:opacity-50',
                            loading && 'cursor-wait',
                        )}
                    >
                        {loading
                            ? <><Loader2 size={15} className="animate-spin" />Сохраняю...</>
                            : <><CheckCircle2 size={15} />Сохранить {tasks.length} заданий</>
                        }
                    </button>
                </div>
            </div>

            {/* Top bar — row 2: topic settings */}
            <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-3 text-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Тип топика</span>
                <select
                    value={category}
                    onChange={e => {
                        const v = e.target.value as TopicCategory;
                        setCategory(v);
                        setIsMock(v === 'mock');
                        if (v !== 'tutorial' && v !== 'homework') {
                            setTopicEgeNumber(null);
                            setTopicEgeNumberEnd(null);
                        }
                    }}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62]/20"
                >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>

                {needsTopicEgeNumber && (
                    <>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-2">Номер задания</span>
                        <select
                            value={topicEgeValue}
                            onChange={e => setTopicEgeValue(e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62]/20"
                        >
                            <option value="">— выберите —</option>
                            {Array.from({ length: 18 }, (_, i) => (
                                <option key={i + 1} value={String(i + 1)}>№{i + 1}</option>
                            ))}
                            <option value="19-21">№19-21 (теория игр)</option>
                            {[22, 23, 24, 25, 26, 27].map(n => (
                                <option key={n} value={String(n)}>№{n}</option>
                            ))}
                        </select>
                    </>
                )}

                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-2">Лимит времени</span>
                <input
                    type="number"
                    value={timeLimitMinutes}
                    onChange={e => setTimeLimitMinutes(parseInt(e.target.value) || 235)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 w-20 focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62]/20"
                />
                <span className="text-[10px] font-bold text-gray-400">мин</span>
            </div>

            {/* Body: full text panel + sidebar + editor */}
            <div className="flex-1 flex min-h-0">
                {/* Full text panel */}
                {showFullText && fullText && (
                    <div className="w-[380px] shrink-0 border-r border-gray-200 bg-white flex flex-col">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
                            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Текст из PDF</span>
                            <button
                                onClick={() => navigator.clipboard.writeText(fullText)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors px-2 py-1 rounded-lg hover:bg-amber-100"
                            >
                                <Copy size={12} />
                                Копировать всё
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed select-text">{fullText}</pre>
                        </div>
                    </div>
                )}

                {/* Sidebar */}
                <div className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {tasks.length === 0 && (
                            <div className="text-center py-6 space-y-3">
                                <p className="text-xs text-gray-400 leading-relaxed">Парсер не смог разбить текст на задания. Создайте задания вручную:</p>
                                <button
                                    onClick={() => createEmptyTasks(27)}
                                    className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-sm"
                                >
                                    Создать 27 заданий
                                </button>
                                <button
                                    onClick={addTask}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-[#3F8C62] hover:bg-green-50 transition-all border border-dashed border-gray-200"
                                >
                                    <Plus size={13} />
                                    Добавить одно
                                </button>
                            </div>
                        )}
                        {tasks.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedIdx(i)}
                                className={clsx(
                                    'w-full text-left px-3 py-3 rounded-xl transition-all group',
                                    i === selectedIdx
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'text-gray-500 hover:bg-gray-50',
                                    !t.content_html && 'opacity-60',
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm">Задание {i + 1}</span>
                                    <button
                                        onClick={e => { e.stopPropagation(); removeTask(i); }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                {getEgeDisplay(t) && (
                                    <div className="text-[11px] opacity-60 mt-0.5">ЕГЭ №{getEgeDisplay(t)}</div>
                                )}
                                {t.title && (
                                    <div className="text-[10px] opacity-50 mt-0.5 truncate">{t.title}</div>
                                )}
                                {!t.content_html && (
                                    <div className="text-[10px] text-orange-400 mt-0.5">пусто</div>
                                )}
                                {t.images.length > 0 && (
                                    <div className="text-[10px] opacity-50 mt-0.5">📷 {t.images.length} фото</div>
                                )}
                            </button>
                        ))}
                    </div>
                    {tasks.length > 0 && (
                        <div className="p-3 border-t border-gray-100">
                            <button
                                onClick={addTask}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-[#3F8C62] hover:bg-green-50 transition-all border border-dashed border-gray-200"
                            >
                                <Plus size={13} />
                                Добавить задание
                            </button>
                        </div>
                    )}
                </div>

                {/* Editor */}
                {currentTask ? (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-3xl mx-auto space-y-5">
                            {/* Meta row */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Номер ЕГЭ</label>
                                    <select
                                        value={getEgeValue(currentTask)}
                                        onChange={e => setEgeNumber(selectedIdx, e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                    >
                                        <option value="">— не указан —</option>
                                        {EGE_NUMBER_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Тип ответа</label>
                                    <select
                                        value={currentTask.answer_type}
                                        onChange={e => updateTask(selectedIdx, { answer_type: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                    >
                                        {ANSWER_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Правильный ответ</label>
                                    <input
                                        type="text"
                                        value={formatAnswerForInput(currentTask.correct_answer)}
                                        onChange={e => updateTask(selectedIdx, { correct_answer: parseAnswerInput(e.target.value, currentTask.answer_type) })}
                                        placeholder="Оставьте пустым если неизвестен"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Тема (раздел) */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Тема / Раздел</label>
                                <input
                                    type="text"
                                    value={currentTask.title || ''}
                                    onChange={e => updateTask(selectedIdx, { title: e.target.value })}
                                    placeholder="Напр. «Теория игр», «Анализ программ», «Базы данных»"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                />
                            </div>

                            {/* Text editor / preview */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Текст задания</label>
                                {previewMode ? (
                                    <div
                                        className="w-full min-h-[300px] p-5 bg-white border border-gray-200 rounded-xl text-sm leading-relaxed shadow-sm prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: currentTask.content_html }}
                                    />
                                ) : (
                                    <textarea
                                        value={currentTask.content_html}
                                        onChange={e => updateTask(selectedIdx, { content_html: e.target.value })}
                                        rows={14}
                                        placeholder="Вставьте текст задания из панели «Текст PDF»..."
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all resize-y shadow-sm"
                                    />
                                )}
                            </div>

                            {/* Images */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Изображения к заданию</label>
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-semibold hover:bg-orange-100 transition-all disabled:opacity-50"
                                    >
                                        {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                                        Загрузить изображение
                                    </button>
                                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </div>
                                {currentTask.images.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        {currentTask.images.map((url, imgIdx) => (
                                            <div key={imgIdx} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center shadow-sm">
                                                <img src={url} alt="" className="object-contain w-full h-full" />
                                                <button
                                                    onClick={() => updateTask(selectedIdx, { images: currentTask.images.filter((_, i) => i !== imgIdx) })}
                                                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => imageInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400 cursor-pointer hover:border-orange-300 hover:text-orange-500 transition-all"
                                    >
                                        <ImagePlus size={24} className="mx-auto mb-2 opacity-40" />
                                        Нажмите или вставьте из буфера (Ctrl+V)
                                    </div>
                                )}
                            </div>

                            {/* Files */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Прикреплённые файлы</label>
                                    <button
                                        onClick={() => fileAttachRef.current?.click()}
                                        disabled={uploadingFile}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all disabled:opacity-50"
                                    >
                                        {uploadingFile ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                                        Прикрепить файл
                                    </button>
                                    <input ref={fileAttachRef} type="file" className="hidden" onChange={handleFileAttach} />
                                </div>
                                {currentTask.files.length > 0 ? (
                                    <div className="space-y-2">
                                        {currentTask.files.map((f, fIdx) => (
                                            <div key={fIdx} className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm group">
                                                <Paperclip size={14} className="text-gray-400 shrink-0" />
                                                <span className="text-sm text-gray-700 truncate flex-1">{f.name || 'Файл'}</span>
                                                <button
                                                    onClick={() => removeFile(selectedIdx, fIdx)}
                                                    className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Нет файлов — нажмите «Прикрепить файл» для загрузки (БД, таблицы и т.д.)</p>
                                )}
                            </div>

                            {/* Sub-tasks editor (composite) */}
                            {currentTask.sub_tasks && currentTask.sub_tasks.length > 0 && (
                                <div className="border-2 border-amber-200 bg-amber-50/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Подзадания (составное задание)</span>
                                    </div>
                                    {currentTask.sub_tasks.map((sub, sIdx) => (
                                        <div key={sIdx} className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Номер</label>
                                                    <input
                                                        type="number"
                                                        value={sub.number ?? ''}
                                                        onChange={e => updateSubTask(selectedIdx, sIdx, { number: e.target.value ? parseInt(e.target.value) : null })}
                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Тип ответа</label>
                                                    <select
                                                        value={sub.answer_type}
                                                        onChange={e => updateSubTask(selectedIdx, sIdx, { answer_type: e.target.value })}
                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
                                                    >
                                                        {ANSWER_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ответ</label>
                                                    <input
                                                        type="text"
                                                        value={formatAnswerForInput(sub.correct_answer)}
                                                        onChange={e => updateSubTask(selectedIdx, sIdx, { correct_answer: parseAnswerInput(e.target.value, sub.answer_type) })}
                                                        placeholder="напр. 8 22 23"
                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Текст подзадания</label>
                                                <textarea
                                                    value={sub.content_html}
                                                    onChange={e => updateSubTask(selectedIdx, sIdx, { content_html: e.target.value })}
                                                    rows={4}
                                                    placeholder="Текст подзадания..."
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all resize-y"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <p className="text-sm text-gray-400">Создайте задания и распределите текст из PDF вручную</p>
                            <button
                                onClick={() => createEmptyTasks(27)}
                                className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                            >
                                Создать 27 заданий ЕГЭ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
