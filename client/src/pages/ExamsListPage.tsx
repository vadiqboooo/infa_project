import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, Trophy, ChevronRight, Inbox } from 'lucide-react';
import { useNavigation } from '../hooks/useApi';
import { cn } from '@/lib/utils';

export default function ExamsListPage() {
  const navigate = useNavigate();
  const { data: topics, isLoading } = useNavigation();

  // Filter topics with category "variants" using useMemo for stability
  const examVariants = useMemo(() => {
    if (!topics) return [];
    // Defensive check: handle both string and enum values if needed
    return topics.filter(t => String(t.category).toLowerCase() === 'variants');
  }, [topics]);

  if (isLoading && !topics) {
    return (
        <div className="p-8 space-y-6">
            <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
            </div>
        </div>
    );
  }

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Варианты ЕГЭ</h1>
        <p className="text-gray-500 text-sm">
          Решайте полные варианты для подготовки к экзамену
        </p>
      </div>

      {examVariants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Inbox size={32} className="opacity-20" />
          </div>
          <p className="font-bold text-lg text-gray-900">Вариантов пока нет</p>
          <p className="text-sm">Администратор еще не добавил контрольные варианты</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {examVariants.map((variant) => {
            const isSolved = variant.latest_score !== undefined && variant.latest_score !== null;
            const solvedTasksCount = variant.tasks.filter(t => t.status === 'solved').length;
            const totalTasksCount = variant.tasks.length;
            
            // Calculate current points based on solved tasks (1pt for 1-25, 2pts for 26-27)
            const currentPoints = variant.tasks.reduce((sum, task) => {
                if (task.status === 'solved') {
                    const num = task.ege_number || 0;
                    return sum + (num >= 26 ? 2 : 1);
                }
                return sum;
            }, 0);
            
            // Calculate max possible points based on all tasks
            const maxPoints = variant.tasks.reduce((sum, task) => {
                const num = task.ege_number || 0;
                return sum + (num >= 26 ? 2 : 1);
            }, 0) || 29;

            const progressPercent = Math.min(100, Math.round((currentPoints / maxPoints) * 100));

            return (
              <button
                key={variant.id}
                onClick={() => navigate(`/exams/${variant.id}`)}
                className="group bg-white border border-gray-200 rounded-2xl p-6 text-left hover:border-[#3F8C62]/40 hover:shadow-xl hover:shadow-gray-200/40 transition-all hover:-translate-y-1 block w-full relative overflow-hidden"
              >
                {/* Large Solid Accent Score in BACKGROUND - Bottom Right */}
                {isSolved && (
                  <div className="absolute right-4 bottom-2 select-none pointer-events-none z-0 opacity-70 transition-transform group-hover:scale-105 duration-700">
                    <div className="flex flex-col items-end">
                        <span className="text-[100px] font-black text-[#3F8C62] leading-none tracking-tighter">
                            {variant.latest_score?.toFixed(0)}
                        </span>
                    </div>
                  </div>
                )}

                {/* Top row - Foreground */}
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                        isSolved
                          ? 'bg-[#3F8C62] text-white shadow-lg shadow-[#3F8C62]/20'
                          : 'bg-gray-100 text-gray-400 group-hover:bg-[#3F8C62]/10 group-hover:text-[#3F8C62]'
                      )}
                    >
                      <FileText size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                        Контрольный вариант
                      </div>
                      <div className="font-bold text-gray-900 group-hover:text-[#3F8C62] transition-colors">
                        {variant.title}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-gray-300 group-hover:text-[#3F8C62] transition-all group-hover:translate-x-1"
                  />
                </div>

                {/* Content / Progress - Foreground (ABOVE the score) */}
                <div className="relative z-10">
                  {!isSolved && (
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mb-8">
                      <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                        <Clock size={14} className="text-gray-300" />
                        {variant.time_limit_minutes || 235} мин
                      </span>
                      <span className="bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">{totalTasksCount} задач</span>
                    </div>
                  )}

                  <div className={cn("space-y-2", isSolved ? "mt-4" : "")}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-gray-400">Прогресс решения</span>
                      </div>
                      <div className="relative flex items-center h-6">
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#3F8C62] transition-all duration-1000"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-sm font-black text-gray-900">
                                {currentPoints} / {maxPoints}
                            </span>
                        </div>
                      </div>
                      
                      {isSolved ? (
                          <div className="flex items-center gap-1.5 text-[#3F8C62] text-[10px] font-bold uppercase pt-1">
                              <Trophy size={12} />
                              Завершено
                          </div>
                      ) : (
                          <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] font-bold text-gray-300 uppercase">
                                  {solvedTasksCount > 0 ? "В процессе" : "Не начат"}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-[#3F8C62] font-bold">
                                  {solvedTasksCount > 0 ? "Продолжить" : "Начать"}
                                  <ChevronRight size={14} />
                              </span>
                          </div>
                      )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
