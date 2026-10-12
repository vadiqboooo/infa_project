import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Wrench } from 'lucide-react';
import type { GroupLesson } from '../api/types';
import { formatPlanDate, getPlanItemState, planItemTypeLabel, type PlanRow } from '../lib/groupPreparationPlan';
import './LessonPlanHome.css';

type StepState = 'done' | 'overdue' | 'progress' | 'todo';

const SECTION_ORDER = { theory: 0, testing: 1, lesson: 2, homework: 3 } as const;
const monthKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (iso: string) => {
  const label = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const shortDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '');
const longDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(iso));

function stepState(row: PlanRow, now: number): StepState {
  const state = getPlanItemState(row, now);
  if (state.complete) return 'done';
  if (state.overdue) return 'overdue';
  if (state.inProgress || row.item.solved > 0) return 'progress';
  return 'todo';
}

function orderedItems(lesson: GroupLesson) {
  return [...lesson.items].sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section]);
}

export function LessonPlanHome({ lessons, name }: { lessons: GroupLesson[]; name?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [month, setMonth] = useState('all');
  const [pickedId, setPickedId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = useMemo(
    () => [...lessons].sort((a, b) => new Date(a.lesson_at).getTime() - new Date(b.lesson_at).getTime() || a.id - b.id),
    [lessons],
  );

  const currentId = useMemo(() => {
    const started = sorted.filter((lesson) => new Date(lesson.lesson_at).getTime() <= now && lesson.items.length > 0);
    return (started.at(-1) ?? sorted.find((lesson) => lesson.items.length > 0) ?? sorted[0])?.id ?? null;
  }, [sorted, now]);

  const selected = sorted.find((lesson) => lesson.id === (pickedId ?? currentId)) ?? sorted[0];

  const months = useMemo(() => {
    const seen = new Map<string, string>();
    sorted.forEach((lesson) => {
      const key = monthKey(lesson.lesson_at);
      if (!seen.has(key)) seen.set(key, monthLabel(lesson.lesson_at));
    });
    return [{ key: 'all', label: 'Все' }, ...[...seen].map(([key, label]) => ({ key, label }))];
  }, [sorted]);

  const visible = sorted.filter((lesson) => month === 'all' || monthKey(lesson.lesson_at) === month);

  const debts = useMemo(() => {
    const rows: { lesson: GroupLesson; title: string; overdue: string; days: number }[] = [];
    sorted.forEach((lesson) => lesson.items.forEach((item) => {
      const state = getPlanItemState({ lesson, item }, now);
      if (state.overdue) {
        const days = Number(state.deadlineText.match(/\d+/)?.[0] ?? 0);
        rows.push({ lesson, title: item.title, overdue: state.deadlineText.replace('Просрочено на ', ''), days });
      }
    }));
    return rows.sort((a, b) => b.days - a.days);
  }, [sorted, now]);

  const groupNames = [...new Set(lessons.map((lesson) => lesson.group_name))];
  const items = selected ? orderedItems(selected) : [];
  const doneCount = selected ? items.filter((item) => stepState({ lesson: selected, item }, now) === 'done').length : 0;

  return (
    <div className="lesson-home">
      <div className="lesson-home__inner">
        <header className="lesson-home__hello">
          <h1>{name ? `Привет, ${name}` : 'Привет'}</h1>
          {groupNames.length > 0 && <span>· {groupNames.length > 1 ? 'Группы' : 'Группа'} {groupNames.map((group) => `«${group}»`).join(', ')}</span>}
        </header>

        <section className="lesson-home__card" aria-label="Мои уроки">
          <div className="lesson-home__bar">
            <h2>Мои уроки</h2>
            {months.length > 2 && (
              <div className="lesson-home__months" role="group" aria-label="Месяц">
                {months.map((item) => (
                  <button key={item.key} type="button" aria-pressed={month === item.key} onClick={() => setMonth(item.key)}>{item.label}</button>
                ))}
              </div>
            )}
          </div>

          <div className="lesson-home__chips">
            {visible.map((lesson) => {
              const states = orderedItems(lesson).map((item) => stepState({ lesson, item }, now));
              const left = states.filter((value) => value !== 'done').length;
              const hasOverdue = states.includes('overdue');
              return (
                <button key={lesson.id} type="button" className="lesson-home__chip" aria-pressed={lesson.id === selected?.id} onClick={() => setPickedId(lesson.id)}>
                  <span className="lesson-home__chip-head">
                    <span>{shortDate(lesson.lesson_at)}</span>
                    {lesson.id === currentId && <span className="lesson-home__badge">текущий</span>}
                  </span>
                  <span className="lesson-home__chip-topic">{lesson.title}</span>
                  <span className="lesson-home__dots" aria-hidden="true">
                    {states.map((value, index) => <i key={index} data-s={value} />)}
                  </span>
                  <span className="lesson-home__chip-status" data-s={hasOverdue ? 'overdue' : undefined}>
                    {states.length === 0 ? 'материалы появятся позже' : left === 0 ? 'всё сделано' : hasOverdue ? `есть долги · осталось ${left}` : `осталось ${left}`}
                  </span>
                </button>
              );
            })}
          </div>

          {debts.length > 0 && (
            <div className="lesson-home__debts">
              <div className="lesson-home__debts-title"><span>Нужно доделать</span><b>{debts.length}</b></div>
              {debts.map((debt, index) => (
                <button key={`${debt.lesson.id}:${index}`} type="button" className="lesson-home__debt" onClick={() => setPickedId(debt.lesson.id)}>
                  <strong>{debt.title}</strong>
                  <span>{shortDate(debt.lesson.lesson_at)}</span>
                  <em>{debt.overdue}</em>
                </button>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <article className="lesson-home__card lesson-home__lesson">
            <div className="lesson-home__lesson-head">
              <div>
                <div className="lesson-home__eyebrow" data-current={selected.id === currentId}>
                  {selected.id === currentId ? 'Текущий урок' : 'Урок'} · {longDate(selected.lesson_at)}
                </div>
                <h2>{selected.title}</h2>
              </div>
              {items.length > 0 && <div className="lesson-home__count">сделано {doneCount} из {items.length}</div>}
            </div>
            {selected.note && <p className="lesson-home__note">{selected.note}</p>}

            {items.length === 0 ? (
              <p className="lesson-home__note">Преподаватель ещё не добавил материалы к этому уроку.</p>
            ) : (
              <ol className="lesson-home__steps">
                {items.map((item, index) => {
                  const row = { lesson: selected, item };
                  const state = getPlanItemState(row, now);
                  const value = stepState(row, now);
                  const showAction = !state.upcoming || state.inProgress || state.overdue || state.complete;
                  const actionLabel = value === 'done' ? 'Повторить' : value === 'progress' ? 'Продолжить' : 'Начать';
                  const meta = item.resource_type === 'article' || item.resource_type === 'quiz'
                    ? (item.subtitle ?? '')
                    : `${item.solved} из ${item.total} задач`;
                  const pill = state.deadline && value !== 'done' ? state.deadlineText : '';
                  return (
                    <li key={item.id} className="lesson-home__step" data-s={value}>
                      <div className="lesson-home__step-top">
                        <span className="lesson-home__ring" data-s={value}>
                          {value === 'done' ? <Check size={16} strokeWidth={3} aria-label="Сделано" /> : index + 1}
                        </span>
                        {pill && <span className="lesson-home__pill" data-s={value === 'overdue' ? 'overdue' : undefined}>{pill}</span>}
                      </div>
                      <div className="lesson-home__step-body">
                        <span className="lesson-home__kind">{planItemTypeLabel(item)}</span>
                        <span className="lesson-home__step-title">{item.title}</span>
                        {meta && <span className="lesson-home__step-meta">{meta}</span>}
                        {state.upcoming && !showAction && <span className="lesson-home__step-meta">откроется {formatPlanDate(selected.lesson_at)}</span>}
                      </div>
                      {showAction && (
                        <Link className="lesson-home__action" data-s={value === 'done' ? 'done' : value === 'overdue' ? 'overdue' : undefined} to={item.href}>
                          {actionLabel}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </article>
        )}

        <section className="lesson-home__review" aria-label="Повторение">
          <h2>Повторение на неделе</h2>
          <p>Короткие видео, чтобы вспомнить пройденное</p>
          <div className="lesson-home__stub">
            <Wrench size={20} aria-hidden="true" />
            <strong>Раздел в разработке</strong>
            <span>Скоро здесь появятся короткие видео и топики для повторения пройденного</span>
          </div>
        </section>
      </div>
    </div>
  );
}
