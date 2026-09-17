import { useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import type { AdminArticleQuestion } from '../../api/articles';
import { parseArticleQuiz } from '../../lib/articleQuizImport';

const example = `Название теста (необязательно)

1. Сколько цветов можно закодировать тремя битами?
A. 8
B. 6
C. 3
D. 16
Ответ: A

2. Пиксель — элемент растрового изображения.
Верно
Неверно
Ответ: Верно`;

export function ArticleQuizImport({ remaining, onImport }: {
  remaining: number;
  onImport: (questions: AdminArticleQuestion[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const importQuestions = () => {
    try {
      const questions = parseArticleQuiz(text);
      if (questions.length > remaining) throw new Error(`Недостаточно места: найдено вопросов — ${questions.length}, можно добавить — ${remaining}. Лимит теста — 100 вопросов.`);
      onImport(questions);
      setText(''); setError(''); setExpanded(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось распознать тест');
    }
  };

  return <div className="articles-admin__import">
    <button type="button" className="article-button article-button--secondary" aria-expanded={expanded} aria-controls="article-quiz-import" onClick={() => setExpanded(value => !value)}>
      <ClipboardPaste size={16} />{expanded ? 'Скрыть вставку теста' : 'Вставить тест целиком'}
    </button>
    {expanded && <div id="article-quiz-import">
      <p className="articles-admin__hint" id="article-quiz-import-help">Вставьте все вопросы сразу, как в примере ниже. Поддерживаются номера 1. или 1), варианты A. / B. или А. / Б. и «Верно / Неверно» отдельными строками. Заголовок перед первым вопросом пропускается. Фраза «Выбери все подходящие варианты» включает несколько ответов.</p>
      <label className="articles-admin__field">Текст теста<textarea rows={14} value={text} onChange={event => { setText(event.target.value); setError(''); }} placeholder={example} aria-describedby="article-quiz-import-help article-quiz-import-answers" /></label>
      <p className="articles-admin__hint" id="article-quiz-import-answers">Правильные ответы можно указать под каждым вопросом: «Ответ: B», «Ответ: B, C» или «Ответ: Верно». Если их нет, отметьте ответы в редакторе после добавления. Проверьте типы вопросов перед сохранением.</p>
      {error && <p className="article-error" role="alert">{error}</p>}
      <button type="button" className="article-button" disabled={!text.trim() || remaining === 0} onClick={importQuestions}>Добавить вопросы из текста</button>
      <p className="articles-admin__hint">Вопросы добавятся в конец текущего теста. Доступно: {remaining} из 100. Затем сохраните статью.</p>
    </div>}
  </div>;
}
