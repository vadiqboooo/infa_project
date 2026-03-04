import React from 'react';
import { BookOpen, GraduationCap, Home, ChevronRight, CheckCircle2, Circle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigation } from '../hooks/useApi';
import type { TopicNav } from '../api/types';
import { Link } from 'react-router-dom';

interface TaskSidebarProps {
  selectedTopicId: number | null;
  onSelectTopic: (topic: TopicNav) => void;
  categoryFilter: 'tutorial' | 'homework' | 'variants';
  mode: 'tutorial' | 'practice';
  onToggleMode: () => void;
}

export function TaskSidebar({ 
  selectedTopicId, 
  onSelectTopic, 
  categoryFilter,
  mode,
  onToggleMode 
}: TaskSidebarProps) {
  const { data: allTopics, isLoading } = useNavigation();

  const topics = allTopics?.filter(t => t.category === categoryFilter) ?? [];

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-3 mb-6 group">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:bg-[#3F8C62]/10 group-hover:text-[#3F8C62] transition-colors">
            <Home size={18} />
          </div>
          <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">На главную</span>
        </Link>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {categoryFilter === 'homework' ? 'Домашняя работа' : 
             categoryFilter === 'variants' ? 'Варианты' : 'Разбор тем'}
          </h2>
        </div>

        {/* Mode Toggle (only for tutorial/homework) */}
        {categoryFilter !== 'variants' && (
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => mode !== 'tutorial' && onToggleMode()}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all',
                mode === 'tutorial' ? 'bg-white text-[#3F8C62] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <BookOpen size={14} />
              Обучение
            </button>
            <button
              onClick={() => mode !== 'practice' && onToggleMode()}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all',
                mode === 'practice' ? 'bg-white text-[#3F8C62] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <GraduationCap size={14} />
              Практика
            </button>
          </div>
        )}
      </div>

      {/* Topics List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : topics.length > 0 ? (
          topics.map((topic) => {
            const isSelected = selectedTopicId === topic.id;
            const solvedCount = topic.tasks.filter(t => t.status === 'solved').length;
            const totalCount = topic.tasks.length;
            const isCompleted = totalCount > 0 && solvedCount === totalCount;

            return (
              <button
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className={clsx(
                  'w-full flex flex-col gap-1 p-3 rounded-xl transition-all text-left group',
                  isSelected 
                    ? 'bg-[#3F8C62] text-white shadow-md shadow-[#3F8C62]/20' 
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'text-sm font-semibold truncate',
                    isSelected ? 'text-white' : 'text-gray-900 group-hover:text-[#3F8C62]'
                  )}>
                    {topic.title}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 size={16} className={isSelected ? 'text-white' : 'text-emerald-500'} />
                  ) : (
                    <ChevronRight size={14} className={clsx(
                      'transition-transform',
                      isSelected ? 'text-white/70 rotate-90' : 'text-gray-300 group-hover:translate-x-0.5'
                    )} />
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={clsx('h-full transition-all duration-500', isSelected ? 'bg-white/40' : 'bg-[#3F8C62]')}
                      style={{ width: `${totalCount > 0 ? (solvedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className={clsx('text-[10px] font-bold', isSelected ? 'text-white/80' : 'text-gray-400')}>
                    {solvedCount}/{totalCount}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-3">
              <Clock size={24} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Нет доступных тем</p>
            <p className="text-xs text-gray-400 mt-1">Темы появятся здесь, когда учитель добавит их</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3F8C62]/10 flex items-center justify-center text-[#3F8C62]">
            <GraduationCap size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Ваш прогресс</span>
            <span className="text-xs font-bold text-gray-700">
              {allTopics ? allTopics.reduce((acc, t) => acc + t.tasks.filter(tk => tk.status === 'solved').length, 0) : 0} задач решено
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
