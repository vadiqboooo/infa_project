import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  BookOpen,
  Users,
  FolderOpen,
  ChevronRight,
  Download,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store';
import { TopicDetail, TopicData, TopicTask } from '../components/admin/TopicDetail';
import { StudentsTable } from '../components/admin/StudentsTable';
import { ImportTopicModal } from '../components/admin/ImportTopicModal';

type FilterCategory = 'все' | 'разбор' | 'домашняя работа' | 'вариант';

function buildTopics(tasks: ReturnType<typeof useStore>['tasks']): TopicData[] {
  const topicMap = new Map<string, TopicData>();

  for (const task of tasks) {
    if (!topicMap.has(task.topic)) {
      let category: TopicData['category'] = 'разбор';
      if (task.topic.toLowerCase().includes('программиров')) category = 'домашняя работа';

      topicMap.set(task.topic, {
        id: task.topic,
        name: task.topic,
        category,
        egeNumbers: '',
        description: `Задания по теме «${task.topic}»`,
        tasks: [],
      });
    }
    const topic = topicMap.get(task.topic)!;
    topic.tasks.push({
      id: task.id,
      egeNumber: task.egeId,
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      type: task.type,
      answer: task.answer || '',
    });
    if (!topic.egeNumbers.split(', ').includes(task.egeId)) {
      topic.egeNumbers = topic.egeNumbers
        ? `${topic.egeNumbers}, ${task.egeId}`
        : task.egeId;
    }
  }

  if (!topicMap.has('Логика')) {
    topicMap.set('Логика', {
      id: 'Логика',
      name: 'Логика',
      category: 'вариант',
      egeNumbers: '15, 16',
      description: 'Логические выражения и таблицы истинности',
      tasks: [
        { id: 'logic-1', egeNumber: '15', title: 'Таблица истинности', description: 'Определите значение логического выражения при заданных значениях переменных.', difficulty: 'medium', type: 'number', answer: '1' },
        { id: 'logic-2', egeNumber: '16', title: 'Упрощение выражений', description: 'Упростите логическое выражение и найдите количество наборов переменных, при которых оно истинно.', difficulty: 'hard', type: 'number', answer: '4' },
      ],
    });
  }

  if (!topicMap.has('Алгоритмы')) {
    topicMap.set('Алгоритмы', {
      id: 'Алгоритмы',
      name: 'Алгоритмы',
      category: 'домашняя работа',
      egeNumbers: '19, 20, 21',
      description: 'Алгоритмы обработки данных и теория графов',
      tasks: [
        { id: 'algo-1', egeNumber: '19', title: 'Теория игр', description: 'Два игрока играют в следующую игру. Перед ними лежит куча камней. Определите выигрышную стратегию.', difficulty: 'hard', type: 'number', answer: '3' },
      ],
    });
  }

  return Array.from(topicMap.values());
}

const FILTER_OPTIONS: { key: FilterCategory; label: string }[] = [
  { key: 'все', label: 'Все' },
  { key: 'разбор', label: 'Разбор' },
  { key: 'домашняя работа', label: 'Домашняя работа' },
  { key: 'вариант', label: 'Вариант' },
];

export function AdminPage() {
  const { tasks } = useStore();
  const [activeTab, setActiveTab] = useState<'topics' | 'students'>('topics');
  const [filter, setFilter] = useState<FilterCategory>('все');
  const [search, setSearch] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicData[]>(() => buildTopics(tasks));
  const [showImportModal, setShowImportModal] = useState(false);

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchesFilter = filter === 'все' || t.category === filter;
      const matchesSearch =
        search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.egeNumbers.includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [topics, filter, search]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  const handleSaveTopic = (updated: TopicData) => {
    setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTopicId(null);
  };

  const handleAddTopic = () => {
    const newTopic: TopicData = {
      id: `topic-${Date.now()}`,
      name: 'Новый топик',
      category: 'разбор',
      egeNumbers: '',
      description: '',
      tasks: [],
    };
    setTopics((prev) => [...prev, newTopic]);
    setSelectedTopicId(newTopic.id);
  };

  const handleDeleteTopic = (id: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImportTopic = (topic: TopicData) => {
    setTopics((prev) => [...prev, topic]);
    setShowImportModal(false);
  };

  const categoryColor = (cat: string) => {
    if (cat === 'разбор') return 'bg-blue-100 text-blue-700';
    if (cat === 'домашняя работа') return 'bg-violet-100 text-violet-700';
    return 'bg-orange-100 text-orange-700';
  };

  if (selectedTopic) {
    return (
      <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <TopicDetail
          topic={selectedTopic}
          onBack={() => setSelectedTopicId(null)}
          onSave={handleSaveTopic}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl text-gray-900 mb-1">Админ-панель</h1>
        <p className="text-sm text-gray-500">Управление топиками, задачами и учениками</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('topics')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all',
            activeTab === 'topics'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <BookOpen size={16} />
          Топики
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all',
            activeTab === 'students'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Users size={16} />
          Ученики
        </button>
      </div>

      {/* Topics tab */}
      {activeTab === 'topics' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filters row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию или номеру ЕГЭ..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white"
              />
            </div>

            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap',
                    filter === opt.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors"
              >
                <Download size={15} />
                Импорт
              </button>
              <button
                onClick={handleAddTopic}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm transition-colors"
              >
                <Plus size={15} />
                Новый топик
              </button>
            </div>
          </div>

          {/* Topics table */}
          <div className="flex-1 overflow-y-auto">
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-5 py-3">Топик</th>
                    <th className="px-5 py-3 w-40">Категория</th>
                    <th className="px-5 py-3 w-28">Задач</th>
                    <th className="px-5 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTopics.map((topic) => (
                    <tr
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center shrink-0">
                            <FolderOpen size={16} className="text-[#3F8C62]" />
                          </div>
                          <p className="text-sm text-gray-900">{topic.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={clsx('px-2.5 py-1 rounded-full text-xs', categoryColor(topic.category))}>
                          {topic.category}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600">{topic.tasks.length}</span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTopic(topic.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTopics.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Топики не найдены</p>
                  <p className="text-xs mt-1">Попробуйте изменить фильтры</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Students tab */}
      {activeTab === 'students' && <StudentsTable />}

      {/* Import modal */}
      {showImportModal && (
        <ImportTopicModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportTopic}
        />
      )}
    </div>
  );
}