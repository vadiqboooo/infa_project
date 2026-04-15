import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Upload, FileText, AlertCircle, Loader2,
    CheckCircle2, ImagePlus, Trash2, Plus, Eye, EyeOff,
    Cpu, Zap,
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

interface ParsedTask {
    index: number;
    ege_number: number | null;
    content_html: string;
    answer_type: string;
    correct_answer: unknown;
    images: string[];
}

const ANSWER_TYPES = [
    { value: 'single_number', label: 'Одно число' },
    { value: 'pair', label: 'Пара чисел' },
    { value: 'table', label: 'Таблица' },
    { value: 'text', label: 'Текст' },
];

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

    // ── Upload step state ─────────────────────────────────────
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [topicTitle, setTopicTitle] = useState('');
    const [category, setCategory] = useState<TopicCategory>('variants');
    const [isMock, setIsMock] = useState(false);
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(235);
    const [useLlm, setUseLlm] = useState(false);

    // ── App state ─────────────────────────────────────────────
    const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Review step state ─────────────────────────────────────
    const [tasks, setTasks] = useState<ParsedTask[]>([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [previewMode, setPreviewMode] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

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
            fd.append('use_llm', useLlm ? 'true' : 'false');
            const res = await fetch(`${API_BASE}/admin/import-pdf/parse`, { method: 'POST', headers, body: fd });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Ошибка разбора');
            }
            const data: { tasks: ParsedTask[]; page_count: number } = await res.json();
            if (!data.tasks?.length) throw new Error('Задания не найдены в PDF');
            setTasks(data.tasks);
            setSelectedIdx(0);
            setStep('review');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
            index: prev.length, ege_number: null, content_html: '',
            answer_type: 'single_number', correct_answer: null, images: [],
        }]);
        setSelectedIdx(tasks.length);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setUploadingImage(true);
        try {
            const token = localStorage.getItem('jwt_token');
            const headers: Record<string, string> = { 'X-API-Key': apiKey };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const fd = new FormData();
            fd.append('file', f);
            const res = await fetch(`${API_BASE}/admin/import-pdf/upload-image`, { method: 'POST', headers, body: fd });
            if (!res.ok) throw new Error('Ошибка загрузки');
            const data: { url: string } = await res.json();
            updateTask(selectedIdx, { images: [...(tasks[selectedIdx]?.images ?? []), data.url] });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploadingImage(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
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
                    tasks: tasks.map(t => ({
                        ege_number: t.ege_number,
                        content_html: t.content_html,
                        answer_type: t.answer_type,
                        correct_answer: t.correct_answer ?? null,
                        images: t.images,
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
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setUseLlm(false)}
                                    className={clsx(
                                        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all',
                                        !useLlm ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Zap size={16} className={!useLlm ? 'text-orange-500' : 'text-gray-400'} />
                                        <span className={clsx('font-bold text-sm', !useLlm ? 'text-orange-700' : 'text-gray-600')}>Быстрый (без LLM)</span>
                                        {!useLlm && <span className="ml-auto text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">По умолчанию</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Находит задания по их номерам в тексте. Работает мгновенно, подходит для Статград и ФИПИ.</p>
                                </button>
                                <button
                                    onClick={() => setUseLlm(true)}
                                    className={clsx(
                                        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all',
                                        useLlm ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Cpu size={16} className={useLlm ? 'text-blue-500' : 'text-gray-400'} />
                                        <span className={clsx('font-bold text-sm', useLlm ? 'text-blue-700' : 'text-gray-600')}>ИИ (LLM)</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Использует языковую модель для смысловой разбивки. Медленнее, но лучше для нестандартных форматов.</p>
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
                                ? <><Loader2 size={20} className="animate-spin" />{useLlm ? 'Анализирую с помощью ИИ...' : 'Разбираю PDF...'}</>
                                : <><FileText size={20} />Разобрать задания</>
                            }
                        </button>
                    </div>
                </div>
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
                            onClick={() => { setStep('upload'); setTasks([]); setPdfFile(null); setTopicTitle(''); }}
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
    return (
        <div className="h-full flex flex-col bg-[#F8F7F4]">
            {/* Top bar */}
            <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
                <button onClick={() => setStep('upload')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                        <FileText size={14} className="text-orange-600" />
                    </div>
                    <span className="font-bold text-gray-900 text-sm">{topicTitle}</span>
                    <span className="text-xs text-gray-400 ml-1">{tasks.length} заданий</span>
                </div>

                <div className="ml-auto flex items-center gap-3">
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

            {/* Body: sidebar + editor */}
            <div className="flex-1 flex min-h-0">
                {/* Sidebar */}
                <div className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {tasks.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedIdx(i)}
                                className={clsx(
                                    'w-full text-left px-3 py-3 rounded-xl transition-all group',
                                    i === selectedIdx
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'text-gray-500 hover:bg-gray-50',
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
                                {t.ege_number && (
                                    <div className="text-[11px] opacity-60 mt-0.5">ЕГЭ №{t.ege_number}</div>
                                )}
                                {t.images.length > 0 && (
                                    <div className="text-[10px] opacity-50 mt-0.5">📷 {t.images.length} фото</div>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                        <button
                            onClick={addTask}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-[#3F8C62] hover:bg-green-50 transition-all border border-dashed border-gray-200"
                        >
                            <Plus size={13} />
                            Добавить задание
                        </button>
                    </div>
                </div>

                {/* Editor */}
                {currentTask ? (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-3xl mx-auto space-y-5">
                            {/* Meta row */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Номер ЕГЭ</label>
                                    <input
                                        type="number"
                                        value={currentTask.ege_number ?? ''}
                                        onChange={e => updateTask(selectedIdx, { ege_number: e.target.value ? parseInt(e.target.value) : null })}
                                        placeholder="1–27"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Тип ответа</label>
                                    <select
                                        value={currentTask.answer_type}
                                        onChange={e => updateTask(selectedIdx, { answer_type: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                    >
                                        {ANSWER_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Правильный ответ</label>
                                    <input
                                        type="text"
                                        value={currentTask.correct_answer != null ? String(currentTask.correct_answer) : ''}
                                        onChange={e => updateTask(selectedIdx, { correct_answer: e.target.value || null })}
                                        placeholder="Оставьте пустым если неизвестен"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all shadow-sm"
                                    />
                                </div>
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
                                        Нажмите чтобы добавить скриншот или фото с графом/таблицей
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Выберите задание из списка слева
                    </div>
                )}
            </div>
        </div>
    );
}
