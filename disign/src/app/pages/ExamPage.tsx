import React from 'react';
import { useNavigate } from 'react-router';
import { FileText, Clock, Trophy, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store';

export function ExamPage() {
  const navigate = useNavigate();
  const { examVariants } = useStore();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Варианты ЕГЭ</h1>
        <p className="text-gray-500 text-sm">
          Решайте полные варианты для подготовки к экзамену
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {examVariants.map((variant) => {
          const isSolved = variant.score !== null;
          const scorePercent = isSolved
            ? Math.round((variant.score! / variant.maxScore) * 100)
            : 0;

          return (
            <button
              key={variant.id}
              onClick={() => navigate(`/exam/${variant.id}`)}
              className="group bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-[#3F8C62]/40 hover:shadow-md transition-all"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      isSolved
                        ? 'bg-[#3F8C62]/10 text-[#3F8C62]'
                        : 'bg-gray-100 text-gray-400'
                    )}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">
                      Вариант {variant.number}
                    </div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {variant.title}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="text-gray-300 group-hover:text-[#3F8C62] transition-colors mt-1"
                />
              </div>

              {/* Info row */}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {Math.floor(variant.timeLimitMinutes / 60)} ч{' '}
                  {variant.timeLimitMinutes % 60} мин
                </span>
                <span>{variant.totalQuestions} заданий</span>
                <span>{variant.year}</span>
              </div>

              {/* Score */}
              {isSolved ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Результат</span>
                      <span
                        className={clsx(
                          'font-semibold',
                          scorePercent >= 80
                            ? 'text-[#3F8C62]'
                            : scorePercent >= 50
                              ? 'text-amber-600'
                              : 'text-red-500'
                        )}
                      >
                        {variant.score} / {variant.maxScore}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={clsx(
                          'h-1.5 rounded-full transition-all',
                          scorePercent >= 80
                            ? 'bg-[#3F8C62]'
                            : scorePercent >= 50
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                        )}
                        style={{ width: `${scorePercent}%` }}
                      />
                    </div>
                  </div>
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      scorePercent >= 80
                        ? 'bg-[#3F8C62]/10 text-[#3F8C62]'
                        : scorePercent >= 50
                          ? 'bg-amber-50 text-amber-500'
                          : 'bg-red-50 text-red-400'
                    )}
                  >
                    <Trophy size={16} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Не решён</span>
                  <span className="text-xs text-[#3F8C62] font-medium group-hover:underline">
                    Начать
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
