import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, FileText, Plus, Save, Search, Trash2, Upload } from 'lucide-react';
import { articleRequest, type AdminArticle, type AdminArticleQuestion, type ArticleDraft, type ArticleSummary } from '../../api/articles';
import { ArticleContent } from '../ArticleContent';
import { articleQuizExample } from '../../data/articleQuizExample';
import { ARTICLE_CONTENT_LIMIT, importArticleHtml } from '../../lib/articleHtml';
import './ArticlesPanel.css';

const emptyDraft = (): ArticleDraft => ({ title: '', content: '', content_format: 'markdown', published: false, questions: [] });
const emptyQuestion = (): AdminArticleQuestion => ({ prompt: '', type: 'single', options: ['', ''], correct_answers: [0], explanation: '' });

export function ArticlesPanel({ apiKey }: { apiKey: string }) {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [saved, setSaved] = useState<AdminArticle | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const htmlFileInput = useRef<HTMLInputElement>(null);
  const request = useCallback(<T,>(path: string, options?: RequestInit) => articleRequest<T>(path, options, apiKey), [apiKey]);
  const load = useCallback(async () => {
    setLoading(true);
    try { setArticles(await request<ArticleSummary[]>('/admin/articles')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить статьи'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = (patch: Partial<ArticleDraft>) => { setDraft(current => current && { ...current, ...patch }); setDirty(true); setMessage(''); };
  const importHtml = async (file?: File) => {
    if (!file || !draft) return;
    if (draft.content.trim() && !window.confirm('Заменить текст статьи содержимым HTML-файла? Вопросы теста сохранятся.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const imported = await importArticleHtml(file);
      edit({ content: imported.content, content_format: 'html', title: draft.title.trim() || imported.title });
      setPreview(true);
      setMessage(`Файл «${file.name}» загружен. Проверьте предпросмотр и сохраните статью.${imported.localResources ? ' В файле есть локальные ссылки на ресурсы: замените их на доступные ссылки или встроенные изображения.' : ''}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось прочитать HTML-файл'); }
    finally { setBusy(false); }
  };
  const close = () => {
    if (dirty && !window.confirm('Закрыть статью без сохранения изменений?')) return;
    setDraft(null); setSaved(null); setDirty(false); setError(''); setMessage('');
  };
  const open = async (id: number) => {
    setBusy(true); setError(''); setMessage(''); setPreview(false);
    try { const data = await request<AdminArticle>(`/admin/articles/${id}`); setSaved(data); setDraft(data); setDirty(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось открыть статью'); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = { ...draft, ...(saved ? { revision: saved.revision } : {}) };
      const data = await request<AdminArticle>(saved ? `/admin/articles/${saved.id}` : '/admin/articles', { method: saved ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setDraft(data); setSaved(data); setDirty(false); setMessage(data.published ? 'Статья опубликована. Её можно прикрепить к плану урока.' : 'Черновик сохранён. Ученики увидят статью после публикации.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить статью'); }
    finally { setBusy(false); }
  };
  const remove = async (article: ArticleSummary) => {
    if (!window.confirm(`Удалить статью «${article.title}» и результаты её теста?`)) return;
    setBusy(true); setError('');
    try { await request(`/admin/articles/${article.id}`, { method: 'DELETE' }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить статью'); }
    finally { setBusy(false); }
  };
  const updateQuestion = (index: number, value: AdminArticleQuestion) => edit({ questions: draft!.questions.map((question, i) => i === index ? value : question) });
  const moveQuestion = (index: number, direction: number) => {
    const questions = [...draft!.questions];
    [questions[index], questions[index + direction]] = [questions[index + direction], questions[index]];
    edit({ questions });
  };

  return <div className="articles-admin">
    {draft ? <form onSubmit={save}>
      <div className="articles-admin__toolbar"><button className="article-button article-button--secondary" type="button" onClick={close} disabled={busy}><ArrowLeft size={16} />Все статьи</button><button className="article-button" disabled={busy || (saved !== null && !dirty)}><Save size={16} />{busy ? 'Сохранение…' : 'Сохранить'}</button></div>
      <fieldset disabled={busy} className="articles-admin__fields">
        <label className="articles-admin__field">Название статьи<input autoFocus required maxLength={200} value={draft.title} onChange={event => edit({ title: event.target.value })} placeholder="Например: Как компьютер научился понимать буквы" /></label>
        <label className="articles-admin__publish"><input type="checkbox" checked={draft.published} onChange={event => edit({ published: event.target.checked })} />Опубликовать — статья доступна ученикам по ссылке</label>
        {saved && <div className="articles-admin__links"><a href={`/articles/${saved.id}?preview=1`} target="_blank" rel="noreferrer"><ExternalLink size={15} />Предпросмотр сохранённой статьи</a>{saved.published && <a href={`/articles/${saved.id}`} target="_blank" rel="noreferrer">Ссылка для учеников: /articles/{saved.id}</a>}</div>}
        {saved && <p className="articles-admin__hint">После сохранения новой версии ученикам потребуется заново прочитать статью и пройти тест.</p>}
        <div className="articles-admin__toolbar"><h3>Текст статьи</h3><div className="articles-admin__actions"><button type="button" className="article-button article-button--secondary" onClick={() => htmlFileInput.current?.click()}><Upload size={16} />Загрузить HTML</button><button type="button" className="article-button article-button--secondary" onClick={() => setPreview(value => !value)}>{preview ? 'Редактировать текст' : 'Предпросмотр текста'}</button></div></div>
        <input ref={htmlFileInput} type="file" accept=".html,.htm,text/html" className="hidden" aria-label="HTML-файл статьи" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importHtml(file); }} />
        <label className="articles-admin__field">Формат текста<select value={draft.content_format || 'markdown'} onChange={event => { edit({ content_format: event.target.value as ArticleDraft['content_format'] }); setPreview(false); }}><option value="markdown">Markdown</option><option value="html">HTML — готовая статья</option></select></label>
        <p className="articles-admin__hint">{draft.content_format === 'html' ? 'Загрузите .html/.htm или вставьте HTML-код целиком, включая стили. Текст оформляется как статья, стили схем и таблиц сохраняются. Изображения должны быть встроены в файл или доступны по интернет-ссылкам.' : 'Markdown: ## Заголовок, **жирный текст**, - пункт списка, [ссылка](https://…), ![описание](ссылка на изображение).'}</p>
        {preview ? <div className="articles-admin__preview"><ArticleContent content={draft.content || 'Здесь появится текст статьи'} format={draft.content_format} /></div> : <label className="articles-admin__field"><span className="sr-only">{draft.content_format === 'html' ? 'HTML-код статьи' : 'Текст статьи в Markdown'}</span><textarea rows={16} maxLength={ARTICLE_CONTENT_LIMIT} value={draft.content} onChange={event => edit({ content: event.target.value })} placeholder={draft.content_format === 'html' ? '<!DOCTYPE html>… или <article>…</article>' : 'Текст статьи…'} spellCheck={draft.content_format !== 'html'} /></label>}
        {(error || message) && <p className={error ? 'article-error' : 'article-notice'} role={error ? 'alert' : 'status'}>{error || message}</p>}
        <div className="articles-admin__toolbar"><div><h3>Тест после статьи</h3><p className="articles-admin__hint">Необязательно. Отметьте правильные варианты слева от ответа.</p></div><span>{draft.questions.length}/100</span></div>
        {draft.questions.length === 0 && <div className="article-notice">Без теста материал завершается после отметки «Прочитано».<button className="articles-admin__example" type="button" onClick={() => edit({ title: draft.title || 'Как компьютер научился понимать буквы', questions: structuredClone(articleQuizExample) })}>Загрузить пример: «Как компьютер научился понимать буквы» (10 вопросов)</button></div>}
        {draft.questions.map((question, index) => <div className="articles-admin__question" key={index}>
          <div className="articles-admin__toolbar"><h4>Вопрос {index + 1}</h4><div className="articles-admin__actions"><button type="button" aria-label="Поднять вопрос" disabled={index === 0} onClick={() => moveQuestion(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label="Опустить вопрос" disabled={index === draft.questions.length - 1} onClick={() => moveQuestion(index, 1)}><ArrowDown size={16} /></button><button type="button" aria-label="Удалить вопрос" onClick={() => edit({ questions: draft.questions.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div></div>
          <label className="articles-admin__field">Вопрос<textarea required rows={2} maxLength={2000} value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} /></label>
          <label className="articles-admin__field">Тип ответа<select value={question.type} onChange={event => {
            const type = event.target.value as AdminArticleQuestion['type'];
            updateQuestion(index, { ...question, type, options: type === 'boolean' ? ['Верно', 'Неверно'] : question.options, correct_answers: type === 'boolean' ? [0] : type === 'single' ? [question.correct_answers[0] ?? 0] : question.correct_answers });
          }}><option value="single">Один правильный ответ</option><option value="multiple">Несколько правильных ответов</option><option value="boolean">Верно / Неверно</option></select></label>
          {question.options.map((option, optionIndex) => <div className="articles-admin__option" key={optionIndex}>
            <input aria-label={`Правильный ответ ${String.fromCharCode(65 + optionIndex)}, вопрос ${index + 1}`} type={question.type === 'multiple' ? 'checkbox' : 'radio'} name={`correct-${index}`} checked={question.correct_answers.includes(optionIndex)} onChange={() => updateQuestion(index, { ...question, correct_answers: question.type !== 'multiple' ? [optionIndex] : question.correct_answers.includes(optionIndex) ? question.correct_answers.filter(item => item !== optionIndex) : [...question.correct_answers, optionIndex] })} />
            <span>{String.fromCharCode(65 + optionIndex)}.</span><input aria-label={`Вариант ${String.fromCharCode(65 + optionIndex)}, вопрос ${index + 1}`} required maxLength={2000} readOnly={question.type === 'boolean'} value={option} onChange={event => updateQuestion(index, { ...question, options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} />
            {question.type !== 'boolean' && question.options.length > 2 && <button type="button" aria-label="Удалить вариант" onClick={() => updateQuestion(index, { ...question, options: question.options.filter((_, i) => i !== optionIndex), correct_answers: question.correct_answers.filter(value => value !== optionIndex).map(value => value > optionIndex ? value - 1 : value) })}><Trash2 size={15} /></button>}
          </div>)}
          {question.type !== 'boolean' && question.options.length < 10 && <button type="button" className="articles-admin__example" onClick={() => updateQuestion(index, { ...question, options: [...question.options, ''] })}>+ Вариант ответа</button>}
          <label className="articles-admin__field">Пояснение для преподавателя (ученику не показывается)<textarea rows={2} maxLength={5000} value={question.explanation} onChange={event => updateQuestion(index, { ...question, explanation: event.target.value })} /></label>
        </div>)}
        <button type="button" className="article-button article-button--secondary" disabled={draft.questions.length >= 100} onClick={() => edit({ questions: [...draft.questions, emptyQuestion()] })}><Plus size={16} />Добавить вопрос</button>
      </fieldset>
      <div className="articles-admin__toolbar articles-admin__footer"><span>{dirty ? 'Есть несохранённые изменения' : ''}</span><button className="article-button" disabled={busy || (saved !== null && !dirty)}><Save size={16} />Сохранить статью</button></div>
    </form> : <>
      <div className="articles-admin__toolbar"><div><h2>Статьи</h2><p className="articles-admin__hint">Материалы для чтения и тесты к урокам</p></div><button className="article-button" disabled={busy} onClick={() => { setDraft(emptyDraft()); setSaved(null); setDirty(false); setError(''); setMessage(''); setPreview(false); }}><Plus size={17} />Создать статью</button></div>
      <label className="articles-admin__search"><Search size={17} /><input aria-label="Поиск статей" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти статью…" /></label>
      {error && <p className="article-error" role="alert">{error}</p>}
      {loading ? <p role="status">Загрузка статей…</p> : <div className="articles-admin__list">{articles.filter(article => article.title.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))).map(article => <div className="articles-admin__row" key={article.id}>
        <FileText size={24} /><button type="button" className="articles-admin__title" onClick={() => open(article.id)} disabled={busy}><strong>{article.title}</strong><span>{article.published ? 'Опубликовано' : 'Черновик'} · {article.question_count ? `Вопросов: ${article.question_count}` : 'Без теста'}</span></button><a href={`/articles/${article.id}?preview=1`} target="_blank" rel="noreferrer" title="Предпросмотр"><ExternalLink size={17} /></a><button type="button" disabled={busy} onClick={() => remove(article)} aria-label={`Удалить статью ${article.title}`}><Trash2 size={17} /></button>
      </div>)}{articles.length === 0 && <p className="article-notice">Создайте первую статью. После сохранения она появится в редакторе плана урока в разделе «Статьи».</p>}{articles.length > 0 && !articles.some(article => article.title.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))) && <p>Статьи не найдены.</p>}</div>}
    </>}
  </div>;
}
