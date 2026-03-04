import React, { useState } from 'react';
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
} from 'lucide-react';
import { clsx } from 'clsx';

export interface SolutionStep {
  title: string;
  explanation: string;
  code: string;
}

export interface TopicTask {
  id: string;
  egeNumber: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'number' | 'text' | 'choice';
  answer: string;
  solutionSteps?: SolutionStep[];
}

export interface TopicData {
  id: string;
  name: string;
  category: 'разбор' | 'домашняя работа' | 'вариант';
  egeNumbers: string;
  description: string;
  tasks: TopicTask[];
}

interface TopicDetailProps {
  topic: TopicData;
  onBack: () => void;
  onSave: (topic: TopicData) => void;
}

export function TopicDetail({ topic, onBack, onSave }: TopicDetailProps) {
  const [editingTopic, setEditingTopic] = useState<TopicData>({ ...topic, tasks: [...topic.tasks] });
  const [previewTask, setPreviewTask] = useState<TopicTask | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const handleTopicFieldChange = (field: keyof TopicData, value: string) => {
    setEditingTopic((prev) => ({ ...prev, [field]: value }));
  };

  const handleTaskFieldChange = (taskId: string, field: keyof TopicTask, value: string) => {
    setEditingTopic((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)),
    }));
  };

  const handleAddTask = () => {
    const newTask: TopicTask = {
      id: `new-${Date.now()}`,
      egeNumber: editingTopic.egeNumbers.split(',')[0]?.trim() || '1',
      title: 'Новая задача',
      description: '',
      difficulty: 'easy',
      type: 'number',
      answer: '',
    };
    setEditingTopic((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    setEditingTaskId(newTask.id);
    setExpandedTaskId(newTask.id);
  };

  const handleDeleteTask = (taskId: string) => {
    setEditingTopic((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    if (editingTaskId === taskId) setEditingTaskId(null);
    if (expandedTaskId === taskId) setExpandedTaskId(null);
  };

  /* ─── Solution Steps helpers ─── */

  const getTaskSteps = (taskId: string): SolutionStep[] => {
    return editingTopic.tasks.find((t) => t.id === taskId)?.solutionSteps || [];
  };

  const updateTaskSteps = (taskId: string, steps: SolutionStep[]) => {
    setEditingTopic((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, solutionSteps: steps } : t
      ),
    }));
  };

  const handleAddStep = (taskId: string) => {
    const steps = getTaskSteps(taskId);
    updateTaskSteps(taskId, [
      ...steps,
      { title: `Шаг ${steps.length + 1}`, explanation: '', code: '' },
    ]);
  };

  const handleStepFieldChange = (
    taskId: string,
    stepIndex: number,
    field: keyof SolutionStep,
    value: string
  ) => {
    const steps = [...getTaskSteps(taskId)];
    steps[stepIndex] = { ...steps[stepIndex], [field]: value };
    updateTaskSteps(taskId, steps);
  };

  const handleDeleteStep = (taskId: string, stepIndex: number) => {
    const steps = getTaskSteps(taskId).filter((_, i) => i !== stepIndex);
    updateTaskSteps(taskId, steps);
  };

  const handleMoveStep = (taskId: string, stepIndex: number, direction: 'up' | 'down') => {
    const steps = [...getTaskSteps(taskId)];
    const target = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (target < 0 || target >= steps.length) return;
    [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
    updateTaskSteps(taskId, steps);
  };

  const difficultyLabel = (d: string) =>
    d === 'easy' ? 'Базовый' : d === 'medium' ? 'Повышенный' : 'Высокий';

  const difficultyColor = (d: string) =>
    d === 'easy'
      ? 'bg-emerald-100 text-emerald-700'
      : d === 'medium'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';

  return (
    <div className="flex flex-col h-full">
      {/* Header with inline name + category + save */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
          Назад
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <input
          type="text"
          value={editingTopic.name}
          onChange={(e) => handleTopicFieldChange('name', e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 border border-transparent hover:border-gray-200 focus:border-[#3F8C62] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#3F8C62] bg-transparent transition-colors"
        />
        <select
          value={editingTopic.category}
          onChange={(e) => handleTopicFieldChange('category', e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white shrink-0"
        >
          <option value="разбор">Разбор</option>
          <option value="домашняя работа">Домашняя работа</option>
          <option value="вариант">Вариант</option>
        </select>
        <button
          onClick={() => onSave(editingTopic)}
          className="flex items-center gap-2 px-4 py-2 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-lg text-sm transition-colors shrink-0"
        >
          <Save size={14} />
          Сохранить
        </button>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {editingTopic.tasks.length} задач в топике
            </p>
            <button
              onClick={handleAddTask}
              className="flex items-center gap-2 px-3 py-2 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-lg text-sm transition-colors"
            >
              <Plus size={14} />
              Добавить задачу
            </button>
          </div>

          {editingTopic.tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const isEditing = editingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="border border-gray-200 rounded-xl bg-white overflow-hidden"
              >
                {/* Task row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <GripVertical size={14} className="text-gray-300 shrink-0" />
                  <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-600 shrink-0">
                    {task.egeNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 truncate">{task.description || 'Нет описания'}</p>
                  </div>
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs shrink-0', difficultyColor(task.difficulty))}>
                    {difficultyLabel(task.difficulty)}
                  </span>
                  {(task.solutionSteps?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-600 shrink-0">
                      <Code2 size={12} />
                      {task.solutionSteps!.length} {task.solutionSteps!.length === 1 ? 'шаг' : task.solutionSteps!.length < 5 ? 'шага' : 'шагов'}
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTask(task);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"
                      title="Предпросмотр"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTaskId(isEditing ? null : task.id);
                        setExpandedTaskId(task.id);
                      }}
                      className={clsx(
                        'p-1.5 transition-colors rounded-md',
                        isEditing
                          ? 'text-[#3F8C62] bg-[#3F8C62]/10'
                          : 'text-gray-400 hover:text-[#3F8C62] hover:bg-[#3F8C62]/5'
                      )}
                      title="Редактировать"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                      title="Удалить"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400 shrink-0" />
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50">
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Название</label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleTaskFieldChange(task.id, 'title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Номер ЕГЭ</label>
                          <input
                            type="text"
                            value={task.egeNumber}
                            onChange={(e) => handleTaskFieldChange(task.id, 'egeNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Сложность</label>
                          <select
                            value={task.difficulty}
                            onChange={(e) => handleTaskFieldChange(task.id, 'difficulty', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white"
                          >
                            <option value="easy">Базовый</option>
                            <option value="medium">Повышенный</option>
                            <option value="hard">Высокий</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Тип ответа</label>
                          <select
                            value={task.type}
                            onChange={(e) => handleTaskFieldChange(task.id, 'type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white"
                          >
                            <option value="number">Число</option>
                            <option value="text">Текст</option>
                            <option value="choice">Выбор</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Правильный ответ</label>
                          <input
                            type="text"
                            value={task.answer}
                            onChange={(e) => handleTaskFieldChange(task.id, 'answer', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Описание задачи</label>
                          <textarea
                            value={task.description}
                            onChange={(e) => handleTaskFieldChange(task.id, 'description', e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white resize-none"
                          />
                        </div>

                        {/* Solution steps editor */}
                        <div className="col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Code2 size={13} className="text-indigo-500" />
                              Пошаговое решение
                            </label>
                            <span className="text-xs text-gray-400">
                              {getTaskSteps(task.id).length} {getTaskSteps(task.id).length === 1 ? 'шаг' : getTaskSteps(task.id).length < 5 ? 'шага' : 'шагов'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {getTaskSteps(task.id).map((step, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-xs text-indigo-600 shrink-0">
                                      {index + 1}
                                    </span>
                                    <span className="text-xs text-gray-500">Шаг {index + 1}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleMoveStep(task.id, index, 'up')}
                                      disabled={index === 0}
                                      className={clsx(
                                        'p-1 rounded-md transition-colors',
                                        index === 0
                                          ? 'text-gray-200 cursor-not-allowed'
                                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                                      )}
                                      title="Вверх"
                                    >
                                      <ArrowUp size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleMoveStep(task.id, index, 'down')}
                                      disabled={index === getTaskSteps(task.id).length - 1}
                                      className={clsx(
                                        'p-1 rounded-md transition-colors',
                                        index === getTaskSteps(task.id).length - 1
                                          ? 'text-gray-200 cursor-not-allowed'
                                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                                      )}
                                      title="Вниз"
                                    >
                                      <ArrowDown size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteStep(task.id, index)}
                                      className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                                      title="Удалить шаг"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={step.title}
                                    onChange={(e) => handleStepFieldChange(task.id, index, 'title', e.target.value)}
                                    placeholder="Название шага"
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white"
                                  />
                                  <textarea
                                    value={step.explanation}
                                    onChange={(e) => handleStepFieldChange(task.id, index, 'explanation', e.target.value)}
                                    placeholder="Пояснение к шагу..."
                                    rows={2}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3F8C62] bg-white resize-none"
                                  />
                                  <textarea
                                    value={step.code}
                                    onChange={(e) => handleStepFieldChange(task.id, index, 'code', e.target.value)}
                                    placeholder="Код (Python)..."
                                    rows={2}
                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#3F8C62] bg-white resize-none"
                                  />
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddStep(task.id)}
                              className="flex items-center gap-2 w-full justify-center px-3 py-2 border border-dashed border-gray-300 hover:border-[#3F8C62] text-gray-500 hover:text-[#3F8C62] rounded-lg text-sm transition-colors"
                            >
                              <Plus size={14} />
                              Добавить шаг
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>Тип: <span className="text-gray-700">{task.type === 'number' ? 'Число' : task.type === 'text' ? 'Текст' : 'Выбор'}</span></span>
                          <span>Ответ: <span className="text-gray-700">{task.answer || '—'}</span></span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                          {task.description || 'Описание не заполнено'}
                        </p>

                        {/* Read-only steps preview */}
                        {(task.solutionSteps?.length ?? 0) > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                              <Code2 size={14} className="text-indigo-500" />
                              <span className="text-xs text-gray-600">
                                Пошаговое решение ({task.solutionSteps!.length} {task.solutionSteps!.length === 1 ? 'шаг' : task.solutionSteps!.length < 5 ? 'шага' : 'шагов'})
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {task.solutionSteps!.map((step, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center text-[10px] text-indigo-600 shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm text-gray-700 truncate">{step.title}</p>
                                    {step.code && (
                                      <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{step.code.split('\n')[0]}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {editingTopic.tasks.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ListChecks size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Задач пока нет</p>
              <p className="text-xs mt-1">Нажмите «Добавить задачу» чтобы создать первую</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-8" onClick={() => setPreviewTask(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Eye size={16} className="text-gray-400" />
                <span className="text-sm text-gray-900">Предпросмотр задачи</span>
              </div>
              <button onClick={() => setPreviewTask(null)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-60px)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-8 h-8 rounded-lg bg-[#3F8C62]/10 flex items-center justify-center text-xs text-[#3F8C62]">
                  {previewTask.egeNumber}
                </span>
                <h3 className="text-gray-900">{previewTask.title}</h3>
                <span className={clsx('px-2 py-0.5 rounded-full text-xs ml-auto', difficultyColor(previewTask.difficulty))}>
                  {difficultyLabel(previewTask.difficulty)}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {previewTask.description || 'Описание отсутствует'}
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span>
                  Тип ответа:{' '}
                  <span className="text-gray-700">
                    {previewTask.type === 'number' ? 'Число' : previewTask.type === 'text' ? 'Текст' : 'Выбор'}
                  </span>
                </span>
                <span>
                  Ответ: <span className="text-gray-700">{previewTask.answer || '—'}</span>
                </span>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100">
                <label className="block text-sm text-gray-600 mb-2">Поле ответа (как видит ученик)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled
                    placeholder="Введите ответ..."
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50"
                  />
                  <button disabled className="px-4 py-2.5 bg-[#3F8C62]/60 text-white rounded-lg text-sm">
                    Проверить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
