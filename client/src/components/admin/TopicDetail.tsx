import React, { useState, useMemo, useRef } from 'react';
import RichTextEditor from './RichTextEditor';
import GraphSvgEditor from './GraphSvgEditor';
import GeometrySvgEditor from './GeometrySvgEditor';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { githubLight } from '@uiw/codemirror-theme-github';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Code2,
  Search,
  Clock,
  ImageIcon,
  Upload,
  Loader2,
  FileCode2,
  Hash,
  AlignLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  User,
  Image as ImagePic,
  Check,
} from 'lucide-react';

// ── Пресеты персонажей и фонов из /public/character/ ───────────────────────
const CHARACTER_PRESETS: { url: string; label: string }[] = [
  {
    url: '/character/cute-astronaut-blowing-gum-with-hoodie-cartoon-vector-icon-illustration-science-fashion-isolated.png',
    label: 'Жвачник',
  },
  {
    url: '/character/cute-astronaut-dancing-cartoon-vector-icon-illustration-science-technology-icon-concept-isolated.png',
    label: 'Танцор',
  },
];

const BACKGROUND_PRESETS: { url: string; label: string }[] = [
  { url: '/character/фон 1.png', label: 'Фон 1' },
  { url: '/character/фон 2.png', label: 'Фон 2' },
];
import { clsx } from 'clsx';
import type { TopicAdmin, TaskAdmin, TopicCategory, TaskDifficulty, AnswerType } from '../../api/types';
import { useGenerateSteps } from '../../hooks/useApi';

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

function formatAnswerForDisplay(correct: any): string {
    return formatAnswerForInput(correct).replace(/\s*\n+\s*/g, '; ').trim();
}

function formatTaskCorrectAnswer(task: TaskAdmin): string {
    const parts: string[] = [];
    const mainAnswer = formatAnswerForDisplay(task.correct_answer);
    if (mainAnswer) {
        parts.push(mainAnswer);
    }

    for (const subTask of task.sub_tasks ?? []) {
        const answer = formatAnswerForDisplay(subTask.correct_answer);
        if (!answer) continue;
        parts.push(`${subTask.number ?? '-'}: ${answer}`);
    }

    return parts.join(' · ');
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

interface TopicDetailProps {
  topic: TopicAdmin;
  tasks: TaskAdmin[];
  onBack: () => void;
  onSaveTopic: (data: Partial<TopicAdmin>) => void;
  onSaveTask: (data: Partial<TaskAdmin>) => void;
  onReorderTasks: (orderedTasks: TaskAdmin[]) => void;
  onDeleteTask: (id: number) => void;
  apiKey?: string;
}

export function TopicDetail({
  topic,
  tasks,
  onBack,
  onSaveTopic,
  onSaveTask,
  onReorderTasks,
  onDeleteTask,
  apiKey,
}: TopicDetailProps) {
  const [editingTopic, setEditingTopic] = useState(topic);
  const [editingTask, setEditingTask] = useState<Partial<TaskAdmin> | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(null);
  const skipTaskClickRef = useRef(false);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  // ── Card image management ────────────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageCacheBust, setImageCacheBust] = useState<number>(Date.now());

  React.useEffect(() => {
    setEditingTopic(topic);
    setImageCacheBust(Date.now());
  }, [topic]);

  const buildAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-API-Key'] = apiKey;
    const token = localStorage.getItem('jwt_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const uploadedBgUrl = `/api/topics/${topic.id}/image`;

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('Файл слишком большой (макс 4 МБ)');
      return;
    }
    setImageBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/topics/${topic.id}/image`, {
        method: 'POST', headers: buildAuthHeaders(), body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Не удалось загрузить картинку');
      }
      // Backend выставляет background_url на uploadedBgUrl — отражаем локально
      const updated: Partial<TopicAdmin> = {
        ...editingTopic,
        has_image: true,
        image_position: editingTopic.image_position ?? 'cover',
        image_size: editingTopic.image_size ?? 120,
        background_url: uploadedBgUrl,
      };
      setEditingTopic(updated as TopicAdmin);
      setImageCacheBust(Date.now());
      onSaveTopic(updated);
    } catch (e: any) {
      alert(e.message || 'Ошибка загрузки');
    } finally {
      setImageBusy(false);
    }
  };

  const handleImageDelete = async () => {
    if (!confirm('Удалить загруженный фон?')) return;
    setImageBusy(true);
    try {
      const res = await fetch(`/api/admin/topics/${topic.id}/image`, {
        method: 'DELETE', headers: buildAuthHeaders(),
      });
      if (!res.ok) throw new Error('Не удалось удалить картинку');
      const updated: Partial<TopicAdmin> = {
        ...editingTopic,
        has_image: false,
        // Сбрасываем background_url только если он указывал на upload — пресет, если стоял, не трогаем
        background_url: editingTopic.background_url === uploadedBgUrl ? null : editingTopic.background_url,
      };
      setEditingTopic(updated as TopicAdmin);
      setImageCacheBust(Date.now());
      onSaveTopic(updated);
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    } finally {
      setImageBusy(false);
    }
  };

  const handleSelectCharacter = (url: string | null) => {
    const updated: Partial<TopicAdmin> = { ...editingTopic, character_url: url };
    setEditingTopic(updated as TopicAdmin);
    onSaveTopic(updated);
  };

  const handleSelectBackground = (url: string | null) => {
    const updated: Partial<TopicAdmin> = { ...editingTopic, background_url: url };
    setEditingTopic(updated as TopicAdmin);
    onSaveTopic(updated);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        search === '' ||
        (t.title && t.title.toLowerCase().includes(search.toLowerCase())) ||
        (t.ege_number && String(t.ege_number).includes(search))
    );
  }, [tasks, search]);

  const handleMoveTask = (fromIndex: number, insertionIndex: number) => {
    if (fromIndex === insertionIndex || fromIndex + 1 === insertionIndex) return;
    const movedTask = filteredTasks[fromIndex];
    if (!movedTask) return;

    const beforeTask = filteredTasks[insertionIndex] ?? null;
    const ordered = [...tasks].sort((a, b) => a.order_index - b.order_index || a.id - b.id);
    const withoutMoved = ordered.filter((task) => task.id !== movedTask.id);
    const insertAt = beforeTask
      ? Math.max(0, withoutMoved.findIndex((task) => task.id === beforeTask.id))
      : withoutMoved.length;

    const nextTasks = [
      ...withoutMoved.slice(0, insertAt),
      movedTask,
      ...withoutMoved.slice(insertAt),
    ].map((task, index) => ({ ...task, order_index: index }));

    const changed = nextTasks.some((task) => {
      const previous = tasks.find((item) => item.id === task.id);
      return previous?.order_index !== task.order_index;
    });

    if (changed) {
      onReorderTasks(nextTasks);
    }
  };

  const removeDragPreview = () => {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
  };

  const handleDragStart = (e: React.DragEvent, task: TaskAdmin) => {
    setDraggedTaskId(task.id);
    setDragCursor({ x: e.clientX, y: e.clientY });
    skipTaskClickRef.current = true;
    e.dataTransfer.effectAllowed = 'move';
    removeDragPreview();

    const dragImage = document.createElement('div');
    dragImage.style.position = 'fixed';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.width = '1px';
    dragImage.style.height = '1px';
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    dragPreviewRef.current = dragImage;
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTaskDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    handleDragOver(e);
    setDragCursor({ x: e.clientX, y: e.clientY });
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
    setDragTarget({ index, position });
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedTaskId === null) return;
    const fromIndex = filteredTasks.findIndex((t) => t.id === draggedTaskId);
    const rect = e.currentTarget.getBoundingClientRect();
    const dropAfter = e.clientY > rect.top + rect.height / 2;
    const insertionIndex = toIndex + (dropAfter ? 1 : 0);
    if (fromIndex !== -1) handleMoveTask(fromIndex, insertionIndex);
    setDraggedTaskId(null);
    setDragTarget(null);
    setDragCursor(null);
    removeDragPreview();
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragTarget(null);
    setDragCursor(null);
    removeDragPreview();
    window.setTimeout(() => {
      skipTaskClickRef.current = false;
    }, 0);
  };

  const handleTopicFieldChange = (field: keyof TopicAdmin, value: any) => {
    setEditingTopic((prev) => ({ ...prev, [field]: value }));
  };

  const isCommonCourseCategory = (category: string) =>
    category === 'variants' || category === 'math' || category === 'mock';

  const handleSaveTopicHeader = () => {
    onSaveTopic(editingTopic);
    setIsEditingHeader(false);
  };

  // ── Task edit panel is open ──────────────────────────────────────────────
  if (editingTask) {
    return (
      <TaskEditPanel
        task={editingTask}
        onBack={() => setEditingTask(null)}
        apiKey={apiKey}
        onSave={(data) => {
          onSaveTask(data);
          setEditingTask(null);
        }}
      />
    );
  }

  // ── Task list ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          {isEditingHeader ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={editingTopic.title}
                onChange={(e) => handleTopicFieldChange('title', e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 w-64"
                placeholder="Название"
              />
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                <Hash size={14} className="text-gray-400" />
                <select
                  value={
                    editingTopic.ege_number_end != null && editingTopic.ege_number != null
                      ? `${editingTopic.ege_number}-${editingTopic.ege_number_end}`
                      : (editingTopic.ege_number != null ? String(editingTopic.ege_number) : '')
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      handleTopicFieldChange('ege_number', null);
                      handleTopicFieldChange('ege_number_end', null);
                    } else if (v.includes('-')) {
                      const [a, b] = v.split('-').map(n => parseInt(n));
                      handleTopicFieldChange('ege_number', a);
                      handleTopicFieldChange('ege_number_end', b);
                    } else {
                      handleTopicFieldChange('ege_number', parseInt(v));
                      handleTopicFieldChange('ege_number_end', null);
                    }
                  }}
                  className="bg-transparent text-sm font-bold focus:outline-none"
                >
                  <option value="">— №</option>
                  {Array.from({ length: 18 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>№{i + 1}</option>
                  ))}
                  <option value="19-21">№19-21 (теория игр)</option>
                  {[22, 23, 24, 25, 26, 27].map(n => (
                    <option key={n} value={String(n)}>№{n}</option>
                  ))}
                </select>
                <span className="text-[10px] font-bold text-gray-400 uppercase">ЕГЭ</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                <Clock size={14} className="text-gray-400" />
                <input
                  type="number"
                  value={editingTopic.time_limit_minutes || 60}
                  onChange={(e) =>
                    handleTopicFieldChange('time_limit_minutes', parseInt(e.target.value) || 0)
                  }
                  className="w-16 bg-transparent text-sm font-bold focus:outline-none"
                  placeholder="Мин"
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase">Мин</span>
              </div>
              <select
                value={editingTopic.category}
                onChange={(e) => {
                  const nextCategory = e.target.value as TopicCategory;
                  setEditingTopic((prev) => ({
                    ...prev,
                    category: nextCategory,
                    course_type: isCommonCourseCategory(nextCategory)
                      ? 'common'
                      : prev.course_type === 'common' ? 'year' : prev.course_type,
                  }));
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold"
              >
                <option value="tutorial">Разбор</option>
                <option value="homework">Домашняя работа</option>
                <option value="control">Контрольная работа</option>
                <option value="variants">Вариант</option>
                <option value="math">Математика</option>
                <option value="mock">Пробник</option>
              </select>
              <select
                value={isCommonCourseCategory(editingTopic.category) ? 'common' : (editingTopic.course_type ?? 'year')}
                onChange={(e) => handleTopicFieldChange('course_type', e.target.value)}
                disabled={isCommonCourseCategory(editingTopic.category)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold disabled:text-gray-400"
              >
                <option value="year">Годовой</option>
                <option value="summer">Летний</option>
                <option value="common">Общий</option>
              </select>
              <button
                onClick={handleSaveTopicHeader}
                className="p-1.5 bg-[#3F8C62] text-white rounded-lg hover:bg-[#357A54] transition-colors"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => setIsEditingHeader(false)}
                className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">{topic.title}</h2>
              {topic.ege_number != null && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#3F8C62]/10 text-[#3F8C62] rounded-lg">
                  <Hash size={12} />
                  <span className="text-[10px] font-bold">Задание {topic.ege_number}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg">
                <Clock size={12} />
                <span className="text-[10px] font-bold">{topic.time_limit_minutes || 60} мин</span>
              </div>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                  topic.category === 'tutorial'
                    ? 'bg-blue-100 text-blue-700'
                    : topic.category === 'homework'
                    ? 'bg-violet-100 text-violet-700'
                    : topic.category === 'control'
                    ? 'bg-sky-100 text-sky-700'
                    : topic.category === 'math'
                    ? 'bg-emerald-100 text-emerald-700'
                    : topic.category === 'mock'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-orange-100 text-orange-700'
                )}
              >
                {topic.category === 'tutorial'
                  ? 'Разбор'
                  : topic.category === 'homework'
                  ? 'ДЗ'
                  : topic.category === 'control'
                  ? 'КР'
                  : topic.category === 'math'
                  ? 'Математика'
                  : topic.category === 'mock'
                  ? 'Пробник'
                  : 'Вариант'}
              </span>
              <button
                onClick={() => setIsEditingHeader(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Поиск задачи..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-[#3F8C62]/20 outline-none w-48 transition-all"
            />
          </div>
          <button
            onClick={() => setIsCardPreviewOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-[#3F8C62]/30 hover:bg-[#3F8C62]/5 text-gray-600 hover:text-[#3F8C62] px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <ImageIcon size={14} />
            Превью карточки
          </button>
          <button
            onClick={() =>
              setEditingTask({
                topic_id: topic.id,
                content_html: '',
                answer_type: 'single_number' as AnswerType,
                difficulty: 'easy' as TaskDifficulty,
              })
            }
            className="flex items-center gap-2 bg-[#3F8C62] hover:bg-[#357A54] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#3F8C62]/20"
          >
            <Plus size={14} />
            Добавить задачу
          </button>
        </div>
      </div>

      {/* Card visuals: preview + character picker + background picker */}
      {isCardPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <div className="text-sm font-black text-gray-900">Превью карточки</div>
                <div className="text-xs font-medium text-gray-400">Настройка фона и персонажа топика</div>
              </div>
              <select
                value={isCommonCourseCategory(editingTopic.category) ? 'common' : (editingTopic.course_type ?? 'year')}
                onChange={(e) => handleTopicFieldChange('course_type', e.target.value)}
                disabled={isCommonCourseCategory(editingTopic.category)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold disabled:text-gray-400"
              >
                <option value="year">Годовой</option>
                <option value="summer">Летний</option>
                <option value="common">Общий</option>
              </select>
              <button
                onClick={() => setIsCardPreviewOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-start gap-6 flex-wrap px-6 py-5 bg-gray-50/50">
          {/* Live card preview */}
          <div className="shrink-0">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Превью карточки
            </div>
            <div className="w-[260px] rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm">
              <div className="relative w-full h-[140px] bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                {editingTopic.background_url ? (
                  <img
                    src={
                      editingTopic.background_url.startsWith('/api/')
                        ? `${editingTopic.background_url}?v=${imageCacheBust}`
                        : editingTopic.background_url
                    }
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
                    <ImageIcon size={32} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Нет фона</span>
                  </div>
                )}
                {/* Character overlay */}
                {editingTopic.character_url && (
                  <img
                    src={editingTopic.character_url}
                    alt=""
                    className="absolute bottom-1 left-2 w-[58px] h-[58px] object-contain pointer-events-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]"
                  />
                )}
                {/* Number badge */}
                {topic.ege_number != null && (
                  <div className="absolute top-1 right-2 leading-none pointer-events-none">
                    <span className="block text-[34px] font-extrabold text-white tabular-nums tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]">
                      {topic.ege_number_end != null && topic.ege_number_end > topic.ege_number
                        ? `${topic.ege_number}-${topic.ege_number_end}`
                        : (topic.ege_number < 10 ? `0${topic.ege_number}` : topic.ege_number)}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2.5">
                <div className="text-[13px] font-bold text-gray-900 line-clamp-2 min-h-[34px]">
                  {topic.title || 'Название темы'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '40%' }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 tabular-nums">40%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-medium">X / Y выполнено</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                    Перейти
                    <ArrowRight size={10} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pickers */}
          <div className="flex-1 min-w-[260px] space-y-5 pt-1">
            {/* ── Character picker ── */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <User size={13} className="text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Персонаж</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {CHARACTER_PRESETS.map((p) => {
                  const active = editingTopic.character_url === p.url;
                  return (
                    <button
                      key={p.url}
                      onClick={() => handleSelectCharacter(p.url)}
                      title={p.label}
                      className={clsx(
                        'relative w-16 h-16 rounded-xl bg-white border-2 flex items-center justify-center overflow-hidden transition-all',
                        active
                          ? 'border-[#3F8C62] shadow-md shadow-[#3F8C62]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-contain p-1" />
                      {active && (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#3F8C62] text-white flex items-center justify-center">
                          <Check size={10} />
                        </span>
                      )}
                    </button>
                  );
                })}
                {editingTopic.character_url && (
                  <button
                    onClick={() => handleSelectCharacter(null)}
                    className="w-16 h-16 rounded-xl bg-white border-2 border-dashed border-gray-200 hover:border-red-300 hover:text-red-500 text-gray-400 flex flex-col items-center justify-center gap-0.5 transition-colors"
                    title="Без персонажа"
                  >
                    <X size={14} />
                    <span className="text-[8px] font-bold uppercase">Снять</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Background picker ── */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ImagePic size={13} className="text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Фон</span>
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                {BACKGROUND_PRESETS.map((p) => {
                  const active = editingTopic.background_url === p.url;
                  return (
                    <button
                      key={p.url}
                      onClick={() => handleSelectBackground(p.url)}
                      title={p.label}
                      className={clsx(
                        'relative w-20 h-14 rounded-xl bg-white border-2 overflow-hidden transition-all',
                        active
                          ? 'border-[#3F8C62] shadow-md shadow-[#3F8C62]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                      {active && (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#3F8C62] text-white flex items-center justify-center">
                          <Check size={10} />
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Uploaded background tile (если background_url указывает на upload) */}
                {editingTopic.has_image && editingTopic.background_url === uploadedBgUrl && (
                  <div
                    className="relative w-20 h-14 rounded-xl bg-white border-2 border-[#3F8C62] shadow-md shadow-[#3F8C62]/20 overflow-hidden"
                    title="Свой фон"
                  >
                    <img
                      src={`${uploadedBgUrl}?v=${imageCacheBust}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#3F8C62] text-white flex items-center justify-center">
                      <Check size={10} />
                    </span>
                  </div>
                )}

                {/* Upload tile */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageBusy}
                  className="w-20 h-14 rounded-xl bg-white border-2 border-dashed border-gray-200 hover:border-[#3F8C62] hover:text-[#3F8C62] text-gray-400 flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-60"
                  title="Загрузить свой фон"
                >
                  {imageBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span className="text-[8px] font-bold uppercase">Загрузить</span>
                </button>

                {/* Clear / delete buttons */}
                {editingTopic.background_url && editingTopic.background_url !== uploadedBgUrl && (
                  <button
                    onClick={() => handleSelectBackground(null)}
                    className="w-20 h-14 rounded-xl bg-white border-2 border-dashed border-gray-200 hover:border-red-300 hover:text-red-500 text-gray-400 flex flex-col items-center justify-center gap-0.5 transition-colors"
                    title="Без фона"
                  >
                    <X size={14} />
                    <span className="text-[8px] font-bold uppercase">Снять</span>
                  </button>
                )}
                {editingTopic.has_image && (
                  <button
                    onClick={handleImageDelete}
                    disabled={imageBusy}
                    className="w-20 h-14 rounded-xl bg-white border-2 border-red-200 hover:bg-red-50 text-red-500 flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-60"
                    title="Удалить загруженный файл"
                  >
                    <Trash2 size={14} />
                    <span className="text-[8px] font-bold uppercase">Удалить</span>
                  </button>
                )}
              </div>
              <div className="text-[10px] text-gray-400 font-medium leading-relaxed mt-2">
                Можно выбрать готовый фон или загрузить свой. PNG / JPG / WebP, до 4 МБ.
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}

      {draggedTaskId !== null && dragCursor && (() => {
        const draggedTask = tasks.find((item) => item.id === draggedTaskId);
        if (!draggedTask) return null;
        const answer = formatTaskCorrectAnswer(draggedTask);
        return (
          <div
            className="pointer-events-none fixed z-[80] w-[360px] -translate-y-5 translate-x-5 rounded-[22px] border border-[#3F8C62]/25 bg-white p-4 shadow-[0_34px_90px_rgba(15,23,20,0.28)] ring-1 ring-white/80"
            style={{ left: dragCursor.x, top: dragCursor.y }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-[#3F8C62]/12 text-sm font-black text-[#3F8C62]">
                {draggedTask.order_index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black leading-5 text-[#18251d]">
                  {draggedTask.title || 'Без названия'}
                </div>
                <div className="mt-1 truncate text-xs font-bold leading-4 text-[#667568]">
                  ЕГЭ {draggedTask.ege_number ?? '-'}{answer ? ` · Ответ: ${answer}` : ''}
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f0f5f0] text-base font-black text-[#3F8C62]">
                ⋮⋮
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tasks Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-gray-100">
              <th className="px-6 py-4 w-12"></th>
              <th className="px-4 py-4 w-24 text-center">№ в топике</th>
              <th className="px-6 py-4 w-16 text-center">№ ЕГЭ</th>
              <th className="px-6 py-4">Описание задачи</th>
              <th className="px-4 py-4 w-40">Ответ</th>
              <th className="px-6 py-4 w-32 text-center">Решение</th>
              <th className="px-6 py-4 w-32 text-center">План</th>
              <th className="px-6 py-4 w-32">Сложность</th>
              <th className="px-6 py-4 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredTasks.map((task, index) => {
              const isDragged = draggedTaskId === task.id;
              const isDropBefore = dragTarget?.index === index && dragTarget.position === 'before' && !isDragged;
              const isDropAfter = dragTarget?.index === index && dragTarget.position === 'after' && !isDragged;
              return (
                <tr
                  key={task.id}
                  draggable
                  onClick={() => {
                    if (skipTaskClickRef.current) return;
                    setEditingTask(task);
                  }}
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragOver={(e) => handleTaskDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={clsx(
                    'relative hover:bg-gray-50/50 transition-all group cursor-pointer',
                    isDragged && 'scale-[0.995] bg-white opacity-45 shadow-lg shadow-[#3F8C62]/20 ring-2 ring-[#3F8C62]/25',
                    isDropBefore && 'shadow-[inset_0_3px_0_#3F8C62]',
                    isDropAfter && 'shadow-[inset_0_-3px_0_#3F8C62]'
                  )}
                >
                  <td className="px-6 py-4 text-center">
                    <GripVertical
                      size={16}
                      className={clsx(
                        'mx-auto transition-all',
                        isDragged ? 'scale-125 text-[#3F8C62]' : 'text-gray-300 group-hover:text-[#3F8C62]'
                      )}
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#3F8C62]/10 px-2 text-xs font-black text-[#3F8C62]">
                      {task.order_index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-gray-400">
                      {(() => {
                        if (Array.isArray(task.sub_tasks) && task.sub_tasks.length > 0) {
                          const nums = [task.ege_number, ...task.sub_tasks.map((s: any) => s?.number)].filter((n): n is number => typeof n === 'number');
                          if (nums.length >= 2) return `${Math.min(...nums)}–${Math.max(...nums)}`;
                        }
                        return task.ege_number || '—';
                      })()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-[#3F8C62] transition-colors">
                        {task.title || 'Без названия'}
                      </p>
                      <div
                        className="text-[11px] text-gray-400 line-clamp-1"
                        dangerouslySetInnerHTML={{
                          __html: task.content_html.replace(/<[^>]*>?/gm, ''),
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {(() => {
                      const answer = formatTaskCorrectAnswer(task);
                      return answer ? (
                        <span
                          className="block max-w-[190px] truncate rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700"
                          title={answer}
                        >
                          {answer}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-300 uppercase">Нет</span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {task.full_solution_code ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold uppercase">
                        <Code2 size={10} /> Есть
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-300 uppercase">Нет</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {task.solution_steps && task.solution_steps.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">
                        <ListChecks size={10} /> {task.solution_steps.length} ш.
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-300 uppercase">Нет</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase',
                        task.difficulty === 'easy'
                          ? 'bg-emerald-100 text-emerald-700'
                          : task.difficulty === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      )}
                    >
                      {task.difficulty === 'easy'
                        ? 'Легкая'
                        : task.difficulty === 'medium'
                        ? 'Средняя'
                        : 'Сложная'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTask(task);
                        }}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-400 hover:text-[#3F8C62] transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(task.id);
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredTasks.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <ListChecks size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold text-gray-900">Задач пока нет</p>
            <p className="text-xs mt-1">Добавьте первую задачу в этот топик</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Edit Panel — replaces task list, full height
// ─────────────────────────────────────────────────────────────────────────────
function TaskEditPanel({
  task,
  onBack,
  onSave,
  apiKey,
}: {
  task: Partial<TaskAdmin>;
  onBack: () => void;
  onSave: (data: Partial<TaskAdmin>) => void;
  apiKey?: string;
}) {
  const [form, setForm] = useState({
    ege_number: task.ege_number || 1,
    title: task.title || '',
    content_html: task.content_html || '',
    difficulty: (task.difficulty || 'easy') as TaskDifficulty,
    answer_type: (task.answer_type || 'single_number') as AnswerType,
    correct_answer: formatAnswerForInput(task.correct_answer),
    solution_steps: task.solution_steps || [],
    full_solution_code: task.full_solution_code || '',
    sub_tasks: (task.sub_tasks || []) as Array<{
      number: number | null;
      content_html: string;
      answer_type: AnswerType;
      correct_answer: any;
    }>,
  });
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);
  const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(new Set());
  const [stepCodeOpen, setStepCodeOpen] = useState<Set<number>>(new Set());
  const [generateNotice, setGenerateNotice] = useState<'success' | 'error' | null>(null);
  const [generateError, setGenerateError] = useState('');
  const [graphEditorOpen, setGraphEditorOpen] = useState(false);
  const [geometryEditorOpen, setGeometryEditorOpen] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const generateStepsMutation = useGenerateSteps();

  const handleGenerateSteps = async () => {
    if (!task.id) return;
    setGenerateNotice(null);
    try {
      const res = await generateStepsMutation.mutateAsync(task.id);
      setForm(f => ({ ...f, solution_steps: res.steps }));
      setCollapsedSteps(new Set());
      setGenerateNotice('success');
      setTimeout(() => setGenerateNotice(null), 4000);
    } catch (err: any) {
      setGenerateError(err.message || 'Ошибка генерации');
      setGenerateNotice('error');
      setTimeout(() => setGenerateNotice(null), 6000);
    }
  };

  const toggleCollapse = (idx: number) => {
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleCode = (idx: number) => {
    setStepCodeOpen(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleSave = () => {
    const subTasksPayload = form.sub_tasks.length > 0
      ? form.sub_tasks.map(s => ({
          number: s.number,
          content_html: s.content_html,
          answer_type: s.answer_type,
          correct_answer: s.correct_answer ?? null,
        }))
      : null;
    onSave({
      ...task,
      ...form,
      correct_answer: parseAnswerInput(form.correct_answer ?? '', form.answer_type),
      sub_tasks: subTasksPayload,
    });
  };

  const uploadStepImage = async (stepIdx: number, file: File) => {
    if (!task.id) return;
    setUploadingStep(stepIdx);
    try {
      const token = localStorage.getItem('jwt_token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/tasks/${task.id}/steps/${stepIdx}/upload-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const newSteps = [...form.solution_steps];
      const step = { ...newSteps[stepIdx] };
      step.images = [...(step.images || []), data.url];
      newSteps[stepIdx] = step;
      setForm({ ...form, solution_steps: newSteps });
    } catch (e) {
      console.error(e);
    } finally {
      setUploadingStep(null);
    }
  };

  const removeStepImage = async (stepIdx: number, url: string) => {
    if (!task.id) return;
    try {
      const token = localStorage.getItem('jwt_token');
      await fetch(
        `/api/admin/tasks/${task.id}/steps/${stepIdx}/images?url=${encodeURIComponent(url)}`,
        { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch (e) {
      console.error(e);
    }
    const newSteps = [...form.solution_steps];
    const step = { ...newSteps[stepIdx] };
    step.images = (step.images || []).filter((i: string) => i !== url);
    newSteps[stepIdx] = step;
    setForm({ ...form, solution_steps: newSteps });
  };

  const addStep = () =>
    setForm({
      ...form,
      solution_steps: [...form.solution_steps, { title: '', explanation: '', code: '' }],
    });

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...form.solution_steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setForm({ ...form, solution_steps: newSteps });
  };

  const removeStep = (index: number) =>
    setForm({
      ...form,
      solution_steps: form.solution_steps.filter((_, i) => i !== index),
    });

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...form.solution_steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setForm({ ...form, solution_steps: newSteps });
  };

  const Field = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );

  const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/25 focus:border-[#3F8C62]/40 transition-all';
  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1';

  const hasSteps = form.solution_steps.length > 0;

  // Left panel content
  const LeftPanel = (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-w-0">

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>№ ЕГЭ</label>
            <select
              value={form.sub_tasks.length >= 2 && form.ege_number === 19 ? '19-21' : String(form.ege_number)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '19-21') {
                  setForm({
                    ...form,
                    ege_number: 19,
                    sub_tasks: form.sub_tasks.length >= 2 ? form.sub_tasks : [
                      { number: 20, content_html: '', answer_type: 'single_number' as AnswerType, correct_answer: '' },
                      { number: 21, content_html: '', answer_type: 'single_number' as AnswerType, correct_answer: '' },
                    ],
                  });
                } else {
                  setForm({ ...form, ege_number: parseInt(v) || 0, sub_tasks: [] });
                }
              }}
              className={inputCls}
            >
              {Array.from({ length: 27 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>№{i + 1}</option>
              ))}
              <option value="19-21">№19-21 (теория игр)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Сложность</label>
            <select value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as TaskDifficulty })}
              className={inputCls}>
              <option value="easy">Лёгкая</option>
              <option value="medium">Средняя</option>
              <option value="hard">Сложная</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Тип ответа</label>
            <select value={form.answer_type}
              onChange={(e) => setForm({ ...form, answer_type: e.target.value as AnswerType })}
              className={inputCls}>
              <option value="single_number">Число</option>
              <option value="text">Текст</option>
              <option value="pair">Пара чисел</option>
              <option value="table">Таблица</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Правильный ответ</label>
            <input type="text" value={form.correct_answer}
              onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}
              placeholder="Значение..."
              className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Тема / Раздел (опционально)</label>
          <input type="text" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Напр: Теория игр, Базы данных"
            className={inputCls} />
        </div>
      </div>

      {/* Sub-tasks editor (composite e.g. 19-21) */}
      {form.sub_tasks.length > 0 && (
        <div className="bg-amber-50/40 border-2 border-amber-200 rounded-xl p-4 space-y-3">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            Подзадания (составное задание №{form.ege_number}-{form.sub_tasks[form.sub_tasks.length - 1]?.number ?? form.ege_number})
          </div>
          {form.sub_tasks.map((sub, sIdx) => (
            <div key={sIdx} className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Номер</label>
                  <input type="number" value={sub.number ?? ''}
                    onChange={(e) => {
                      const n = e.target.value ? parseInt(e.target.value) : null;
                      setForm({
                        ...form,
                        sub_tasks: form.sub_tasks.map((s, i) => i === sIdx ? { ...s, number: n } : s),
                      });
                    }}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Тип ответа</label>
                  <select value={sub.answer_type}
                    onChange={(e) => setForm({
                      ...form,
                      sub_tasks: form.sub_tasks.map((s, i) => i === sIdx ? { ...s, answer_type: e.target.value as AnswerType } : s),
                    })}
                    className={inputCls}>
                    <option value="single_number">Число</option>
                    <option value="text">Текст</option>
                    <option value="pair">Пара чисел</option>
                    <option value="table">Таблица</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ответ</label>
                  <input type="text"
                    value={formatAnswerForInput(sub.correct_answer)}
                    onChange={(e) => setForm({
                      ...form,
                      sub_tasks: form.sub_tasks.map((s, i) => i === sIdx ? { ...s, correct_answer: parseAnswerInput(e.target.value, s.answer_type) } : s),
                    })}
                    placeholder="напр. 8 22 23"
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Текст подзадания</label>
                <textarea value={sub.content_html}
                  onChange={(e) => setForm({
                    ...form,
                    sub_tasks: form.sub_tasks.map((s, i) => i === sIdx ? { ...s, content_html: e.target.value } : s),
                  })}
                  rows={4}
                  className={`${inputCls} font-mono text-xs resize-y`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content HTML — rich text editor */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className={`${labelCls} block`}>Текст задачи</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGeometryEditorOpen(true)}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
            >
              SVG-фигура
            </button>
            <button
              type="button"
              onClick={() => setGraphEditorOpen(true)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
            >
              SVG-график
            </button>
          </div>
        </div>
        <RichTextEditor
          value={form.content_html}
          onChange={(html) => setForm((f) => ({ ...f, content_html: html }))}
          apiKey={apiKey}
          taskId={task.id}
        />
        <GraphSvgEditor
          open={graphEditorOpen}
          onClose={() => setGraphEditorOpen(false)}
          onInsert={(svg) => setForm((f) => ({ ...f, content_html: `${f.content_html}\n${svg}` }))}
        />
        <GeometrySvgEditor
          open={geometryEditorOpen}
          onClose={() => setGeometryEditorOpen(false)}
          onInsert={(svg) => setForm((f) => ({ ...f, content_html: `${f.content_html}\n${svg}` }))}
        />
      </div>

      {/* Solution code — CodeMirror */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <FileCode2 size={12} className="text-gray-400" />
          <span className={labelCls}>Полный код решения (Python)</span>
        </div>
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <CodeMirror
            value={form.full_solution_code}
            onChange={(val) => setForm({ ...form, full_solution_code: val })}
            extensions={[python()]}
            theme={githubLight}
            placeholder="# Вставьте полный код решения здесь..."
            basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: true }}
            style={{ fontSize: '13px' }}
            minHeight="160px"
          />
        </div>
      </div>
    </div>
  );

  // Right panel — steps
  const RightPanel = (
    <div className="w-1/2 shrink-0 overflow-y-auto p-4 border-l border-gray-100">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <ListChecks size={12} className="text-gray-400" />
        <span className={labelCls}>
          Шаги решения
          {form.solution_steps.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px]">
              {form.solution_steps.length}
            </span>
          )}
        </span>
        <button
          onClick={handleGenerateSteps}
          disabled={!task.id || generateStepsMutation.isPending}
          title={task.id ? "Сгенерировать шаги с помощью ИИ на основе похожих задач" : "Сохраните задачу перед генерацией"}
          className={clsx(
            "ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border",
            generateStepsMutation.isPending
              ? "bg-purple-50 text-purple-400 border-purple-200 cursor-wait"
              : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300"
          )}
        >
          {generateStepsMutation.isPending
            ? <><Loader2 size={11} className="animate-spin" /> Генерация...</>
            : <><Sparkles size={11} /> ИИ</>
          }
        </button>
      </div>

      {/* Generation feedback */}
      {generateNotice === 'success' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium mb-3">
          <CheckCircle2 size={13} className="shrink-0" />
          Шаги сгенерированы. Проверьте и сохраните.
        </div>
      )}
      {generateNotice === 'error' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium mb-3">
          <AlertCircle size={13} className="shrink-0" />
          {generateError}
        </div>
      )}

      <div className="space-y-2">
        {form.solution_steps.map((step, idx) => {
          const isCollapsed = collapsedSteps.has(idx);
          const isCodeOpen = stepCodeOpen.has(idx) || !!step.code;
          return (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Step header — always visible, click to collapse */}
              <div
                className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none hover:bg-gray-50 transition-colors"
                onClick={() => toggleCollapse(idx)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {step.title || <span className="text-gray-400 italic font-normal">Без заголовка</span>}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => moveStep(idx, 'down')} disabled={idx === form.solution_steps.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                    <ChevronDown size={13} />
                  </button>
                  <button onClick={() => removeStep(idx)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <span className="p-1 text-gray-300">
                    {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </span>
                </div>
              </div>

              {/* Step body — collapsible */}
              {!isCollapsed && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
                  <input type="text" value={step.title}
                    onChange={(e) => updateStep(idx, 'title', e.target.value)}
                    placeholder="Заголовок шага..."
                    className="w-full mt-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all" />
                  <textarea value={step.explanation}
                    onChange={(e) => updateStep(idx, 'explanation', e.target.value)}
                    placeholder="Объяснение шага..."
                    rows={6}
                    className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all resize-y leading-relaxed" />

                  {/* Code — toggled */}
                  {isCodeOpen ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                          <Code2 size={9} /> Код Python
                        </span>
                        {!step.code && (
                          <button onClick={() => toggleCode(idx)}
                            className="text-[9px] text-gray-400 hover:text-red-400 transition-colors">
                            Убрать
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg overflow-hidden border border-gray-200">
                        <CodeMirror
                          value={step.code}
                          onChange={(val) => updateStep(idx, 'code', val)}
                          extensions={[python()]}
                          theme={githubLight}
                          placeholder="# Код шага..."
                          basicSetup={{ lineNumbers: true, foldGutter: false }}
                          style={{ fontSize: '12px' }}
                          minHeight="80px"
                        />
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => toggleCode(idx)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-[#3F8C62] transition-colors border border-dashed border-gray-200 hover:border-[#3F8C62]/40 rounded-lg px-3 py-1.5 w-full justify-center">
                      <Code2 size={11} /> Добавить код
                    </button>
                  )}

                  {/* Images */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                        <ImageIcon size={9} /> Картинки {(step.images || []).length > 0 && `(${(step.images || []).length})`}
                      </span>
                      <button type="button" onClick={() => fileInputRefs.current[idx]?.click()}
                        disabled={uploadingStep === idx || !task.id}
                        className="flex items-center gap-0.5 text-[10px] font-bold text-[#3F8C62] hover:text-[#357A54] disabled:opacity-50 transition-colors">
                        {uploadingStep === idx ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                        Добавить
                      </button>
                      <input ref={(el) => { fileInputRefs.current[idx] = el; }} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStepImage(idx, f); e.target.value = ''; }} />
                    </div>
                    {(step.images || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(step.images || []).map((url: string, imgIdx: number) => (
                          <div key={imgIdx} className="relative group/img w-20 h-14 rounded-lg overflow-hidden border border-gray-200">
                            <img src={url.startsWith('http') ? url : `/api${url}`} alt="" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeStepImage(idx, url)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <X size={8} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add step button — always after last step */}
        <button
          onClick={addStep}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 hover:border-[#3F8C62]/50 rounded-xl text-sm font-bold text-gray-400 hover:text-[#3F8C62] transition-all hover:bg-[#3F8C62]/5 mt-1"
        >
          <Plus size={15} />
          {form.solution_steps.length === 0 ? 'Добавить первый шаг' : 'Добавить шаг'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#F8F7F4]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={15} />
            К списку задач
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-xs text-gray-400">
            {task.id ? `Задача #${task.id}` : 'Новая задача'}
            {form.ege_number > 0 && <span className="ml-2 font-bold text-gray-600">№{form.ege_number} ЕГЭ</span>}
          </span>
        </div>
        <button onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-[#3F8C62]/20">
          <Save size={14} />
          Сохранить
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {LeftPanel}
        {hasSteps && RightPanel}
        {!hasSteps && (
          // No steps yet — show "add steps" strip at the right edge
          <div className="w-12 shrink-0 border-l border-gray-100 flex flex-col items-center pt-4">
            <button onClick={addStep}
              title="Добавить шаги решения"
              className="flex flex-col items-center gap-1 p-2 text-gray-300 hover:text-[#3F8C62] transition-colors group">
              <ListChecks size={18} />
              <Plus size={12} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
