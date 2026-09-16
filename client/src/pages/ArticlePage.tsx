import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { ArticleQuiz } from '../components/ArticleQuiz';
import { ArticleContent } from '../components/ArticleContent';
import { articleRequest, type AdminArticle, type ArticleProgress, type QuizResult, type StudentArticle } from '../api/articles';
import './ArticlePage.css';

export default function ArticlePage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const mode = search.get('mode') === 'theory' ? 'theory' : search.get('mode') === 'quiz' ? 'quiz' : 'full';
  return <ArticleReader key={`${id}:${search.get('preview')}:${mode}`} id={id!} preview={search.get('preview') === '1'} mode={mode} />;
}

function ArticleReader({ id, preview, mode }: { id: string; preview: boolean; mode: 'full' | 'theory' | 'quiz' }) {
  const queryClient = useQueryClient();
  const [article, setArticle] = useState<StudentArticle | null>(null);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        let data: StudentArticle;
        if (preview) {
          const draft = await articleRequest<AdminArticle>(`/admin/articles/${id}`, { signal: controller.signal }, localStorage.getItem('admin_api_key') || undefined);
          data = { ...draft, progress: { read: false, best_score: 0, total: draft.questions.length, attempts: 0, completed: false } };
        } else {
          data = await articleRequest<StudentArticle>(`/articles/${id}`, { signal: controller.signal });
        }
        if (controller.signal.aborted) return;
        setArticle(data);
        setAnswers(data.questions.map(() => []));
        document.title = `${data.title} — RanchEasy`;
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить статью');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [id, preview]);

  const saveProgress = (progress: ArticleProgress) => {
    setArticle(current => current && { ...current, progress });
    void queryClient.invalidateQueries({ queryKey: ['group-plan'] });
  };

  const markRead = async () => {
    if (!article) return;
    setBusy(true); setError('');
    try {
      saveProgress(await articleRequest<ArticleProgress>(`/articles/${id}/read`, { method: 'POST', body: JSON.stringify({ revision: article.revision }) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить прогресс'); }
    finally { setBusy(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!article) return;
    setBusy(true); setError('');
    try {
      const data = await articleRequest<QuizResult>(`/articles/${id}/quiz`, { method: 'POST', body: JSON.stringify({ revision: article.revision, answers }) });
      setResult(data); saveProgress(data.progress);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось проверить ответы'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="article-page" role="status">Загрузка статьи…</div>;
  if (!article) return <div className="article-page"><Link to="/">← К плану уроков</Link><p role="alert">{error}</p><button className="article-button" onClick={() => window.location.reload()}>Повторить</button></div>;
  return <div className={`article-page${mode === 'quiz' ? ' article-page--test' : ''}`}>
    {mode === 'quiz' && <div className="article-test-return"><Link className="article-test-back" to={preview ? '/admin' : '/'} title={preview ? 'В админку' : 'К плану уроков'}><ArrowLeft size={16} />Назад</Link></div>}
    <div className="article-shell">
      {mode !== 'quiz' && <Link className="article-back" to={preview ? '/admin' : '/'}><ArrowLeft size={17} />{preview ? 'В админку' : 'К плану уроков'}</Link>}
      {mode === 'quiz' && <header className="article-test-header">
        <span className="article-test-type">Тест</span>
        <h1 id="quiz-title">{article.title}</h1>
      </header>}
      {preview && <p className="article-notice">Предпросмотр статьи. Для прохождения теста откройте опубликованную статью.</p>}
      {mode === 'quiz' && <p className="article-test-description">Ответьте на вопросы по <Link to={`/articles/${id}?mode=theory${preview ? '&preview=1' : ''}`}>статье</Link>. Для завершения теста нужны все верные ответы. Если ошибётесь, можно попробовать снова.</p>}
      {mode !== 'quiz' && <article className={`article-paper${article.content_format === 'html' ? ' article-paper--html' : ''}`}>
        <div className="article-eyebrow"><BookOpen size={16} />{mode === 'theory' ? 'Теория' : 'Статья'}{mode === 'full' && article.questions.length > 0 && ` · ${article.questions.length} вопросов после чтения`}</div>
        {(article.content_format !== 'html' || !/<h1[\s>]/i.test(article.content)) && <h1>{article.title}</h1>}
        <ArticleContent content={article.content} format={article.content_format} />
        {!preview && <div className="article-read">
          {article.progress.read ? <span><CheckCircle2 size={18} />Статья прочитана</span> : <button className="article-button" disabled={busy} onClick={markRead}>{busy ? 'Сохранение…' : mode === 'full' && article.questions.length ? 'Прочитал — перейти к тесту' : 'Отметить прочитанной'}</button>}
          {mode === 'theory' && article.progress.read && article.questions.length > 0 && <Link className="article-button article-theory-next" to={`/articles/${id}?mode=quiz`}>Пройти тест по теории</Link>}
        </div>}
      </article>}
      {error && <p className="article-error" role="alert">{error}</p>}
      {mode === 'quiz' && article.questions.length === 0 && <p className="article-notice">В этой статье пока нет теста.</p>}
      {mode !== 'theory' && article.questions.length > 0 && <section className={`article-quiz${mode === 'quiz' ? ' article-quiz--standalone' : ''}`} aria-labelledby="quiz-title">
        {mode !== 'quiz' && <><h2 id="quiz-title">Проверьте себя</h2><p>Ответьте на все вопросы. Для завершения нужны все верные ответы. Тест можно проходить повторно.</p></>}
        {article.progress.attempts > 0 && <p className="article-notice">Лучший результат: {article.progress.best_score} из {article.progress.total}. Попыток: {article.progress.attempts}.</p>}
        {!article.progress.read && !preview ? <p className="article-notice">{mode === 'quiz' ? <><Link to={`/articles/${id}?mode=theory`}>Сначала прочитайте теорию</Link> и отметьте статью прочитанной. Затем вернитесь к тесту.</> : 'После чтения нажмите «Прочитал — перейти к тесту».'}</p> : <ArticleQuiz
          questions={article.questions} answers={answers} result={result} busy={busy} preview={preview}
          onAnswer={(index, selected) => setAnswers(current => current.map((value, i) => i === index ? selected : value))}
          onSubmit={submit}
          onRetry={() => { setResult(null); setAnswers(article.questions.map(() => [])); }}
        />}
      </section>}
      {(mode === 'theory' ? article.progress.read : article.progress.completed) && <p className="article-notice" role="status">{mode === 'theory' ? 'Теория изучена.' : mode === 'quiz' ? 'Тест пройден.' : 'Материал выполнен.'} Прогресс сохранён в плане уроков.</p>}
    </div>
  </div>;
}
