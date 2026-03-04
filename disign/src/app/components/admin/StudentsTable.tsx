import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface StudentProgress {
  topicName: string;
  solved: number;
  total: number;
}

interface Student {
  id: string;
  name: string;
  avatar: string;
  telegramUsername: string;
  lastActive: string;
  totalSolved: number;
  totalTasks: number;
  examScores: { variantName: string; score: number; maxScore: number }[];
  topicProgress: StudentProgress[];
  trend: 'up' | 'down' | 'stable';
}

const MOCK_STUDENTS: Student[] = [
  {
    id: '1',
    name: 'Алексей Петров',
    avatar: 'АП',
    telegramUsername: '@alex_petrov',
    lastActive: '2 часа назад',
    totalSolved: 38,
    totalTasks: 60,
    examScores: [
      { variantName: 'Вариант 1', score: 24, maxScore: 35 },
      { variantName: 'Вариант 2', score: 28, maxScore: 35 },
    ],
    topicProgress: [
      { topicName: 'Системы счисления', solved: 8, total: 10 },
      { topicName: 'Программирование', solved: 14, total: 20 },
      { topicName: 'Логика', solved: 6, total: 10 },
      { topicName: 'Алгоритмы', solved: 10, total: 20 },
    ],
    trend: 'up',
  },
  {
    id: '2',
    name: 'Мария Иванова',
    avatar: 'МИ',
    telegramUsername: '@masha_iv',
    lastActive: '5 минут назад',
    totalSolved: 52,
    totalTasks: 60,
    examScores: [
      { variantName: 'Вариант 1', score: 32, maxScore: 35 },
      { variantName: 'Вариант 3', score: 30, maxScore: 35 },
    ],
    topicProgress: [
      { topicName: 'Системы счисления', solved: 10, total: 10 },
      { topicName: 'Программирование', solved: 18, total: 20 },
      { topicName: 'Логика', solved: 9, total: 10 },
      { topicName: 'Алгоритмы', solved: 15, total: 20 },
    ],
    trend: 'up',
  },
  {
    id: '3',
    name: 'Дмитрий Сидоров',
    avatar: 'ДС',
    telegramUsername: '@dima_sid',
    lastActive: '1 день назад',
    totalSolved: 15,
    totalTasks: 60,
    examScores: [{ variantName: 'Вариант 1', score: 14, maxScore: 35 }],
    topicProgress: [
      { topicName: 'Системы счисления', solved: 5, total: 10 },
      { topicName: 'Программирование', solved: 4, total: 20 },
      { topicName: 'Логика', solved: 3, total: 10 },
      { topicName: 'Алгоритмы', solved: 3, total: 20 },
    ],
    trend: 'down',
  },
  {
    id: '4',
    name: 'Елена Козлова',
    avatar: 'ЕК',
    telegramUsername: '@lena_k',
    lastActive: '30 минут назад',
    totalSolved: 44,
    totalTasks: 60,
    examScores: [
      { variantName: 'Вариант 1', score: 27, maxScore: 35 },
      { variantName: 'Вариант 2', score: 29, maxScore: 35 },
      { variantName: 'Вариант 3', score: 31, maxScore: 35 },
    ],
    topicProgress: [
      { topicName: 'Системы счисления', solved: 9, total: 10 },
      { topicName: 'Программирование', solved: 16, total: 20 },
      { topicName: 'Логика', solved: 8, total: 10 },
      { topicName: 'Алгоритмы', solved: 11, total: 20 },
    ],
    trend: 'stable',
  },
  {
    id: '5',
    name: 'Артём Волков',
    avatar: 'АВ',
    telegramUsername: '@artem_v',
    lastActive: '3 дня назад',
    totalSolved: 22,
    totalTasks: 60,
    examScores: [],
    topicProgress: [
      { topicName: 'Системы счисления', solved: 7, total: 10 },
      { topicName: 'Программирование', solved: 8, total: 20 },
      { topicName: 'Логика', solved: 4, total: 10 },
      { topicName: 'Алгоритмы', solved: 3, total: 20 },
    ],
    trend: 'down',
  },
  {
    id: '6',
    name: 'София Новикова',
    avatar: 'СН',
    telegramUsername: '@sofia_nov',
    lastActive: '10 минут назад',
    totalSolved: 48,
    totalTasks: 60,
    examScores: [
      { variantName: 'Вариант 1', score: 30, maxScore: 35 },
      { variantName: 'Вариант 2', score: 33, maxScore: 35 },
    ],
    topicProgress: [
      { topicName: 'Системы счисления', solved: 10, total: 10 },
      { topicName: 'Программирование', solved: 17, total: 20 },
      { topicName: 'Логика', solved: 10, total: 10 },
      { topicName: 'Алгоритмы', solved: 11, total: 20 },
    ],
    trend: 'up',
  },
];

const avatarGradients = [
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600',
  'from-cyan-400 to-cyan-600',
];

export function StudentsTable() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'active'>('progress');

  const filtered = MOCK_STUDENTS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.telegramUsername.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'progress') return b.totalSolved / b.totalTasks - a.totalSolved / a.totalTasks;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const getProgressPercent = (solved: number, total: number) =>
    total === 0 ? 0 : Math.round((solved / total) * 100);

  const getProgressColor = (pct: number) =>
    pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск учеников..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white"
          />
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {([
            { key: 'progress', label: 'По прогрессу' },
            { key: 'name', label: 'По имени' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs transition-colors',
                sortBy === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-sm text-gray-500">{sorted.length} учеников</div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
              <th className="px-5 py-3">Ученик</th>
              <th className="px-5 py-3 w-36">Прогресс</th>
              <th className="px-5 py-3 w-28">Тренд</th>
              <th className="px-5 py-3 w-40">Лучший вариант</th>
              <th className="px-5 py-3 w-36">Активность</th>
              <th className="px-5 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((student, idx) => {
              const pct = getProgressPercent(student.totalSolved, student.totalTasks);
              const isExpanded = expandedId === student.id;
              const bestExam = student.examScores.length
                ? student.examScores.reduce((best, e) => (e.score > best.score ? e : best), student.examScores[0])
                : null;

              return (
                <React.Fragment key={student.id}>
                  <tr
                    className={clsx(
                      'hover:bg-gray-50/80 transition-colors cursor-pointer',
                      isExpanded && 'bg-gray-50/50'
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : student.id)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs shrink-0',
                            avatarGradients[idx % avatarGradients.length]
                          )}
                        >
                          {student.avatar}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-400">{student.telegramUsername}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={clsx('h-1.5 rounded-full transition-all', getProgressColor(pct))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                          student.trend === 'up' && 'bg-emerald-50 text-emerald-600',
                          student.trend === 'down' && 'bg-red-50 text-red-500',
                          student.trend === 'stable' && 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {student.trend === 'up' && <TrendingUp size={12} />}
                        {student.trend === 'down' && <TrendingDown size={12} />}
                        {student.trend === 'stable' && <Minus size={12} />}
                        {student.trend === 'up' ? 'Растёт' : student.trend === 'down' ? 'Падает' : 'Стабильно'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {bestExam ? (
                        <span className="text-sm text-gray-700">
                          {bestExam.score}/{bestExam.maxScore}{' '}
                          <span className="text-xs text-gray-400">({bestExam.variantName})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Не решал</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-500">{student.lastActive}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="px-5 py-4 bg-gray-50/70 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Topic progress */}
                          <div>
                            <h4 className="text-xs text-gray-500 uppercase mb-3">Прогресс по темам</h4>
                            <div className="space-y-2.5">
                              {student.topicProgress.map((tp) => {
                                const tpPct = getProgressPercent(tp.solved, tp.total);
                                return (
                                  <div key={tp.topicName}>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-700">{tp.topicName}</span>
                                      <span className="text-gray-400">
                                        {tp.solved}/{tp.total}
                                      </span>
                                    </div>
                                    <div className="bg-gray-200 rounded-full h-1.5">
                                      <div
                                        className={clsx('h-1.5 rounded-full', getProgressColor(tpPct))}
                                        style={{ width: `${tpPct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Exam scores */}
                          <div>
                            <h4 className="text-xs text-gray-500 uppercase mb-3">Результаты вариантов</h4>
                            {student.examScores.length > 0 ? (
                              <div className="space-y-2">
                                {student.examScores.map((es, i) => {
                                  const esPct = getProgressPercent(es.score, es.maxScore);
                                  return (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                                    >
                                      <span className="text-sm text-gray-700">{es.variantName}</span>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={clsx(
                                            'text-sm',
                                            esPct >= 80 ? 'text-emerald-600' : esPct >= 50 ? 'text-amber-600' : 'text-red-500'
                                          )}
                                        >
                                          {es.score}/{es.maxScore}
                                        </span>
                                        <span className="text-xs text-gray-400">({esPct}%)</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Варианты ещё не решались</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Ученики не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
}
