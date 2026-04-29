import React, { useMemo, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { TopicCard } from '../components/TopicCard';
import { useNavigation } from '../hooks/useApi';
import { TopicCategory } from '../api/types';

export function TasksListPage() {
  const { data: allTopics, isLoading } = useNavigation();
  const [search, setSearch] = useState('');

  const taskGroups = useMemo(() => {
    if (!allTopics) return [];

    const tutorials = allTopics.filter(t => t.category === TopicCategory.tutorial);
    const homeworks  = allTopics.filter(t => t.category === TopicCategory.homework);

    const egeNums = new Set([
      ...tutorials.map(t => t.ege_number).filter((n): n is number => n != null),
      ...homeworks.map(t => t.ege_number).filter((n): n is number => n != null),
    ]);

    return Array.from(egeNums)
      .sort((a, b) => a - b)
      .map(egeNum => {
        const tut = tutorials.find(t => t.ege_number === egeNum) ?? null;
        const hw  = homeworks.find(t => t.ege_number === egeNum) ?? null;
        // Topic-level explicit range (ege_number_end) takes priority
        const explicitEnd = tut?.ege_number_end ?? hw?.ege_number_end ?? null;
        // Otherwise compute composite range from tasks' sub_tasks
        const allTasks = [...(tut?.tasks ?? []), ...(hw?.tasks ?? [])];
        const taskMax = allTasks.reduce<number | null>((acc, t) => {
          const m = (t as any).ege_number_max as number | null | undefined;
          if (typeof m === 'number' && (acc == null || m > acc)) return m;
          return acc;
        }, null);
        const maxNum = explicitEnd ?? taskMax;
        const egeLabel = maxNum != null && maxNum > egeNum ? `${egeNum}-${maxNum}` : String(egeNum);
        return {
          egeNum,
          egeLabel,
          title: tut?.title ?? hw?.title ?? `Задание ${egeLabel}`,
          tutorial: tut ? { id: tut.id, solved: tut.tasks.filter(t => t.status === 'solved').length, total: tut.tasks.length } : null,
          homework: hw  ? { id: hw.id,  solved: hw.tasks.filter(t => t.status === 'solved').length,  total: hw.tasks.length  } : null,
        };
      });
  }, [allTopics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return taskGroups;
    return taskGroups.filter(g => g.title.toLowerCase().includes(q) || String(g.egeNum).includes(q));
  }, [taskGroups, search]);

  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#3F8C62]/10 flex items-center justify-center text-[#3F8C62]">
              <BookOpen size={20} />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">Задания</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">Все задания ЕГЭ по информатике</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск задания..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-2xl text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 focus:border-[#3F8C62] bg-white transition-all shadow-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(g => (
            <TopicCard
              key={g.egeNum}
              egeId={g.egeLabel}
              title={g.title}
              tutorial={g.tutorial}
              homework={g.homework}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} className="opacity-20" />
          </div>
          <p className="font-bold text-lg text-gray-900">Задания не найдены</p>
          <p className="text-sm">Попробуйте изменить поисковый запрос</p>
        </div>
      )}
    </div>
  );
}
