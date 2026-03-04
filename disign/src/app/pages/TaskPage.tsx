import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Bot, X, Code2, BookOpen, ChevronRight } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router';
import { clsx } from 'clsx';
import { useStore } from '../store';
import { StepByStepSolution } from '../components/StepByStepSolution';

interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
}

export function TaskPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const { tasks, toggleTaskSolved } = useStore();
  const [answer, setAnswer] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'ai',
      text: 'Привет! Я AI-помощник. Могу объяснить тему, но не дам прямой ответ. Чем помочь?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [checkResult, setCheckResult] = useState<'correct' | 'wrong' | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const questionsScrollRef = useRef<HTMLDivElement>(null);

  const currentTask = tasks.find((t) => t.id === taskId);

  // Reset state when switching tasks
  useEffect(() => {
    setAnswer('');
    setCheckResult(null);
  }, [taskId]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', text: inputMessage };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: 'Попробуй разбить задачу на шаги. Подумай, какие данные у тебя есть и какой результат нужен. Используй пошаговое решение справа, если нужна подсказка!',
        },
      ]);
    }, 1000);
  };

  const handleCheck = () => {
    if (!answer.trim() || !currentTask) return;
    const isCorrect =
      currentTask.answer &&
      answer.trim().toLowerCase() === currentTask.answer.toLowerCase();
    setCheckResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect && !currentTask.solved) {
      toggleTaskSolved(currentTask.id);
    }
  };

  if (!currentTask) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Задача не найдена
      </div>
    );
  }

  const hasSolution = currentTask.solutionSteps && currentTask.solutionSteps.length > 0;
  const isProgramming = currentTask.topic === 'Программирование';

  return (
    <div className="h-full flex flex-col overflow-hidden -m-8">
      {/* Header */}
      <div className="h-14 flex items-center px-6 bg-white shrink-0 border-b border-gray-100 mt-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Назад</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="font-bold text-gray-900">{currentTask.topic}</h1>
          {isProgramming && (
            <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              <Code2 size={11} />
              Python
            </span>
          )}
        </div>

      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: task navigation + task body */}
        <div className="flex-1 overflow-y-auto p-8 pt-8">
          {/* Task number buttons */}
          <div
            ref={questionsScrollRef}
            className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {tasks.map((t) => (
              <Link
                key={t.id}
                to={`/task/${t.id}`}
                className={clsx(
                  'w-9 h-9 shrink-0 rounded-lg text-sm font-medium transition-all flex items-center justify-center',
                  t.id === currentTask.id
                    ? 'bg-[#3F8C62] text-white shadow-md'
                    : t.solved
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600'
                )}
              >
                {t.egeId}
              </Link>
            ))}
          </div>

          {/* Task description */}
          <div className="flex gap-6 items-start">
            <div className="flex-1 bg-white border border-gray-200 rounded-xl p-6 min-h-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    currentTask.difficulty === 'easy' && 'bg-emerald-100 text-emerald-700',
                    currentTask.difficulty === 'medium' && 'bg-amber-100 text-amber-700',
                    currentTask.difficulty === 'hard' && 'bg-red-100 text-red-700'
                  )}
                >
                  {currentTask.difficulty === 'easy'
                    ? 'Лёгкая'
                    : currentTask.difficulty === 'medium'
                      ? 'Средняя'
                      : 'Сложная'}
                </span>
                <span className="text-xs text-gray-400">
                  Задание {currentTask.egeId} — {currentTask.title}
                </span>
                {hasSolution && (
                  <button
                    onClick={() => setSolutionOpen(true)}
                    className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-[#3F8C62] bg-[#3F8C62]/5 border border-[#3F8C62]/20 hover:bg-[#3F8C62]/10 hover:border-[#3F8C62]/40 transition-all"
                    title="Пошаговое решение"
                  >
                    <BookOpen size={16} />
                  </button>
                )}
              </div>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                {currentTask.description}
              </p>
            </div>

            {/* Right sub-column: Answer + Chat */}
            <div className="w-[300px] shrink-0 flex flex-col gap-4">
              {/* Answer section */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ваш ответ
                </label>
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setCheckResult(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  placeholder="Введите ответ..."
                  className={clsx(
                    'w-full rounded-lg border px-3 py-2.5 text-sm bg-gray-50 outline-none mb-3 transition-colors',
                    checkResult === 'correct'
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                      : checkResult === 'wrong'
                        ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  )}
                />
                <button
                  onClick={handleCheck}
                  className="w-full bg-[#3F8C62] hover:bg-[#357A54] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Проверить
                </button>

                {checkResult === 'correct' && (
                  <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg text-emerald-700 text-sm font-medium flex items-center gap-2">
                    <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center text-xs">
                      ✓
                    </div>
                    Правильный ответ!
                  </div>
                )}
                {checkResult === 'wrong' && (
                  <div className="mt-3 p-2.5 bg-red-50 rounded-lg text-red-600 text-sm font-medium flex items-center gap-2">
                    <div className="w-5 h-5 bg-red-200 rounded-full flex items-center justify-center text-xs">
                      ✕
                    </div>
                    Неверно. Попробуйте ещё раз.
                  </div>
                )}
                {currentTask.solved && checkResult !== 'correct' && (
                  <div className="mt-3 text-emerald-600 text-sm font-medium flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center text-[10px]">
                      ✓
                    </div>
                    Вы уже решили эту задачу
                  </div>
                )}
              </div>

              {/* AI Chat */}
              <div
                className="bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden"
                style={{ height: '320px' }}
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-gray-500" />
                    <span className="text-sm font-semibold text-gray-800">AI Ассистент</span>
                  </div>
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showChat ? <X size={14} /> : <Bot size={14} />}
                  </button>
                </div>

                {showChat && (
                  <>
                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={clsx(
                            'max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                            msg.role === 'user'
                              ? 'bg-[#D4A843] ml-auto text-white rounded-br-sm'
                              : 'bg-gray-100 mr-auto text-gray-800 rounded-bl-sm'
                          )}
                        >
                          {msg.text}
                        </div>
                      ))}
                    </div>

                    <div className="p-3 border-t border-gray-100 shrink-0">
                      <div className="relative">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Задать вопрос..."
                          className="w-full pl-4 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          onClick={handleSendMessage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#3F8C62] text-white rounded-lg hover:bg-[#357A54] transition-colors"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Solution drawer */}
      {hasSolution && (
        <StepByStepSolution
          steps={currentTask.solutionSteps!}
          taskId={currentTask.id}
          open={solutionOpen}
          onClose={() => setSolutionOpen(false)}
        />
      )}
    </div>
  );
}