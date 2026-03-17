import React, { useMemo, useState } from 'react';
import { Search, BookOpen, ClipboardList, Loader2 } from 'lucide-react';
import { TopicCard } from '../components/TopicCard';
import { useNavigation, useTask } from '../hooks/useApi';
import { useLocation } from 'react-router-dom';
import { StepByStepSolution } from '../components/StepByStepSolution';

export function TasksListPage() {
  const location = useLocation();
  const { data: allTopics, isLoading } = useNavigation();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);

  const categoryFilter = location.pathname.startsWith('/homework') ? 'homework' : 'tutorial';
  
  const topics = useMemo(() => {
    return allTopics?.filter(t => t.category === categoryFilter) ?? [];
  }, [allTopics, categoryFilter]);

  const title = categoryFilter === 'homework' ? 'Домашняя работа' : 'Разбор заданий';
  const subtitle = categoryFilter === 'homework' 
    ? 'Задания для закрепления материала' 
    : 'Подробный разбор всех типов задач ЕГЭ';

  // Fetch task data for the solution sidebar
  const { data: taskData, isLoading: isTaskLoading } = useTask(selectedTaskId);

  const handleShowSolution = (topicId: number) => {
    const topic = topics.find(t => t.id === topicId);
    if (topic && topic.tasks.length > 0) {
        setSelectedTaskId(topic.tasks[0].id);
        setIsSolutionOpen(true);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#3F8C62]/10 flex items-center justify-center text-[#3F8C62]">
              {categoryFilter === 'homework' ? <ClipboardList size={20} /> : <BookOpen size={20} />}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">{title}</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">{subtitle}</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск темы..."
            className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-2xl text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 focus:border-[#3F8C62] bg-white transition-all shadow-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),400px))] justify-start">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : topics.length > 0 ? (
        <div className="grid gap-4 md:gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),400px))] justify-start">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              id={String(topic.id)}
              egeId={String(topic.ege_number ?? topic.tasks.find(t => t.ege_number != null)?.ege_number ?? (topic.order_index + 1))}
              title={topic.title}
              description={categoryFilter === 'homework' ? 'Домашнее задание' : 'Теория и практика'}
              progress={{ 
                solved: topic.tasks.filter(t => t.status === 'solved').length, 
                total: topic.tasks.length 
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} className="opacity-20" />
          </div>
          <p className="font-bold text-lg text-gray-900">Тем пока нет</p>
          <p className="text-sm">Администратор еще не добавил задания в этот раздел</p>
        </div>
      )}
    </div>
  );
}
