import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft,
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
  Eye,
  EyeOff,
  FileCode2,
  Hash,
  AlignLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { TopicAdmin, TaskAdmin, TopicCategory, TaskDifficulty, AnswerType } from '../../api/types';

interface TopicDetailProps {
  topic: TopicAdmin;
  tasks: TaskAdmin[];
  onBack: () => void;
  onSaveTopic: (data: Partial<TopicAdmin>) => void;
  onSaveTask: (data: Partial<TaskAdmin>) => void;
  onDeleteTask: (id: number) => void;
}

export function TopicDetail({
  topic,
  tasks,
  onBack,
  onSaveTopic,
  onSaveTask,
  onDeleteTask,
}: TopicDetailProps) {
  const [editingTopic, setEditingTopic] = useState(topic);
  const [editingTask, setEditingTask] = useState<Partial<TaskAdmin> | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [search, setSearch] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  React.useEffect(() => {
    setEditingTopic(topic);
  }, [topic]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        search === '' ||
        (t.title && t.title.toLowerCase().includes(search.toLowerCase())) ||
        (t.ege_number && String(t.ege_number).includes(search))
    );
  }, [tasks, search]);

  const handleMoveTask = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const fromTask = filteredTasks[fromIndex];
    const toTask = filteredTasks[toIndex];
    onSaveTask({ ...fromTask, order_index: toTask.order_index });
    onSaveTask({ ...toTask, order_index: fromTask.order_index });
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedTaskId === null) return;
    const fromIndex = filteredTasks.findIndex((t) => t.id === draggedTaskId);
    if (fromIndex !== -1 && fromIndex !== toIndex) handleMoveTask(fromIndex, toIndex);
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => setDraggedTaskId(null);

  const handleTopicFieldChange = (field: keyof TopicAdmin, value: any) => {
    setEditingTopic((prev) => ({ ...prev, [field]: value }));
  };

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
                onChange={(e) =>
                  handleTopicFieldChange('category', e.target.value as TopicCategory)
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold"
              >
                <option value="tutorial">Разбор</option>
                <option value="homework">Домашняя работа</option>
                <option value="control">Контрольная работа</option>
                <option value="variants">Вариант</option>
                <option value="mock">Пробник</option>
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

      {/* Tasks Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-gray-100">
              <th className="px-6 py-4 w-12"></th>
              <th className="px-6 py-4 w-16 text-center">№ ЕГЭ</th>
              <th className="px-6 py-4">Описание задачи</th>
              <th className="px-6 py-4 w-32 text-center">Решение</th>
              <th className="px-6 py-4 w-32 text-center">План</th>
              <th className="px-6 py-4 w-32">Сложность</th>
              <th className="px-6 py-4 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredTasks.map((task, index) => {
              const isDragged = draggedTaskId === task.id;
              return (
                <tr
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={clsx(
                    'hover:bg-gray-50/50 transition-colors group cursor-move',
                    isDragged && 'opacity-50 bg-[#3F8C62]/5'
                  )}
                >
                  <td className="px-6 py-4 text-center">
                    <GripVertical
                      size={14}
                      className={clsx('mx-auto', isDragged ? 'text-[#3F8C62]' : 'text-gray-300')}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-gray-400">{task.ege_number || '—'}</span>
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
                        onClick={() => setEditingTask(task)}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-400 hover:text-[#3F8C62] transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
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
}: {
  task: Partial<TaskAdmin>;
  onBack: () => void;
  onSave: (data: Partial<TaskAdmin>) => void;
}) {
  const [form, setForm] = useState({
    ege_number: task.ege_number || 1,
    title: task.title || '',
    content_html: task.content_html || '',
    difficulty: (task.difficulty || 'easy') as TaskDifficulty,
    answer_type: (task.answer_type || 'single_number') as AnswerType,
    correct_answer: (task.correct_answer as any)?.val ?? '',
    solution_steps: task.solution_steps || [],
    full_solution_code: task.full_solution_code || '',
  });
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSave = () => {
    onSave({ ...task, ...form, correct_answer: { val: form.correct_answer } });
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

  return (
    <div className="flex flex-col h-full bg-[#F8F7F4]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={15} />
            К списку задач
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-xs text-gray-400">
            {task.id ? `Задача #${task.id}` : 'Новая задача'}
            {form.ege_number > 0 && <span className="ml-2 font-bold text-gray-600">№{form.ege_number} ЕГЭ</span>}
          </span>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-[#3F8C62]/20"
        >
          <Save size={14} />
          Сохранить
        </button>
      </div>

      {/* Body — two columns */}
      <div className="flex-1 overflow-hidden flex gap-0">

        {/* Left: content + code */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-w-0">

          {/* Content HTML */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={labelCls}>Текст задачи (HTML)</span>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className={clsx(
                  'flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors',
                  showPreview ? 'bg-[#3F8C62]/10 text-[#3F8C62]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                {showPreview ? 'Скрыть' : 'Предпросмотр'}
              </button>
            </div>
            <div className={clsx('gap-3', showPreview ? 'grid grid-cols-2' : '')}>
              <textarea
                value={form.content_html}
                onChange={(e) => setForm({ ...form, content_html: e.target.value })}
                rows={showPreview ? 18 : 12}
                placeholder="<p>Текст задачи...</p>"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/25 transition-all resize-y leading-relaxed"
              />
              {showPreview && (
                <div className="border border-gray-200 rounded-lg p-3 bg-white overflow-auto">
                  <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: form.content_html }} />
                </div>
              )}
            </div>
          </div>

          {/* Solution code */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <FileCode2 size={12} className="text-gray-400" />
              <span className={labelCls}>Полный код решения (Python)</span>
            </div>
            <textarea
              value={form.full_solution_code}
              onChange={(e) => setForm({ ...form, full_solution_code: e.target.value })}
              rows={10}
              placeholder="# Вставьте полный код решения здесь..."
              spellCheck={false}
              className="w-full px-3 py-2 bg-gray-900 text-emerald-400 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/40 transition-all resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Right: meta + steps */}
        <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-3 border-l border-gray-100">

          {/* Meta fields */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>№ ЕГЭ</label>
                <input type="number" value={form.ege_number}
                  onChange={(e) => setForm({ ...form, ege_number: parseInt(e.target.value) || 0 })}
                  className={inputCls} />
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
            <div>
              <label className={labelCls}>Название (опционально)</label>
              <input type="text" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Напр: Задача на графы"
                className={inputCls} />
            </div>
          </div>

          {/* Solution steps */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <ListChecks size={12} className="text-gray-400" />
                <span className={labelCls}>
                  Шаги решения
                  {form.solution_steps.length > 0 && (
                    <span className="ml-1.5 px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px]">
                      {form.solution_steps.length}
                    </span>
                  )}
                </span>
              </div>
              <button onClick={addStep}
                className="flex items-center gap-1 text-[11px] font-bold text-[#3F8C62] hover:text-[#357A54] transition-colors">
                <Plus size={12} /> Добавить
              </button>
            </div>

            <div className="space-y-3">
              {form.solution_steps.map((step, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Шаг {idx + 1}</span>
                    <div className="flex items-center gap-0.5">
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
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <input type="text" value={step.title}
                      onChange={(e) => updateStep(idx, 'title', e.target.value)}
                      placeholder="Заголовок..."
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all" />
                    <textarea value={step.explanation}
                      onChange={(e) => updateStep(idx, 'explanation', e.target.value)}
                      placeholder="Объяснение..."
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all resize-y" />
                    <textarea value={step.code}
                      onChange={(e) => updateStep(idx, 'code', e.target.value)}
                      placeholder="# Код..."
                      rows={3}
                      spellCheck={false}
                      className="w-full px-2.5 py-1.5 bg-gray-900 text-emerald-400 border border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/30 transition-all resize-y" />

                    {/* Images */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                          <ImageIcon size={9} /> Картинки {(step.images || []).length > 0 && `(${(step.images || []).length})`}
                        </span>
                        <button type="button" onClick={() => fileInputRefs.current[idx]?.click()}
                          disabled={uploadingStep === idx || !task.id}
                          className="flex items-center gap-0.5 text-[10px] font-bold text-[#3F8C62] hover:text-[#357A54] disabled:opacity-50">
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
                </div>
              ))}

              {form.solution_steps.length === 0 && (
                <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
                  <p className="text-[11px] text-gray-400">Шаги не добавлены</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
