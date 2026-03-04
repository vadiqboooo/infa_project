import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Timer, Send } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router';
import { clsx } from 'clsx';
import { useStore, ExamQuestion } from '../store';

export function ExamVariantPage() {
  const navigate = useNavigate();
  const { variantId } = useParams();
  const { examVariants, setExamScore } = useStore();

  const variant = examVariants.find((v) => v.id === variantId);

  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkResults, setCheckResults] = useState<Record<string, 'correct' | 'wrong'>>({});
  const [submitted, setSubmitted] = useState(false);
  const questionsScrollRef = useRef<HTMLDivElement>(null);

  // Set first question on mount
  useEffect(() => {
    if (variant && variant.questions.length > 0 && !currentQuestionId) {
      setCurrentQuestionId(variant.questions[0].id);
    }
  }, [variant, currentQuestionId]);

  // Reset on variant change
  useEffect(() => {
    setAnswers({});
    setCheckResults({});
    setSubmitted(false);
    if (variant && variant.questions.length > 0) {
      setCurrentQuestionId(variant.questions[0].id);
    }
  }, [variantId]);

  // Auto-scroll question bar to active button
  useEffect(() => {
    if (!currentQuestionId || !questionsScrollRef.current) return;
    const container = questionsScrollRef.current;
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeBtn) {
      const left = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2;
      container.scrollTo({ left, behavior: 'smooth' });
    }
  }, [currentQuestionId]);

  if (!variant) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Вариант не найден
      </div>
    );
  }

  const currentQuestion = variant.questions.find((q) => q.id === currentQuestionId);

  const handleCheck = () => {
    if (!currentQuestion) return;
    const userAnswer = (answers[currentQuestion.id] || '').trim();
    if (!userAnswer) return;

    const isCorrect =
      userAnswer.toLowerCase() === currentQuestion.answer.toLowerCase();
    setCheckResults((prev) => ({
      ...prev,
      [currentQuestion.id]: isCorrect ? 'correct' : 'wrong',
    }));
  };

  const handleSubmitExam = () => {
    // Check all answers
    const results: Record<string, 'correct' | 'wrong'> = {};
    let correctCount = 0;
    for (const q of variant.questions) {
      const userAnswer = (answers[q.id] || '').trim();
      const isCorrect =
        userAnswer.toLowerCase() === q.answer.toLowerCase();
      results[q.id] = isCorrect ? 'correct' : 'wrong';
      if (isCorrect) correctCount++;
    }
    setCheckResults(results);
    setSubmitted(true);

    // Score: rough approximation — each question = maxScore / totalQuestions (rounded)
    const scorePerQuestion = variant.maxScore / variant.totalQuestions;
    const score = Math.round(correctCount * scorePerQuestion);
    setExamScore(variant.id, score);
  };

  const answeredCount = Object.keys(answers).filter((k) => answers[k].trim()).length;
  const correctCount = Object.values(checkResults).filter((r) => r === 'correct').length;

  return (
    <div className="h-full flex flex-col overflow-hidden -m-8">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 bg-white shrink-0 border-b border-gray-100 mt-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/exam')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>К вариантам</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="font-bold text-gray-900">
            Вариант {variant.number} — {variant.title}
          </h1>
        </div>
        {!submitted && (
          <button
            onClick={handleSubmitExam}
            className="bg-[#3F8C62] hover:bg-[#357A54] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Send size={14} />
            Завершить вариант
          </button>
        )}
        {submitted && (
          <div className="flex items-center gap-2 text-sm font-medium text-[#3F8C62] bg-[#3F8C62]/5 px-4 py-2 rounded-lg">
            <Timer size={14} />
            Результат: {correctCount} / {variant.totalQuestions} правильных
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 pt-8">
          {/* Question number buttons */}
          <div
            ref={questionsScrollRef}
            className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {variant.questions.map((q) => {
              const result = checkResults[q.id];
              const hasAnswer = !!(answers[q.id] || '').trim();

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionId(q.id)}
                  data-active={q.id === currentQuestionId}
                  className={clsx(
                    'w-9 h-9 shrink-0 rounded-lg text-sm font-medium transition-all flex items-center justify-center',
                    q.id === currentQuestionId
                      ? 'bg-[#3F8C62] text-white shadow-md'
                      : result === 'correct'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : result === 'wrong'
                          ? 'bg-red-100 text-red-600 border border-red-200'
                          : hasAnswer
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600'
                  )}
                >
                  {q.egeNumber}
                </button>
              );
            })}
          </div>

          {/* Current question */}
          {currentQuestion && (
            <div className="flex gap-6 items-start">
              {/* Question card */}
              <div className="flex-1 bg-white border border-gray-200 rounded-xl p-6 min-h-[300px]">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      currentQuestion.difficulty === 'easy' &&
                        'bg-emerald-100 text-emerald-700',
                      currentQuestion.difficulty === 'medium' &&
                        'bg-amber-100 text-amber-700',
                      currentQuestion.difficulty === 'hard' &&
                        'bg-red-100 text-red-700'
                    )}
                  >
                    {currentQuestion.difficulty === 'easy'
                      ? 'Лёгкая'
                      : currentQuestion.difficulty === 'medium'
                        ? 'Средняя'
                        : 'Сложная'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Задание {currentQuestion.egeNumber} —{' '}
                    {currentQuestion.title}
                  </span>
                </div>
                <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                  {currentQuestion.description}
                </p>
              </div>

              {/* Answer panel */}
              <div className="w-[300px] shrink-0">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ваш ответ
                  </label>
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => {
                      setAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: e.target.value,
                      }));
                      // Reset check result on edit
                      if (checkResults[currentQuestion.id]) {
                        setCheckResults((prev) => {
                          const next = { ...prev };
                          delete next[currentQuestion.id];
                          return next;
                        });
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                    placeholder="Введите ответ..."
                    disabled={submitted}
                    className={clsx(
                      'w-full rounded-lg border px-3 py-2.5 text-sm bg-gray-50 outline-none mb-3 transition-colors',
                      checkResults[currentQuestion.id] === 'correct'
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                        : checkResults[currentQuestion.id] === 'wrong'
                          ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                          : 'border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
                      submitted && 'opacity-70 cursor-not-allowed'
                    )}
                  />

                  {!submitted && (
                    <button
                      onClick={handleCheck}
                      className="w-full bg-[#3F8C62] hover:bg-[#357A54] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Проверить
                    </button>
                  )}

                  {checkResults[currentQuestion.id] === 'correct' && (
                    <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg text-emerald-700 text-sm font-medium flex items-center gap-2">
                      <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center text-xs">
                        ✓
                      </div>
                      Правильный ответ!
                    </div>
                  )}
                  {checkResults[currentQuestion.id] === 'wrong' && (
                    <div className="mt-3 p-2.5 bg-red-50 rounded-lg text-red-600 text-sm font-medium flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-200 rounded-full flex items-center justify-center text-xs">
                        ✕
                      </div>
                      {submitted ? (
                        <span>
                          Неверно. Правильный ответ:{' '}
                          <span className="font-bold">{currentQuestion.answer}</span>
                        </span>
                      ) : (
                        'Неверно. Попробуйте ещё раз.'
                      )}
                    </div>
                  )}

                  {/* Navigation between questions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        const idx = variant.questions.findIndex(
                          (q) => q.id === currentQuestionId
                        );
                        if (idx > 0) {
                          setCurrentQuestionId(variant.questions[idx - 1].id);
                        }
                      }}
                      disabled={
                        variant.questions.findIndex(
                          (q) => q.id === currentQuestionId
                        ) === 0
                      }
                      className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Назад
                    </button>
                    <button
                      onClick={() => {
                        const idx = variant.questions.findIndex(
                          (q) => q.id === currentQuestionId
                        );
                        if (idx < variant.questions.length - 1) {
                          setCurrentQuestionId(variant.questions[idx + 1].id);
                        }
                      }}
                      disabled={
                        variant.questions.findIndex(
                          (q) => q.id === currentQuestionId
                        ) ===
                        variant.questions.length - 1
                      }
                      className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Далее
                    </button>
                  </div>

                  {/* Progress indicator */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Отвечено</span>
                      <span>
                        {answeredCount} / {variant.totalQuestions}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-[#3F8C62] h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(answeredCount / variant.totalQuestions) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}