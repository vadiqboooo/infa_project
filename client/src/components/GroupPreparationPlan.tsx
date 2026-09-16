import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock3, Pin, Search, TriangleAlert } from 'lucide-react';
import type { GroupLesson, GroupLessonSection } from '../api/types';
import { buildPlanSections, formatPlanDate, getPlanItemState, planItemTypeLabel, type PlanRow, type PlanSection } from '../lib/groupPreparationPlan';
import './GroupPreparationPlan.css';

const filters = [
  { value: 'all', label: 'Всё' },
  { value: 'theory', label: 'Теория' },
  { value: 'testing', label: 'Тесты' },
  { value: 'lesson', label: 'На уроке' },
  { value: 'homework', label: 'ДЗ' },
] as const;
const sectionIcons = { overdue: TriangleAlert, current: Pin, upcoming: CalendarDays, previous: Clock3, completed: CheckCircle2 };

export function GroupPreparationPlan({ lessons, loading }: { lessons: GroupLesson[]; loading: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | GroupLessonSection>('all');
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sections = buildPlanSections(lessons, now);
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const visibleSections = sections.map((section) => ({
    ...section,
    rows: section.rows.filter(({ lesson, item }) => (filter === 'all' || (filter === 'testing' ? item.resource_type === 'quiz' : item.section === filter))
      && (!normalizedQuery || `${item.title} ${lesson.title}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery))),
  })).filter((section) => section.rows.length > 0);
  const pendingSections = visibleSections.filter((section) => section.kind !== 'completed');
  const history = visibleSections.find((section) => section.kind === 'completed');
  const groupNames = [...new Set(lessons.map((lesson) => lesson.group_name))];
  const hasFilters = Boolean(normalizedQuery || filter !== 'all');

  return (
    <section className="preparation-plan" aria-labelledby="preparation-plan-title" aria-busy={loading}>
      <div className="preparation-plan__header">
        <div>
          <h2 id="preparation-plan-title">План подготовки</h2>
          <p>{groupNames.length ? `${groupNames.length > 1 ? 'Группы' : 'Группа'} ${groupNames.map((name) => `«${name}»`).join(', ')}` : 'Занятия и домашние задания вашей группы'}</p>
        </div>
        <div className="preparation-plan__controls">
          <label className="preparation-plan__search">
            <Search size={14} aria-hidden="true" />
            <input type="search" aria-label="Найти тему" placeholder="Найти тему…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="preparation-plan__filters" role="group" aria-label="Тип материала">
            {filters.map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="preparation-plan__loading" role="status">
          <span className="sr-only">Загрузка плана подготовки</span>
          {[0, 1, 2, 3].map((row) => <div key={row} />)}
        </div>
      ) : sections.length === 0 ? (
        <PlanEmptyState icon={BookOpen} title="План пока не заполнен" description="Когда преподаватель опубликует занятие, материалы появятся здесь." />
      ) : visibleSections.length === 0 ? (
        <PlanEmptyState icon={Search} title="Ничего не найдено" description="Попробуйте другую тему или измените фильтр." />
      ) : (
        <>
          {pendingSections.length > 0 ? <PlanTable sections={pendingSections} now={now} /> : !hasFilters && (
            <PlanEmptyState icon={CheckCircle2} title="Все материалы пройдены" description="Новые материалы появятся здесь после публикации." />
          )}
          {history && (
            <div className="preparation-plan__history">
              <button type="button" className="preparation-plan__history-toggle" aria-expanded={historyOpen || hasFilters} aria-controls="preparation-plan-history" onClick={() => setHistoryOpen((value) => !value)} disabled={hasFilters}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>История выполненных</span>
                <span className="preparation-plan__history-count">{history.rows.length}</span>
                <ChevronRight size={15} className={historyOpen || hasFilters ? 'is-open' : ''} aria-hidden="true" />
              </button>
              {(historyOpen || hasFilters) && <div id="preparation-plan-history"><PlanTable sections={[history]} now={now} hideSectionTitles /></div>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PlanEmptyState({ icon: Icon, title, description }: { icon: typeof BookOpen; title: string; description: string }) {
  return <div className="preparation-plan__empty"><Icon size={28} aria-hidden="true" /><p>{title}</p><span>{description}</span></div>;
}

function PlanTable({ sections, now, hideSectionTitles = false }: { sections: PlanSection[]; now: number; hideSectionTitles?: boolean }) {
  return (
    <div className="preparation-plan__scroll" tabIndex={0} role="region" aria-label={hideSectionTitles ? 'Выполненные материалы' : 'Занятия и задания'}>
      <table className="preparation-plan__table">
        <caption className="sr-only">{hideSectionTitles ? 'Выполненные материалы' : 'План занятий и домашних заданий'}</caption>
        <colgroup><col className="plan-col-type" /><col /><col className="plan-col-date" /><col className="plan-col-deadline" /><col className="plan-col-status" /><col className="plan-col-action" /></colgroup>
        <thead><tr>
          <th scope="col">Тип</th><th scope="col">Тема / прогресс</th><th scope="col">Занятие</th><th scope="col">Дедлайн ДЗ</th><th scope="col">Статус</th><th scope="col"><span className="sr-only">Действие</span></th>
        </tr></thead>
        {sections.map((section) => {
          const Icon = sectionIcons[section.kind];
          return (
            <tbody key={section.id}>
              {!hideSectionTitles && <tr className={`preparation-plan__section preparation-plan__section--${section.kind}`}><th colSpan={6} scope="rowgroup"><span><Icon size={14} aria-hidden="true" />{section.title}</span></th></tr>}
              {section.rows.map((row) => <PlanTableRow key={`${row.lesson.id}:${row.item.id}`} row={row} now={now} kind={section.kind} />)}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function PlanTableRow({ row, now, kind }: { row: PlanRow; now: number; kind: PlanSection['kind'] }) {
  const { lesson, item } = row;
  const state = getPlanItemState(row, now);
  const percent = item.total > 0 ? Math.min(100, Math.max(0, item.solved / item.total * 100)) : 0;
  const tone = state.complete ? 'complete' : state.overdue ? 'overdue' : state.inProgress ? 'progress' : state.upcoming ? 'upcoming' : 'idle';
  return (
    <tr className={`preparation-plan__row preparation-plan__row--${kind}`}>
      <td><span className={`preparation-plan__type preparation-plan__type--${state.overdue ? 'overdue' : item.section}`}>{planItemTypeLabel(item)}</span></td>
      <td>
        <Link className="preparation-plan__topic" to={item.href}>{item.title}</Link>
        <div className="preparation-plan__progress">
          <div className="preparation-plan__track" role="progressbar" aria-label={`Прогресс: ${item.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={item.resource_type === 'article' || item.resource_type === 'quiz' ? `${Math.round(percent)}% — ${item.subtitle}` : `${item.solved} из ${item.total} задач`}><span style={{ width: `${percent}%` }} /></div>
          <span>{item.resource_type === 'article' || item.resource_type === 'quiz' ? item.subtitle : `${item.solved}/${item.total} задач`}</span>
        </div>
      </td>
      <td><span className="preparation-plan__lesson-title">{lesson.title}</span><time dateTime={lesson.lesson_at}>{formatPlanDate(lesson.lesson_at)}</time></td>
      <td>{state.deadline ? <time dateTime={state.deadline} title={formatPlanDate(state.deadline)} className={`preparation-plan__deadline preparation-plan__deadline--${state.overdue ? 'overdue' : state.urgent ? 'urgent' : 'default'}`}>{state.deadlineText}</time> : <span className="preparation-plan__dash">—</span>}</td>
      <td><span className={`preparation-plan__status preparation-plan__status--${tone}`}>{state.status}</span></td>
      <td>{(!state.upcoming || state.inProgress || state.overdue || state.complete) && <Link className={`preparation-plan__action${state.overdue ? ' preparation-plan__action--overdue' : state.complete ? ' preparation-plan__action--complete' : ''}`} to={item.href} aria-label={`${state.complete ? 'Повторить' : state.inProgress || item.solved > 0 ? 'Продолжить' : 'Начать'}: ${item.title}`}>{state.complete ? 'Повторить' : state.inProgress || item.solved > 0 ? 'Продолжить' : 'Начать'}</Link>}</td>
    </tr>
  );
}
