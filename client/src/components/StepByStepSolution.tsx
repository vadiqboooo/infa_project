import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Code2,
  Lightbulb,
  RotateCcw,
  CheckCircle2,
  Lock,
  Eye,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { SolutionStep } from '../store';

interface Props {
  steps: SolutionStep[];
  taskId: string;
  open: boolean;
  onClose: () => void;
  fullSolutionCode?: string | null;
}

export function StepByStepSolution({ steps, taskId, open, onClose, fullSolutionCode }: Props) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showFullCode, setShowFullCode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset when task changes
  useEffect(() => {
    setRevealedCount(0);
    setShowFullCode(false);
  }, [taskId]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const allRevealed = revealedCount === steps.length;

  const handleNextStep = () => {
    if (revealedCount < steps.length) {
      setRevealedCount((c) => c + 1);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 150);
    }
  };

  const handleReset = () => {
    setRevealedCount(0);
    setShowFullCode(false);
  };

  const hasAdminFullCode = typeof fullSolutionCode === 'string' && fullSolutionCode.trim().length > 0;

  const fullCodeToDisplay = hasAdminFullCode
    ? fullSolutionCode
    : steps
        .slice(0, revealedCount)
        .map((s) => s.code)
        .join('\n');

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="fixed top-0 right-0 h-full w-[580px] max-w-[90vw] bg-white z-50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center">
                  <Code2 size={18} className="text-[#3F8C62]" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Пошаговое решение</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {steps.length} {steps.length === 1 ? 'шаг' : steps.length < 5 ? 'шага' : 'шагов'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Progress pills */}
                <div className="flex items-center gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'w-2.5 h-2.5 rounded-full transition-all duration-300',
                        i < revealedCount ? 'bg-[#3F8C62] scale-100' : 'bg-gray-200'
                      )}
                    />
                  ))}
                  <span className="text-xs text-gray-400 ml-1.5 font-medium">
                    {revealedCount}/{steps.length}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Steps content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {revealedCount === 0 && (
                <div className="p-10 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-16 h-16 rounded-2xl bg-[#3F8C62]/10 flex items-center justify-center mb-4">
                    <Eye size={28} className="text-[#3F8C62]" />
                  </div>
                  <p className="font-bold text-gray-800 mb-1.5">
                    Посмотреть решение по шагам
                  </p>
                  <p className="text-sm text-gray-400 mb-6 max-w-[300px] leading-relaxed">
                    Каждый шаг раскрывает следующую часть кода с подробным объяснением логики решения
                  </p>
                  <button
                    onClick={handleNextStep}
                    className="flex items-center gap-2 bg-[#3F8C62] hover:bg-[#357A54] text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-emerald-200"
                  >
                    Показать шаг 1
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <AnimatePresence mode="sync">
                {steps.slice(0, revealedCount).map((step, i) => (
                  <motion.div
                    key={`${taskId}-step-${i}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div
                      className={clsx(
                        'px-6 py-5 border-b border-gray-50',
                        i === revealedCount - 1 && 'bg-[#3F8C62]/[0.02]'
                      )}
                    >
                      {/* Step header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className={clsx(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
                            i === revealedCount - 1
                              ? 'bg-[#3F8C62] text-white'
                              : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {i + 1}
                        </div>
                        <p className="font-semibold text-gray-800 pt-0.5">
                          {step.title}
                        </p>
                      </div>

                      {/* Explanation */}
                      <div className="ml-10">
                        <div className="flex items-start gap-2 mb-3 p-3 bg-amber-50/60 rounded-lg border border-amber-100/50">
                          <Lightbulb
                            size={14}
                            className="text-amber-500 mt-0.5 shrink-0"
                          />
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {step.explanation}
                          </p>
                        </div>

                        {/* Code block - only show if not empty */}
                        {step.code && step.code.trim().length > 0 && (
                          <div className="bg-[#1e1e2e] rounded-xl overflow-hidden shadow-lg">
                            <div className="flex items-center justify-between px-4 py-2 bg-[#181825]">
                              <span className="text-[11px] text-gray-500 font-mono">
                                Python
                              </span>
                              <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#f38ba8]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#a6e3a1]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#f9e2af]" />
                              </div>
                            </div>
                            <pre 
                              className="p-4 overflow-x-auto select-none"
                              onContextMenu={(e) => e.preventDefault()}
                            >
                              <code className="text-sm font-mono leading-relaxed text-[#cdd6f4] whitespace-pre pointer-events-none">
                                {highlightPython(step.code)}
                              </code>
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Locked steps preview */}
              {revealedCount > 0 && !allRevealed && (
                <div className="px-6 py-4">
                  {steps.slice(revealedCount, revealedCount + 3).map((step, i) => (
                    <div
                      key={`locked-${i}`}
                      className="flex items-center gap-3 py-2.5 opacity-35"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Lock size={12} className="text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-400">{step.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {revealedCount > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-3 bg-gray-50/50">
                {/* Full code toggle - only on last step */}
                {allRevealed && (
                  <>
                    <button
                      onClick={() => setShowFullCode(!showFullCode)}
                      className="w-full flex items-center justify-center gap-2 text-sm text-[#3F8C62] font-bold py-2.5 rounded-xl bg-[#3F8C62]/5 border border-[#3F8C62]/20 hover:bg-[#3F8C62]/10 transition-all"
                    >
                      <Code2 size={14} />
                      {showFullCode ? 'Скрыть полный код' : 'Показать полный код решения'}
                      {showFullCode ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>

                    <AnimatePresence>
                      {showFullCode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-[#1e1e2e] rounded-xl overflow-hidden mb-3 shadow-lg border border-[#3F8C62]/20">
                            <div className="flex items-center justify-between px-4 py-2 bg-[#181825]">
                              <span className="text-[11px] text-[#3F8C62] font-bold uppercase tracking-wider">
                                {hasAdminFullCode ? 'Полный код решения' : `Код решения (${revealedCount} из ${steps.length} шагов)`}
                              </span>
                            </div>
                            <pre 
                              className="p-4 overflow-x-auto max-h-[450px] select-none"
                              onContextMenu={(e) => e.preventDefault()}
                            >
                              <code className="text-sm font-mono leading-relaxed text-[#cdd6f4] whitespace-pre pointer-events-none">
                                {highlightPython(fullCodeToDisplay)}
                              </code>
                            </pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                  {!allRevealed ? (
                    <button
                      onClick={handleNextStep}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#3F8C62] hover:bg-[#357A54] text-white py-3 rounded-xl text-sm font-medium transition-colors shadow-md shadow-emerald-100"
                    >
                      Следующий шаг ({revealedCount + 1}/{steps.length})
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl text-sm font-medium border border-emerald-100">
                      <CheckCircle2 size={16} />
                      Решение полностью раскрыто
                    </div>
                  )}
                  <button
                    onClick={handleReset}
                    className="px-3 py-3 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-white transition-colors"
                    title="Начать заново"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Simple Python syntax highlighting via JSX spans
function highlightPython(code: string): React.ReactNode {
  const lines = code.split('\n');

  return lines.map((line, li) => (
    <React.Fragment key={li}>
      {li > 0 && '\n'}
      {tokenizeLine(line)}
    </React.Fragment>
  ));
}

function tokenizeLine(line: string): React.ReactNode {
  const commentIdx = findCommentStart(line);
  if (commentIdx === 0) {
    return <span className="text-[#6c7086] italic">{line}</span>;
  }

  const parts: React.ReactNode[] = [];
  let rest = commentIdx >= 0 ? line.slice(0, commentIdx) : line;

  const regex =
    /(""".*?"""|'''.*?'''|".*?"|'.*?'|\b(?:from|import|def|return|if|elif|else|for|in|range|print|and|or|not|True|False|None|while|break|continue|class|try|except|with|as|lambda|yield|pass)\b|\b\d+\b)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rest)) !== null) {
    if (match.index > lastIdx) {
      parts.push(rest.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('"') || token.startsWith("'")) {
      parts.push(
        <span key={`s${match.index}`} className="text-[#a6e3a1]">
          {token}
        </span>
      );
    } else if (/^\d+$/.test(token)) {
      parts.push(
        <span key={`n${match.index}`} className="text-[#fab387]">
          {token}
        </span>
      );
    } else {
      parts.push(
        <span key={`k${match.index}`} className="text-[#cba6f7]">
          {token}
        </span>
      );
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < rest.length) {
    parts.push(rest.slice(lastIdx));
  }

  if (commentIdx >= 0) {
    parts.push(
      <span key="comment" className="text-[#6c7086] italic">
        {line.slice(commentIdx)}
      </span>
    );
  }

  return <>{parts}</>;
}

function findCommentStart(line: string): number {
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === inStr && line[i - 1] !== '\\') inStr = null;
    } else {
      if (ch === '"' || ch === "'") inStr = ch;
      else if (ch === '#') return i;
    }
  }
  return -1;
}
