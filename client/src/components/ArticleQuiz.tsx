import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ArticleQuestion, QuizResult } from '../api/articles';

type Props = {
  questions: ArticleQuestion[];
  answers: number[][];
  onAnswer: (index: number, answers: number[]) => void;
  result: QuizResult | null;
  busy: boolean;
  preview: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onRetry: () => void;
};

export function ArticleQuiz({ questions, answers, onAnswer, result, busy, preview, onSubmit, onRetry }: Props) {
  const [index, setIndex] = useState(() => {
    const requested = Number(window.location.hash.match(/^#question-(\d+)$/)?.[1] || 1) - 1;
    return Math.max(0, Math.min(questions.length - 1, requested));
  });
  const question = questions[index];
  const selected = answers[index];
  const last = index === questions.length - 1;
  const firstMissing = answers.findIndex(value => value.length === 0);
  const go = (next: number) => setIndex(next);
  const retry = () => { onRetry(); go(0); };

  if (result) return <div className="article-quiz-card article-result">
    <div role="status">
      <h3>{result.score === result.total ? 'Отлично, тест пройден!' : 'Попробуйте ещё раз'}</h3>
      <p>Верных ответов: {result.score} из {result.total}.</p>
    </div>
    <button type="button" className="article-quiz-card__next" onClick={retry}>Пройти заново</button>
  </div>;

  return <>
    <form className="article-quiz-card" onSubmit={onSubmit}>
      <div className="article-quiz-card__header">
          <nav className="article-quiz-card__navigation" aria-label="Вопросы теста">
            <button type="button" aria-label="Предыдущий вопрос" disabled={busy || index === 0} onClick={() => go(index - 1)}><ChevronLeft size={20} /></button>
            <span aria-live="polite">{index + 1} из {questions.length}</span>
            <button type="button" aria-label="Следующий вопрос" disabled={busy || last} onClick={() => go(index + 1)}><ChevronRight size={20} /></button>
          </nav>
        <h3 id="article-question-title" className="article-quiz-card__title">{question.prompt}</h3>
      </div>
      <fieldset className="article-quiz-card__options" aria-labelledby="article-question-title" disabled={busy || preview} key={index}>
        {question.type === 'multiple' && <p className="article-quiz-card__hint">Выберите все подходящие варианты</p>}
        {question.options.map((option, optionIndex) => <div className="article-quiz-card__answer" key={optionIndex}>
          <label className="article-quiz-choice">
            <input type={question.type === 'multiple' ? 'checkbox' : 'radio'} name={`question-${index}`} checked={selected.includes(optionIndex)} onChange={() => onAnswer(index, question.type !== 'multiple' ? [optionIndex] : selected.includes(optionIndex) ? selected.filter(item => item !== optionIndex) : [...selected, optionIndex])} />
            <span className="article-quiz-choice__letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
            <span className="article-quiz-choice__text">{option}</span>
          </label>
        </div>)}
      </fieldset>
      <div className="article-quiz-card__footer">
        <span className="article-quiz-card__message" role="status">{preview ? "\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440" : ""}</span>
        {!last ? <button type="button" className="article-quiz-card__next" disabled={busy || (!preview && selected.length === 0)} onClick={() => go(index + 1)}>Далее</button>
          : !preview && (firstMissing >= 0 && firstMissing !== index
            ? <button type="button" className="article-quiz-card__next" disabled={busy} onClick={() => go(firstMissing)}>К пропущенному вопросу</button>
            : <button type="submit" className="article-quiz-card__next" disabled={busy || firstMissing >= 0}>{busy ? 'Проверка…' : 'Проверить ответы'}</button>)}
      </div>
    </form>

  </>;
}
