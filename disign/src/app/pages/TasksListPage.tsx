import React from 'react';
import { Search } from 'lucide-react';
import { TopicCard } from '../components/TopicCard';
import { useStore } from '../store';

export function TasksListPage() {
  const { tasks } = useStore();

  const solvedByTopic = (topic: string) =>
    tasks.filter((t) => t.topic === topic && t.solved).length;

  const topics = [
    {
      id: '1',
      egeId: '1',
      title: 'Системы счисления',
      description: 'Перевод чисел, арифметика в разных системах',
      solved: solvedByTopic('Системы счисления'),
      total: 12,
    },
    {
      id: '2',
      egeId: '2',
      title: 'Логические выражения',
      description: 'Таблицы истинности, логические операции',
      solved: 0,
      total: 10,
    },
    {
      id: '3',
      egeId: '3',
      title: 'Алгоритмы',
      description: 'Исполнители, блок-схемы, рекурсия',
      solved: 0,
      total: 15,
    },
    {
      id: '4',
      egeId: '4',
      title: 'Программирование',
      description: 'Циклы, условия, массивы, функции',
      solved: 0,
      total: 8,
    },
    {
      id: '5',
      egeId: '5',
      title: 'Кодирование информации',
      description: 'Кодирование текста, графики, звука',
      solved: 4,
      total: 8,
    },
    {
      id: '6',
      egeId: '6',
      title: 'Электронные таблицы',
      description: 'Формулы, графики, диаграммы в Excel',
      solved: 2,
      total: 10,
    },
    {
      id: '7',
      egeId: '7',
      title: 'Базы данных',
      description: 'SQL-запросы, реляционные базы данных',
      solved: 0,
      total: 6,
    },
    {
      id: '8',
      egeId: '8',
      title: 'Графы и деревья',
      description: 'Поиск путей, остовные деревья, обходы',
      solved: 0,
      total: 8,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Разбор заданий</h1>
          <p className="text-gray-500 text-sm mt-1">27 заданий ЕГЭ по информатике</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск задания..."
            className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/30 focus:border-[#3F8C62] bg-white"
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={16} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            id={topic.id}
            egeId={topic.egeId}
            title={topic.title}
            description={topic.description}
            progress={{ solved: topic.solved, total: topic.total }}
          />
        ))}
      </div>
    </div>
  );
}
