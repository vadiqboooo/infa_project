import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import type { AnswerVal, TaskNav, TopicNav } from '../api/types';
import { useCheckAnswer, useTask } from '../hooks/useApi';
import AnswerInput from './AnswerInput';
import TaskView from './TaskView';
import './VerticalTaskList.css';

interface Props {
    topic: TopicNav;
    answers: Record<number, AnswerVal>;
    subAnswers: Record<string, AnswerVal>;
    onAnswerChange: (taskId: number, value: AnswerVal) => void;
    onSubAnswerChange: (key: string, value: AnswerVal) => void;
    scrollToTaskId: number | null;
}

function hasAnswer(value: AnswerVal | undefined): boolean {
    if (Array.isArray(value)) return value.flat().some(item => String(item).trim() !== '');
    return value !== undefined && String(value).trim() !== '';
}

function TaskCard({ nav, number, topic, answers, subAnswers, onAnswerChange, onSubAnswerChange }: Omit<Props, 'scrollToTaskId'> & { nav: TaskNav; number: number }) {
    const cardRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        const card = cardRef.current;
        if (!card || nav.is_locked || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '600px' });
        observer.observe(card);
        return () => observer.disconnect();
    }, [nav.is_locked]);

    const { data: task, isError, refetch } = useTask(visible && !nav.is_locked ? nav.id : null);
    const check = useCheckAnswer(nav.id);
    const result = check.data;
    const value = answers[nav.id] ?? '';
    const isMath = topic.subject === 'math' || topic.category === 'math';
    const ready = hasAnswer(value) && (task?.sub_tasks ?? []).every((_, i) => hasAnswer(subAnswers[`${nav.id}:${i}`]));

    const submit = async () => {
        if (!task || !ready || check.isPending) return;
        try {
            await check.mutateAsync(task.sub_tasks?.length
                ? { answers: [value, ...task.sub_tasks.map((_, i) => subAnswers[`${nav.id}:${i}`] ?? '')] }
                : { val: value });
        } catch {
            // The mutation error is displayed in this card and can be retried.
        }
    };

    return (
        <article ref={cardRef} id={`vertical-task-${nav.id}`} className="vertical-task-card" aria-label={`Задача ${number}`}>
            <div className="vertical-task-number">
                <span className="vertical-task-badge">{number}</span>
                {nav.status === 'solved' && <Check size={16} aria-label="Решена" />}
            </div>
            <div className="vertical-task-content">
                {nav.is_locked ? (
                    <p className="vertical-task-muted"><Lock size={16} /> Задача недоступна по текущему доступу</p>
                ) : isError ? (
                    <div role="alert">Не удалось загрузить задачу. <button type="button" className="vertical-task-link" onClick={() => void refetch()}>Повторить</button></div>
                ) : !task ? (
                    <div className="vertical-task-loading" role="status"><Loader2 size={18} className="animate-spin" /> Загрузка задачи…</div>
                ) : (
                    <>
                        <TaskView content={task.content_html} files={task.media_resources?.files} />
                        <form onSubmit={event => { event.preventDefault(); void submit(); }}>
                            <div className="vertical-task-answer-row">
                                <div className="vertical-task-answer" role="group" aria-label={`Ответ на задачу ${number}`}>
                                    <span className="vertical-task-answer-label">{task.sub_tasks?.length ? `Ответ ${task.ege_number ?? number}` : 'Ответ'}</span>
                                    <AnswerInput
                                        type={task.answer_type}
                                        value={value}
                                        onChange={next => { check.reset(); onAnswerChange(nav.id, next); }}
                                        disabled={check.isPending}
                                        egeNumber={task.ege_number ?? undefined}
                                        isMath={isMath}
                                        feedback={result?.partial_correct}
                                    />
                                </div>
                                {!task.sub_tasks?.length && <button className="vertical-task-check" type="submit" disabled={!ready || check.isPending}>
                                    {check.isPending ? <Loader2 size={18} className="animate-spin" /> : result?.correct ? <><Check size={18} /> Верно</> : 'Проверить'}
                                </button>}
                            </div>
                            {task.sub_tasks?.map((sub, i) => (
                                <div key={i} className="vertical-task-sub">
                                    <TaskView content={sub.content_html} />
                                    <div className="vertical-task-answer" role="group" aria-label={`Ответ ${sub.number ?? i + 2}`}>
                                        <span className="vertical-task-answer-label">Ответ {sub.number ?? i + 2}</span>
                                        <AnswerInput
                                            type={sub.answer_type}
                                            value={subAnswers[`${nav.id}:${i}`] ?? ''}
                                            onChange={next => { check.reset(); onSubAnswerChange(`${nav.id}:${i}`, next); }}
                                            disabled={check.isPending}
                                            egeNumber={sub.number ?? undefined}
                                            isMath={isMath}
                                        />
                                    </div>
                                </div>
                            ))}
                            {!!task.sub_tasks?.length && <button className="vertical-task-check" type="submit" disabled={!ready || check.isPending}>
                                {check.isPending ? <Loader2 size={18} className="animate-spin" /> : 'Проверить ответы'}
                            </button>}
                            <div aria-live="polite">
                                {result && <p className={`vertical-task-result ${result.correct ? 'is-correct' : 'is-wrong'}`}>
                                    {result.correct ? 'Верно! Задача решена.' : 'Пока неверно. Попробуйте ещё раз.'}
                                    {result.sub_results && !result.correct && ` Верных ответов: ${result.sub_results.filter(Boolean).length} из ${result.sub_results.length}.`}
                                </p>}
                                {check.isError && <p className="vertical-task-result is-wrong" role="alert">Не удалось проверить ответ. Попробуйте ещё раз.</p>}
                            </div>
                        </form>
                    </>
                )}
            </div>
        </article>
    );
}

export default function VerticalTaskList(props: Props) {
    const { topic, scrollToTaskId } = props;
    useEffect(() => {
        if (scrollToTaskId) document.getElementById(`vertical-task-${scrollToTaskId}`)?.scrollIntoView({ block: 'start' });
    }, [topic.id, scrollToTaskId]);

    return (
        <div className="vertical-task-list">
            <div className="vertical-task-list-heading">
                <h1>{topic.title}</h1>
                <span>Решено {topic.tasks.filter(task => task.status === 'solved').length} из {topic.tasks.length}</span>
            </div>
            {topic.tasks.length === 0 && <p className="vertical-task-empty">В этом топике пока нет задач.</p>}
            {topic.tasks.map((nav, index) => <TaskCard key={nav.id} {...props} nav={nav} number={index + 1} />)}
        </div>
    );
}
