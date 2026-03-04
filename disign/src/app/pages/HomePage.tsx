import React from 'react';
import { Link } from 'react-router';
import { useStore } from '../store';
import {
  Trophy,
  Flame,
  Target,
  TrendingUp,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

// Mock weekly progress data
const weeklyData = [
  { day: 'Пн', solved: 5 },
  { day: 'Вт', solved: 8 },
  { day: 'Ср', solved: 3 },
  { day: 'Чт', solved: 12 },
  { day: 'Пт', solved: 7 },
  { day: 'Сб', solved: 15 },
  { day: 'Вс', solved: 9 },
];

// Mock topic performance
const topicPerformance = [
  { name: 'Сист. счисл.', correct: 85, color: '#3F8C62' },
  { name: 'Логика', correct: 72, color: '#D4A843' },
  { name: 'Алгоритмы', correct: 60, color: '#6729FF' },
  { name: 'Програм.', correct: 90, color: '#FF8634' },
  { name: 'Кодирование', correct: 55, color: '#E7CB0C' },
  { name: 'Таблицы', correct: 40, color: '#1C1D21' },
];

// Mock recent activity
const recentActivity = [
  { id: '1', task: 'Перевод из двоичной в десятичную', topic: 'Системы счисления', result: 'correct', time: '2 мин назад' },
  { id: '3', task: 'Перевод из шестнадцатеричной', topic: 'Системы счисления', result: 'correct', time: '15 мин назад' },
  { id: '5', task: 'Сравнение чисел в разных системах', topic: 'Системы счисления', result: 'wrong', time: '1 час назад' },
  { id: '2', task: 'Перевод из восьмеричной', topic: 'Системы счисления', result: 'correct', time: '2 часа назад' },
];

export function HomePage() {
  const { user, tasks } = useStore();
  const solvedCount = tasks.filter((t) => t.solved).length;
  const totalCount = tasks.length;
  const percent = Math.round((solvedCount / totalCount) * 100);

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Привет, {user?.name || 'Студент'}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Продолжай подготовку к ЕГЭ по информатике
          </p>
        </div>
        <Link
          to="/tasks"
          className="flex items-center gap-2 bg-[#3F8C62] hover:bg-[#357A54] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <BookOpen size={16} />
          Начать разбор
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Target size={20} />}
          iconBg="bg-emerald-100 text-emerald-600"
          label="Решено задач"
          value={`${solvedCount}/${totalCount}`}
          sub={`${percent}% выполнено`}
        />
        <StatCard
          icon={<Flame size={20} />}
          iconBg="bg-orange-100 text-orange-600"
          label="Серия дней"
          value="7"
          sub="Лучшая: 12 дней"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          iconBg="bg-blue-100 text-blue-600"
          label="Точность"
          value="76%"
          sub="+5% за неделю"
        />
        <StatCard
          icon={<Trophy size={20} />}
          iconBg="bg-yellow-100 text-yellow-600"
          label="Прогноз балла"
          value="72"
          sub="из 100 баллов"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly progress chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Активность за неделю</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
              Задач решено
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3F8C62" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3F8C62" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '13px',
                }}
              />
              <Area
                type="monotone"
                dataKey="solved"
                stroke="#3F8C62"
                strokeWidth={2.5}
                fill="url(#grad)"
                name="Решено"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Topic performance */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Успеваемость по темам</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
              % правильных
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topicPerformance} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '13px',
                }}
                formatter={(value: number) => [`${value}%`, 'Точность']}
              />
              <Bar dataKey="correct" radius={[6, 6, 0, 0]} name="Точность">
                {topicPerformance.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: recent + quick progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Последние решения</h2>
            <Link to="/tasks" className="text-sm text-[#3F8C62] hover:underline flex items-center gap-1">
              Все задания <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <Link
                key={item.id + item.time}
                to={`/task/${item.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.result === 'correct'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-red-100 text-red-500'
                  }`}
                >
                  {item.result === 'correct' ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#3F8C62] transition-colors">
                    {item.task}
                  </p>
                  <p className="text-xs text-gray-400">{item.topic}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                  <Clock size={12} />
                  {item.time}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Circular progress */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col items-center justify-center">
          <h2 className="font-bold text-gray-900 mb-4 self-start">Общий прогресс</h2>
          <div className="relative w-36 h-36">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#3F8C62"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - percent / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{percent}%</span>
              <span className="text-xs text-gray-400">завершено</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              <span className="font-bold text-[#3F8C62]">{solvedCount}</span> из{' '}
              <span className="font-bold">{totalCount}</span> задач
            </p>
          </div>
          <Link
            to="/tasks"
            className="mt-4 w-full text-center py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Продолжить
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
