import React, { useCallback, useRef, useState } from 'react';
import {
  X, Upload, FileText, AlertCircle, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, ImagePlus, Trash2, Plus,
  Eye, EyeOff, Copy,
} from 'lucide-react';
import { clsx } from 'clsx';

const API_BASE = '/api';

function adminFetch<T>(path: string, apiKey: string, options: RequestInit = {}): Promise<T> {
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
    if (res.status === 204) return undefined as T;
    return res.json();
  });
}

export type TopicCategory = 'tutorial' | 'homework' | 'control' | 'variants' | 'mock';

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

interface ImportPdfModalProps {
  onClose: () => void;
  apiKey: string;
  onSuccess: () => void;
}

type Step = 'upload' | 'review' | 'done';

export function ImportPdfModal({ onClose, apiKey, onSuccess }: ImportPdfModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload step state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [category, setCategory] = useState<TopicCategory>('variants');
  const [isMock, setIsMock] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(235);

  // Review step state
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullText, setFullText] = useState('');
  const [showFullText, setShowFullText] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') {
      setPdfFile(f);
      setError(null);
    } else {
      setError('Пожалуйста, загрузите PDF файл');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setPdfFile(f); setError(null); }
  };

  const handleParse = async () => {
    if (!pdfFile) { setError('Выберите PDF файл'); return; }
    if (!topicTitle.trim()) { setError('Введите название топика'); return; }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', pdfFile);
      const token = localStorage.getItem('jwt_token');
      const headers: Record<string, string> = { 'X-API-Key': apiKey };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/admin/import-pdf/parse`, {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Ошибка разбора');
      }
      const data: { tasks: ParsedTask[]; page_count: number; full_text?: string } = await res.json();
      setFullText(data.full_text || '');
      if (!data.tasks?.length) {
        setShowFullText(true);
        setTasks([]);
      } else {
        setTasks(data.tasks);
      }
      setCurrentTaskIdx(0);
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
      setCurrentTaskIdx(Math.min(currentTaskIdx, next.length - 1));
      return next;
    });
  };

  const addTask = () => {
    const newTask: ParsedTask = {
      index: tasks.length,
      ege_number: null,
      content_html: '',
      answer_type: 'single_number',
      correct_answer: null,
      images: [],
    };
    setTasks(prev => [...prev, newTask]);
    setCurrentTaskIdx(tasks.length);
  };

  const createEmptyTasks = (count: number) => {
    const newTasks: ParsedTask[] = Array.from({ length: count }, (_, i) => ({
      index: i,
      ege_number: i + 1,
      content_html: '',
      answer_type: 'single_number',
      correct_answer: null,
      images: [],
    }));
    setTasks(newTasks);
    setCurrentTaskIdx(0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const token = localStorage.getItem('jwt_token');
      const headers: Record<string, string> = { 'X-API-Key': apiKey };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/admin/import-pdf/upload-image`, {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!res.ok) throw new Error('Ошибка загрузки изображения');
      const data: { url: string } = await res.json();
      updateTask(currentTaskIdx, {
        images: [...(tasks[currentTaskIdx]?.images ?? []), data.url],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const removeImage = (taskIdx: number, imgIdx: number) => {
    updateTask(taskIdx, {
      images: tasks[taskIdx].images.filter((_, i) => i !== imgIdx),
    });
  };

  const handleConfirm = async () => {
    if (tasks.length === 0) { setError('Нет заданий для сохранения'); return; }
    setLoading(true);
    setError(null);
    try {
      await adminFetch('/admin/import-pdf/confirm', apiKey, {
        method: 'POST',
        body: JSON.stringify({
          topic_title: topicTitle.trim(),
          category,
          is_mock: isMock,
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
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentTask = tasks[currentTaskIdx];

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={clsx(
          'bg-white rounded-2xl shadow-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col',
          showFullText ? 'max-w-6xl' : 'max-w-3xl',
        )}
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <FileText size={18} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-sm">Импорт из PDF</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                {step === 'upload' && 'Шаг 1 — Загрузка файла'}
                {step === 'review' && `Шаг 2 — Проверка заданий (${tasks.length})`}
                {step === 'done' && 'Готово'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="p-6 space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  dragOver ? 'border-orange-400 bg-orange-50' : pdfFile ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30',
                )}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                {pdfFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 size={32} className="text-green-500" />
                    <p className="font-bold text-gray-900">{pdfFile.name}</p>
                    <p className="text-xs text-gray-400">{(pdfFile.size / 1024).toFixed(0)} KB — Нажмите чтобы заменить</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={32} className="text-gray-300" />
                    <p className="font-semibold text-gray-600">Перетащите PDF или нажмите для выбора</p>
                    <p className="text-xs text-gray-400">Поддерживается текстовый PDF (Статград, варианты ЕГЭ)</p>
                  </div>
                )}
              </div>

              {/* Topic settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Название топика *</label>
                  <input
                    type="text"
                    value={topicTitle}
                    onChange={e => setTopicTitle(e.target.value)}
                    placeholder="Напр. Статград 14.04.2026 Вариант 1"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Категория</label>
                  <select
                    value={category}
                    onChange={e => {
                      const v = e.target.value as TopicCategory;
                      setCategory(v);
                      setIsMock(v === 'mock');
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition-all"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Лимит времени (мин)</label>
                  <input
                    type="number"
                    value={timeLimitMinutes}
                    onChange={e => setTimeLimitMinutes(parseInt(e.target.value) || 235)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition-all"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Система извлечёт текст из PDF и разобьёт на задания с помощью ИИ. На следующем шаге вы сможете отредактировать каждое задание, добавить изображения и указать правильные ответы.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="flex h-full" style={{ minHeight: 480 }}>
              {/* Full text panel (toggleable) */}
              {showFullText && fullText && (
                <div className="w-[340px] shrink-0 border-r border-gray-100 flex flex-col">
                  <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Текст из PDF</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fullText);
                      }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                      title="Скопировать весь текст"
                    >
                      <Copy size={11} />
                      Копировать всё
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed select-text">{fullText}</pre>
                  </div>
                </div>
              )}

              {/* Task list */}
              <div className="w-48 shrink-0 border-r border-gray-100 overflow-y-auto p-3 space-y-1">
                {tasks.length === 0 && (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-gray-400">Нет заданий</p>
                    <button
                      onClick={() => createEmptyTasks(27)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all"
                    >
                      Создать 27 заданий
                    </button>
                  </div>
                )}
                {tasks.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTaskIdx(i)}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                      i === currentTaskIdx ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50',
                      !t.content_html && 'opacity-50',
                    )}
                  >
                    <div className="font-bold">Задание {i + 1}</div>
                    {t.ege_number && <div className="text-[10px] opacity-60">ЕГЭ №{t.ege_number}</div>}
                    {!t.content_html && <div className="text-[10px] text-orange-400">пусто</div>}
                  </button>
                ))}
                {tasks.length > 0 && (
                  <button
                    onClick={addTask}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-[#3F8C62] hover:bg-green-50 transition-all border border-dashed border-gray-200 mt-2"
                  >
                    <Plus size={13} />
                    Добавить
                  </button>
                )}
              </div>

              {/* Task editor */}
              {currentTask ? (
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-sm">Задание {currentTaskIdx + 1}</h3>
                    <button
                      onClick={() => removeTask(currentTaskIdx)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                      Удалить
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Номер ЕГЭ</label>
                      <input
                        type="number"
                        value={currentTask.ege_number ?? ''}
                        onChange={e => updateTask(currentTaskIdx, { ege_number: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="1–27"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Тип ответа</label>
                      <select
                        value={currentTask.answer_type}
                        onChange={e => updateTask(currentTaskIdx, { answer_type: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
                      >
                        {ANSWER_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Текст задания (HTML)</label>
                    <textarea
                      value={currentTask.content_html}
                      onChange={e => updateTask(currentTaskIdx, { content_html: e.target.value })}
                      rows={8}
                      placeholder="Вставьте текст задания из панели слева..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all resize-y"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Правильный ответ (оставьте пустым если неизвестен)</label>
                    <input
                      type="text"
                      value={currentTask.correct_answer != null ? String(currentTask.correct_answer) : ''}
                      onChange={e => {
                        const v = e.target.value;
                        updateTask(currentTaskIdx, { correct_answer: v || null });
                      }}
                      placeholder="Напр. 42 или оставьте пустым"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
                    />
                  </div>

                  {/* Images */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase">Изображения</label>
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors disabled:opacity-50"
                      >
                        {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                        Добавить
                      </button>
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </div>
                    {currentTask.images.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {currentTask.images.map((url, imgIdx) => (
                          <div key={imgIdx} className="relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-video flex items-center justify-center">
                            <img src={url} alt="" className="object-contain w-full h-full" />
                            <button
                              onClick={() => removeImage(currentTaskIdx, imgIdx)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Изображений нет — нажмите «Добавить» чтобы загрузить</p>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center space-y-3">
                    <p className="text-sm text-gray-400">Создайте задания и распределите текст из PDF вручную</p>
                    <button
                      onClick={() => createEmptyTasks(27)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                    >
                      Создать 27 заданий ЕГЭ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in zoom-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Импорт завершён!</h3>
              <p className="text-sm text-gray-500 mt-1">
                Топик «{topicTitle}» создан с {tasks.length} заданиями
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Вы можете отредактировать задания в разделе «Топики»
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'done' && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3 shrink-0">
            {step === 'review' && (
              <div className="flex items-center gap-3 mr-auto">
                {fullText && (
                  <button
                    onClick={() => setShowFullText(v => !v)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      showFullText ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                    )}
                  >
                    {showFullText ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showFullText ? 'Скрыть текст' : 'Текст PDF'}
                  </button>
                )}
                {tasks.length > 0 && (
                  <>
                    <button
                      onClick={() => setCurrentTaskIdx(i => Math.max(0, i - 1))}
                      disabled={currentTaskIdx === 0}
                      className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-gray-500 tabular-nums min-w-[60px] text-center">
                      {currentTaskIdx + 1} / {tasks.length}
                    </span>
                    <button
                      onClick={() => setCurrentTaskIdx(i => Math.min(tasks.length - 1, i + 1))}
                      disabled={currentTaskIdx === tasks.length - 1}
                      className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              Отмена
            </button>

            {step === 'upload' && (
              <button
                onClick={handleParse}
                disabled={loading || !pdfFile || !topicTitle.trim()}
                className={clsx(
                  'flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all disabled:opacity-50 disabled:shadow-none',
                  loading && 'cursor-wait',
                )}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" />Разбираю PDF...</> : <><FileText size={16} />Разобрать задания</>}
              </button>
            )}

            {step === 'review' && (
              <button
                onClick={handleConfirm}
                disabled={loading || tasks.length === 0}
                className={clsx(
                  'flex items-center gap-2 px-6 py-3 bg-[#3F8C62] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#3F8C62]/20 hover:bg-[#357A54] transition-all disabled:opacity-50 disabled:shadow-none',
                  loading && 'cursor-wait',
                )}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" />Сохраняю...</> : <><CheckCircle2 size={16} />Сохранить {tasks.length} заданий</>}
              </button>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center shrink-0">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-[#3F8C62] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#3F8C62]/20 hover:bg-[#357A54] transition-all"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
