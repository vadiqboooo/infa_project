import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Pencil,
  Trash2,
  Eye,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Code2,
  ArrowUp,
  ArrowDown,
  Search,
  Clock,
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
  const [search, setSearch] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  // Sync internal state when prop updates from server
  React.useEffect(() => {
    setEditingTopic(topic);
  }, [topic]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t =>
        search === "" ||
        (t.title && t.title.toLowerCase().includes(search.toLowerCase())) ||
        (t.ege_number && String(t.ege_number).includes(search))
    );
  }, [tasks, search]);

  const handleMoveTask = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const fromTask = filteredTasks[fromIndex];
    const toTask = filteredTasks[toIndex];
    // Swap order_index values to reorder tasks
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
    if (fromIndex !== -1 && fromIndex !== toIndex) {
      handleMoveTask(fromIndex, toIndex);
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleTopicFieldChange = (field: keyof TopicAdmin, value: any) => {
    setEditingTopic((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveTopicHeader = () => {
    onSaveTopic(editingTopic);
    setIsEditingHeader(false);
  };

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
                  onChange={(e) => handleTopicFieldChange('time_limit_minutes', parseInt(e.target.value) || 0)}
                  className="w-16 bg-transparent text-sm font-bold focus:outline-none"
                  placeholder="Мин"
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase">Мин</span>
              </div>
              <select
                value={editingTopic.category}
                onChange={(e) => handleTopicFieldChange('category', e.target.value as TopicCategory)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold"
              >
                <option value="tutorial">Разбор</option>
                <option value="homework">Домашняя работа</option>
                <option value="variants">Вариант</option>
              </select>
              <select
                value={editingTopic.is_mock ? 'mock' : 'regular'}
                onChange={(e) => handleTopicFieldChange('is_mock', e.target.value === 'mock')}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold"
              >
                <option value="regular">Обычная тема</option>
                <option value="mock">Пробник (Mock)</option>
              </select>
              <button onClick={handleSaveTopicHeader} className="p-1.5 bg-[#3F8C62] text-white rounded-lg hover:bg-[#357A54] transition-colors">
                <Save size={16} />
              </button>
              <button onClick={() => setIsEditingHeader(false)} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition-colors">
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
              <span className={clsx(
                "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                topic.category === 'tutorial' ? "bg-blue-100 text-blue-700" :
                topic.category === 'homework' ? "bg-violet-100 text-violet-700" : "bg-orange-100 text-orange-700"
              )}>
                {topic.category === 'tutorial' ? 'Разбор' : topic.category === 'homework' ? 'ДЗ' : 'Вариант'}
              </span>
              {topic.is_mock && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  Пробник
                </span>
              )}
              <button onClick={() => setIsEditingHeader(true)} className="p-1.5 text-gray-400 hover:text-gray-600">
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
                onClick={() => setEditingTask({ topic_id: topic.id, content_html: '', answer_type: 'single_number' as AnswerType, difficulty: 'easy' as TaskDifficulty })}
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
                  <GripVertical size={14} className={clsx('mx-auto', isDragged ? 'text-[#3F8C62]' : 'text-gray-300')} />
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-xs font-bold text-gray-400">{task.ege_number || '—'}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-[#3F8C62] transition-colors">
                        {task.title || 'Без названия'}
                    </p>
                    <div className="text-[11px] text-gray-400 line-clamp-1" dangerouslySetInnerHTML={{ __html: task.content_html.replace(/<[^>]*>?/gm, '') }} />
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
                  <span className={clsx(
                    "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase",
                    task.difficulty === 'easy' ? "bg-emerald-100 text-emerald-700" :
                    task.difficulty === 'medium' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {task.difficulty === 'easy' ? 'Легкая' : task.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
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
            ))}
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

      {/* Task Modal (Full content editing) */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(data) => {
            onSaveTask(data);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

function TaskEditModal({ task, onClose, onSave }: { task: Partial<TaskAdmin>, onClose: () => void, onSave: (data: Partial<TaskAdmin>) => void }) {
    const [form, setForm] = useState({
        ege_number: task.ege_number || 1,
        title: task.title || "",
        content_html: task.content_html || "",
        difficulty: task.difficulty || "easy" as TaskDifficulty,
        answer_type: task.answer_type || "single_number" as AnswerType,
        correct_answer: (task.correct_answer as any)?.val || "",
        solution_steps: task.solution_steps || [],
        full_solution_code: task.full_solution_code || ""
    });

    const handleSave = () => {
        onSave({
            ...task,
            ...form,
            correct_answer: { val: form.correct_answer }
        });
    };

    const addStep = () => {
        setForm({
            ...form,
            solution_steps: [...form.solution_steps, { title: "", explanation: "", code: "" }]
        });
    };

    const updateStep = (index: number, field: string, value: string) => {
        const newSteps = [...form.solution_steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setForm({ ...form, solution_steps: newSteps });
    };

    const removeStep = (index: number) => {
        setForm({
            ...form,
            solution_steps: form.solution_steps.filter((_, i) => i !== index)
        });
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newSteps = [...form.solution_steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newSteps.length) return;
        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
        setForm({ ...form, solution_steps: newSteps });
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">{task.id ? 'Редактировать задачу' : 'Новая задача'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={20} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">№ ЕГЭ</label>
                                <input 
                                    type="number" 
                                    value={form.ege_number} 
                                    onChange={e => setForm({...form, ege_number: parseInt(e.target.value)})}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Сложность</label>
                                <select 
                                    value={form.difficulty} 
                                    onChange={e => setForm({...form, difficulty: e.target.value as TaskDifficulty})}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all"
                                >
                                    <option value="easy">Лёгкая</option>
                                    <option value="medium">Средняя</option>
                                    <option value="hard">Сложная</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Название (опционально)</label>
                            <input 
                                type="text" 
                                value={form.title} 
                                onChange={e => setForm({...form, title: e.target.value})}
                                placeholder="Напр: Задача на графы"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Текст задачи (HTML)</label>
                            <textarea 
                                value={form.content_html} 
                                onChange={e => setForm({...form, content_html: e.target.value})}
                                rows={4}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Тип ответа</label>
                                <select 
                                    value={form.answer_type} 
                                    onChange={e => setForm({...form, answer_type: e.target.value as AnswerType})}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all"
                                >
                                    <option value="single_number">Число</option>
                                    <option value="text">Текст</option>
                                    <option value="pair">Пара чисел</option>
                                    <option value="table">Таблица</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Правильный ответ</label>
                                <input 
                                    type="text" 
                                    value={form.correct_answer} 
                                    onChange={e => setForm({...form, correct_answer: e.target.value})}
                                    placeholder="Значение..."
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Полный код решения (Python)</label>
                            <div className="relative">
                                <Code2 className="absolute right-3 top-3 text-gray-300" size={16} />
                                <textarea 
                                    value={form.full_solution_code} 
                                    onChange={e => setForm({...form, full_solution_code: e.target.value})}
                                    rows={5}
                                    placeholder="Вставьте полный код решения здесь..."
                                    className="w-full px-4 py-2.5 bg-gray-900 text-emerald-400 border border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/40 transition-all font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-900">Пошаговое решение</h4>
                            <button 
                                onClick={addStep}
                                className="flex items-center gap-1.5 text-[#3F8C62] hover:text-[#357A54] text-xs font-bold transition-colors"
                            >
                                <Plus size={14} />
                                Добавить шаг
                            </button>
                        </div>

                        <div className="space-y-4">
                            {form.solution_steps.map((step, idx) => (
                                <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative group/step">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-gray-300 uppercase">Шаг {idx + 1}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20"><ChevronUp size={14} /></button>
                                            <button onClick={() => moveStep(idx, 'down')} disabled={idx === form.solution_steps.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20"><ChevronDown size={14} /></button>
                                            <button onClick={() => removeStep(idx)} className="p-1 text-gray-400 hover:text-red-500 ml-1"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <input 
                                            type="text" 
                                            value={step.title}
                                            onChange={e => updateStep(idx, 'title', e.target.value)}
                                            placeholder="Заголовок шага"
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#3F8C62] transition-all"
                                        />
                                        <textarea 
                                            value={step.explanation}
                                            onChange={e => updateStep(idx, 'explanation', e.target.value)}
                                            placeholder="Объяснение..."
                                            rows={2}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#3F8C62] transition-all"
                                        />
                                        <div className="relative">
                                            <Code2 className="absolute right-3 top-3 text-gray-300" size={14} />
                                            <textarea 
                                                value={step.code}
                                                onChange={e => updateStep(idx, 'code', e.target.value)}
                                                placeholder="Код (опционально)..."
                                                rows={2}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#3F8C62] transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {form.solution_steps.length === 0 && (
                                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Решение не добавлено</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Отмена</button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#3F8C62]/20">Сохранить</button>
                </div>
            </div>
        </div>
    );
}
