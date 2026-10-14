import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type {
  GroupLessonProgress,
  GroupOut,
  LessonProgressItem,
  LessonTaskResults,
  LessonProgressLesson,
  LessonProgressStudent,
  StudentOut,
} from '../../api/types';
import { planItemTypeLabel } from '../../lib/groupPreparationPlan';
import './AdminHomePanel.css';

export type AdminHomeSection = 'topics' | 'articles' | 'students' | 'subscriptions' | 'metrics' | 'settings';

type Props = {
  groups: GroupOut[];
  students: StudentOut[];
  loading: boolean;
  loadProgress: (groupId: number, studentId?: number) => Promise<GroupLessonProgress>;
  loadResults: (lessonId: number) => Promise<LessonTaskResults>;
};

type Kind = 'group' | 'student';
type Tab = 'today' | 'stats';
type Sub = 'tasks' | 'hw';
type Status = 'done' | 'prog' | 'none';

const DAY = 24 * 60 * 60 * 1000;
const ONLINE_MS = 5 * 60 * 1000;
const LIVE_RESULTS_REFRESH_MS = 3000;
const ADMIN_HOME_GROUP_KEY = 'infa.admin-home.group-id';
const COLORS = ['#21B66F', '#3B82C4', '#8B6FD6', '#D9783F', '#C2547A', '#2E9CA6', '#B58A1C', '#5D7BD6'];
const plural = (n: number, one: string, few: string, many: string) => {
  const m = n % 10;
  const h = n % 100;
  const word = m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 12 || h > 14) ? few : many;
  return `${n} ${word}`;
};

const isIndividualGroup = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return normalized.startsWith('индивидуал') || normalized.startsWith('individual');
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
const longDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const colorOf = (id: number) => COLORS[id % COLORS.length];

function savedGroupId(): number | null {
  try {
    const value = Number(window.localStorage.getItem(ADMIN_HOME_GROUP_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function statusOf(value: string | undefined): Status {
  if (value === 'completed') return 'done';
  if (value === 'in_progress') return 'prog';
  return 'none';
}

function lastSeen(iso: string, now: number) {
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff)) return '—';
  if (diff < ONLINE_MS) return 'Сейчас в сети';
  if (sameDay(new Date(iso), new Date(now))) return `Был в ${timeOf(iso)}`;
  if (diff < 2 * DAY) return `Был вчера в ${timeOf(iso)}`;
  return `Был ${shortDate(iso)}`;
}

function itemStatus(item: LessonProgressItem, studentId: number): Status {
  return statusOf(item.progress.find((row) => row.user_id === studentId)?.completion_status);
}

function overdueDays(lesson: LessonProgressLesson, item: LessonProgressItem, now: number): number {
  if (item.section !== 'homework' || !lesson.homework_deadline) return 0;
  const diff = now - Date.parse(lesson.homework_deadline);
  return diff > 0 ? Math.ceil(diff / DAY) : 0;
}

export function AdminHomePanel({ groups, students, loading, loadProgress, loadResults }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [kind, setKind] = useState<Kind>('group');
  const [groupId, setGroupId] = useState<number | null>(savedGroupId);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [sub, setSub] = useState<Sub>('tasks');
  const [pickOpen, setPickOpen] = useState(false);
  const [data, setData] = useState<GroupLessonProgress[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const cache = useRef(new Map<string, GroupLessonProgress>());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeGroup = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
  const activeGroupId = activeGroup?.id ?? null;
  const sortedStudents = useMemo(
    () => students.filter((s) => s.role !== 'admin' || s.group_ids.length > 0).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [students],
  );
  const activeStudent = kind === 'student' ? sortedStudents.find((s) => s.id === studentId) ?? sortedStudents[0] ?? null : null;
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  useEffect(() => {
    if (activeGroupId === null) return;
    try {
      window.localStorage.setItem(ADMIN_HOME_GROUP_KEY, String(activeGroupId));
    } catch {
      // The selection still works for this session when storage is unavailable.
    }
  }, [activeGroupId]);

  // which backend requests the current selection needs
  const requests = useMemo(() => {
    if (kind === 'group') {
      return activeGroup && !isIndividualGroup(activeGroup.name) ? [{ groupId: activeGroup.id, studentId: undefined as number | undefined }] : [];
    }
    if (!activeStudent) return [];
    return activeStudent.group_ids
      .map((id) => groupById.get(id))
      .filter((g): g is GroupOut => !!g)
      .map((g) => ({ groupId: g.id, studentId: isIndividualGroup(g.name) ? activeStudent.id : undefined }));
  }, [kind, activeGroup, activeStudent, groupById]);

  useEffect(() => {
    let cancelled = false;
    if (requests.length === 0) {
      setData([]);
      setError('');
      return;
    }
    setFetching(true);
    setError('');
    Promise.all(
      requests.map((req) => {
        const key = `${req.groupId}:${req.studentId ?? ''}:${version}`;
        const hit = cache.current.get(key);
        if (hit) return Promise.resolve(hit);
        return loadProgress(req.groupId, req.studentId).then((result) => {
          cache.current.set(key, result);
          return result;
        });
      }),
    )
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить прогресс'); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [requests, loadProgress, version]);

  // lessons & roster for the current selection
  const view = useMemo(() => {
    const roster: LessonProgressStudent[] = [];
    const seen = new Set<number>();
    const lessons: LessonProgressLesson[] = [];
    for (const block of data) {
      for (const person of block.students) {
        if (seen.has(person.id)) continue;
        if (kind === 'student' && activeStudent && person.id !== activeStudent.id) continue;
        seen.add(person.id);
        roster.push(person);
      }
      lessons.push(...block.lessons);
    }
    lessons.sort((a, b) => Date.parse(a.lesson_at) - Date.parse(b.lesson_at));
    return { roster, lessons };
  }, [data, kind, activeStudent]);

  const currentLesson = useMemo(() => {
    const { lessons } = view;
    if (lessons.length === 0) return null;
    const picked = lessons.find((l) => l.id === lessonId);
    if (picked) return picked;
    const today = lessons.find((l) => sameDay(new Date(l.lesson_at), new Date(now)));
    if (today) return today;
    const past = lessons.filter((l) => Date.parse(l.lesson_at) <= now);
    return past[past.length - 1] ?? lessons[0];
  }, [view, lessonId, now]);

  const isToday = !!currentLesson && sameDay(new Date(currentLesson.lesson_at), new Date(now));

  const [results, setResults] = useState<LessonTaskResults | null>(null);
  const [stepId, setStepId] = useState<number | null>(null);
  const resultsLessonId = tab === 'stats' && sub === 'tasks' ? currentLesson?.id ?? null : null;

  useEffect(() => {
    if (resultsLessonId === null) {
      setResults(null);
      return;
    }
    let cancelled = false;
    let requestInFlight = false;

    setResults((current) => current?.lesson_id === resultsLessonId ? current : null);

    const refreshResults = async () => {
      if (cancelled || requestInFlight || document.visibilityState === 'hidden') return;
      requestInFlight = true;
      try {
        const next = await loadResults(resultsLessonId);
        if (!cancelled) setResults(next);
      } catch {
        if (!cancelled) {
          setResults((current) => current?.lesson_id === resultsLessonId
            ? current
            : { lesson_id: resultsLessonId, steps: [] });
        }
      } finally {
        requestInFlight = false;
      }
    };

    void refreshResults();
    const timer = window.setInterval(() => void refreshResults(), LIVE_RESULTS_REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshResults();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [resultsLessonId, loadResults, version]);
  const roster = view.roster;
  const online = roster.filter((p) => now - Date.parse(p.last_active_at) < ONLINE_MS);
  const individualGroupPicked = kind === 'group' && !!activeGroup && isIndividualGroup(activeGroup.name);

  const countItem = (item: LessonProgressItem) => {
    let done = 0;
    let prog = 0;
    for (const person of roster) {
      const s = itemStatus(item, person.id);
      if (s === 'done') done += 1;
      else if (s === 'prog') prog += 1;
    }
    return { done, prog, total: roster.length };
  };

  const groupStatus = (item: LessonProgressItem): Status => {
    const c = countItem(item);
    return c.total > 0 && c.done === c.total ? 'done' : c.done + c.prog > 0 ? 'prog' : 'none';
  };

  const homeworkRows = useMemo(() => {
    const rows: { lesson: LessonProgressLesson; item: LessonProgressItem }[] = [];
    for (const lesson of view.lessons) {
      for (const item of lesson.items) if (item.section === 'homework') rows.push({ lesson, item });
    }
    return rows.reverse();
  }, [view.lessons]);

  const debtsOf = (personId: number) =>
    homeworkRows.filter(({ lesson, item }) => itemStatus(item, personId) !== 'done' && Date.parse(lesson.lesson_at) <= now);

  const pickGroup = (id: number) => { setKind('group'); setGroupId(id); setLessonId(null); setPickOpen(false); };
  const pickStudent = (id: number) => { setKind('student'); setStudentId(id); setLessonId(null); setPickOpen(false); };
  const switchKind = (next: Kind) => {
    setKind(next);
    setLessonId(null);
    setPickOpen(false);
    if (next === 'student') setStudentId((prev) => prev ?? sortedStudents[0]?.id ?? null);
    else setGroupId((prev) => prev ?? groups[0]?.id ?? null);
  };

  if (loading) {
    return (
      <div className="ah" aria-busy="true">
        <div className="ah-skeleton ah-skeleton-title" />
        <div className="ah-skeleton ah-skeleton-overview" />
      </div>
    );
  }

  const dateLabel = new Date(now).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const groupNamesOf = (s: StudentOut) => s.group_ids.map((id) => groupById.get(id)?.name).filter((n): n is string => !!n);

  const current = kind === 'group'
    ? activeGroup && {
        name: activeGroup.name,
        letter: activeGroup.name.charAt(0).toUpperCase(),
        color: activeGroup.color,
        sub: plural(activeGroup.student_count, 'ученик', 'ученика', 'учеников'),
        tags: [plural(activeGroup.student_count, 'ученик', 'ученика', 'учеников')],
      }
    : activeStudent && {
        name: activeStudent.name,
        letter: activeStudent.name.charAt(0).toUpperCase(),
        color: colorOf(activeStudent.id),
        sub: groupNamesOf(activeStudent).join(', ') || 'Без группы',
        tags: groupNamesOf(activeStudent),
      };

  const entities = kind === 'group'
    ? groups.map((g) => ({ id: g.id, name: g.name, letter: g.name.charAt(0).toUpperCase(), color: g.color, sub: plural(g.student_count, 'ученик', 'ученика', 'учеников'), selected: g.id === activeGroupId, pick: () => pickGroup(g.id) }))
    : sortedStudents.map((s) => ({ id: s.id, name: s.name, letter: s.name.charAt(0).toUpperCase(), color: colorOf(s.id), sub: groupNamesOf(s).join(', ') || 'Без группы', selected: s.id === activeStudent?.id, pick: () => pickStudent(s.id) }));

  const lessonItems = currentLesson?.items ?? [];
  const lessonItemsNoHw = lessonItems.filter((item) => item.section !== 'homework');
  const studentDebts = kind === 'student' && activeStudent ? debtsOf(activeStudent.id) : [];
  const debtorCount = roster.filter((p) => debtsOf(p.id).length > 0).length;
  const hwBadge = kind === 'student' ? studentDebts.length : debtorCount;

  const tiles: { label: string; value: string; tone: string }[] = kind === 'group'
    ? (() => {
        const base = lessonItemsNoHw.length ? lessonItemsNoHw : lessonItems;
        const finished = roster.filter((p) => base.length > 0 && base.every((item) => itemStatus(item, p.id) === 'done')).length;
        const past = homeworkRows.filter(({ lesson }) => Date.parse(lesson.lesson_at) <= now);
        const hwPct = past.length && roster.length
          ? Math.round((past.reduce((sum, { item }) => sum + countItem(item).done, 0) / (past.length * roster.length)) * 100)
          : 0;
        return [
          { label: 'Прошли урок', value: `${finished} из ${roster.length}`, tone: '' },
          { label: 'Домашки сданы', value: `${hwPct}%`, tone: '' },
          { label: 'Должников', value: String(debtorCount), tone: debtorCount ? 'bad' : '' },
          { label: 'Онлайн сейчас', value: String(online.length), tone: 'em' },
        ];
      })()
    : activeStudent
      ? (() => {
          const overdue = studentDebts.filter(({ lesson, item }) => overdueDays(lesson, item, now) > 0).length;
          const stepsDone = lessonItems.filter((item) => itemStatus(item, activeStudent.id) === 'done').length;
          return [
            { label: 'Домашек не сделано', value: String(studentDebts.length), tone: studentDebts.length ? 'bad' : 'em' },
            { label: 'Просрочено', value: String(overdue), tone: overdue ? 'bad' : '' },
            { label: 'Шагов урока сделано', value: `${stepsDone} из ${lessonItems.length}`, tone: '' },
            { label: 'Последний вход', value: lastSeen(activeStudent.last_active_at, now).replace('Был ', ''), tone: '' },
          ];
        })()
      : [];

  const resultSteps = results?.steps ?? [];
  const activeStep = resultSteps.find((st) => st.item_id === stepId) ?? resultSteps[0] ?? null;
  const cellGood = (cells: { state: string }[]) => cells.filter((c) => c.state === 'ok').length;
  const cellAnswered = (cells: { state: string }[]) => cells.filter((c) => c.state !== 'none').length;
  const scoreTone = (good: number, total: number) => (good / total >= 0.7 ? 'hi' : good / total >= 0.4 ? 'mid' : 'lo');

  const hasPlan = !!currentLesson;

  const rosterAside = kind === 'group'
    ? {
        title: isToday ? 'Сейчас на уроке' : 'Участники',
        count: roster.length ? `онлайн ${online.length} из ${roster.length}` : '',
        rows: roster.map((p) => ({
          key: p.id,
          name: p.name,
          letter: p.name.charAt(0).toUpperCase(),
          color: colorOf(p.id),
          online: now - Date.parse(p.last_active_at) < ONLINE_MS,
          text: lastSeen(p.last_active_at, now),
          pick: () => pickStudent(p.id),
        })),
      }
    : null;

  return (
    <div className="ah">
      <header className="ah-greeting">
        <div>
          <h1>Главная</h1>
          <p>Сегодня, {dateLabel}</p>
        </div>
      </header>

      <section className="ah-card ah-context" aria-label="Выбор группы или ученика">
        <div className="ah-context-row">
          <div className="ah-seg" role="group" aria-label="Режим">
            {([['group', 'Группы'], ['student', 'Ученики']] as const).map(([key, label]) => (
              <button key={key} type="button" data-on={kind === key} onClick={() => switchKind(key)}>{label}</button>
            ))}
          </div>

          <div className="ah-picker">
            <button type="button" className="ah-picker-btn" aria-haspopup="listbox" aria-expanded={pickOpen} onClick={() => setPickOpen((v) => !v)} disabled={!current}>
              {current ? (
                <>
                  <span className="ah-avatar" style={{ background: current.color }}>{current.letter}</span>
                  <span className="ah-picker-text"><b>{current.name}</b><span>{current.sub}</span></span>
                </>
              ) : (
                <span className="ah-picker-text"><b>{kind === 'group' ? 'Групп пока нет' : 'Учеников пока нет'}</b></span>
              )}
              <ChevronDown size={18} aria-hidden />
            </button>
            {pickOpen && (
              <>
                <button type="button" className="ah-picker-backdrop" aria-label="Закрыть список" onClick={() => setPickOpen(false)} />
                <div className="ah-picker-list" role="listbox" aria-label={kind === 'group' ? 'Группа' : 'Ученик'}>
                  {entities.map((e) => (
                    <button key={e.id} type="button" role="option" aria-selected={e.selected} data-on={e.selected} onClick={e.pick}>
                      <span className="ah-avatar ah-avatar-sm" style={{ background: e.color }}>{e.letter}</span>
                      <span className="ah-picker-text"><b>{e.name}</b><span>{e.sub}</span></span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="ah-tags">
            {current?.tags.map((t) => <span key={t} className="ah-tag">{t}</span>)}
            {kind === 'group' && currentLesson && isToday && <span className="ah-tag" data-tone="sky">Урок сегодня в {timeOf(currentLesson.lesson_at)}</span>}
            {kind === 'group' && hasPlan && !isToday && <span className="ah-tag">Сегодня урока нет</span>}
          </div>
        </div>

        <div className="ah-tabs" role="tablist" aria-label="Раздел">
          {([['today', 'Сегодня на уроке'], ['stats', 'Статистика']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
      </section>

      {error && <div className="ah-note" data-tone="bad">{error}</div>}
      {fetching && !error && <div className="ah-skeleton ah-skeleton-overview" aria-busy="true" />}

      {!fetching && !error && individualGroupPicked && (
        <div className="ah-note">Группа индивидуальная: у каждого ученика своя программа. Переключитесь на «Ученики» и выберите нужного.</div>
      )}

      {!fetching && !error && !individualGroupPicked && !hasPlan && current && (
        <div className="ah-note">
          {kind === 'group'
            ? 'У группы пока нет опубликованных уроков. Составьте план во вкладке «Группы».'
            : 'У ученика нет опубликованных уроков. Проверьте, что он состоит в группе с планом.'}
        </div>
      )}

      {!fetching && !error && hasPlan && currentLesson && tab === 'today' && (
        <div className="ah-grid2">
          <div className="ah-col">
            <div className="ah-chips">
              {view.lessons.map((lesson) => {
                const today = sameDay(new Date(lesson.lesson_at), new Date(now));
                return (
                  <button key={lesson.id} type="button" aria-pressed={lesson.id === currentLesson.id} data-on={lesson.id === currentLesson.id} onClick={() => setLessonId(lesson.id)}>
                    <span className="ah-chip-date">{shortDate(lesson.lesson_at)}{today && <em>сегодня</em>}</span>
                    <span className="ah-chip-topic">{lesson.title}</span>
                    <span className="ah-dots">
                      {lesson.items.map((item) => (
                        <i key={item.id} data-s={kind === 'student' && activeStudent ? itemStatus(item, activeStudent.id) : groupStatus(item)} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            <article className="ah-card ah-lesson">
              <div className="ah-lesson-head">
                <div>
                  <span className="ah-eyebrow" data-today={isToday}>{isToday ? 'Текущий урок · ' : 'Урок · '}{longDate(currentLesson.lesson_at)}</span>
                  <h2>{currentLesson.title}</h2>
                </div>
                <span className="ah-muted">
                  {kind === 'student' && activeStudent
                    ? `${lessonItems.filter((i) => itemStatus(i, activeStudent.id) === 'done').length} из ${lessonItems.length} шагов сделано`
                    : isToday ? `Идёт урок · с ${timeOf(currentLesson.lesson_at)}` : 'Урок прошёл'}
                </span>
              </div>

              <div className="ah-steps">
                {lessonItems.length === 0 && <div className="ah-muted">В уроке пока нет материалов.</div>}
                {lessonItems.map((item, index) => {
                  const over = overdueDays(currentLesson, item, now);
                  if (kind === 'student' && activeStudent) {
                    const s = itemStatus(item, activeStudent.id);
                    const mine = item.progress.find((row) => row.user_id === activeStudent.id);
                    const late = over > 0 && s !== 'done';
                    const total = mine?.total ?? item.total;
                    const solved = mine?.solved ?? 0;
                    return (
                      <div key={item.id} className="ah-step" data-bad={late}>
                        <span className="ah-step-n" data-s={s}>{index + 1}</span>
                        <div className="ah-step-main"><span className="ah-eyebrow">{planItemTypeLabel(item)}</span><b>{item.title}</b><span className="ah-muted">{item.subtitle}</span></div>
                        <div className="ah-step-prog">
                          <div className="ah-bar"><span data-bad={late} style={{ width: `${total ? (solved / total) * 100 : s === 'done' ? 100 : 0}%` }} /></div>
                          <span className="ah-cap" data-bad={late}>{s === 'none' ? 'Не начато' : `Решено ${solved} из ${total}`}{late ? ` · просрочено на ${over} дн.` : ''}</span>
                        </div>
                        <div className="ah-step-act"><Link to={item.href} className="ah-btn">Открыть</Link></div>
                      </div>
                    );
                  }
                  const c = countItem(item);
                  const late = over > 0 && c.done < c.total;
                  return (
                    <div key={item.id} className="ah-step" data-bad={late}>
                      <span className="ah-step-n" data-s={groupStatus(item)}>{index + 1}</span>
                      <div className="ah-step-main"><span className="ah-eyebrow">{planItemTypeLabel(item)}</span><b>{item.title}</b><span className="ah-muted">{item.subtitle}</span></div>
                      <div className="ah-step-prog">
                        <div className="ah-bar">
                          <span style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                          <span data-amber="true" style={{ width: `${c.total ? (c.prog / c.total) * 100 : 0}%` }} />
                        </div>
                        <span className="ah-cap" data-bad={late}>Сделали {c.done} из {c.total}{c.prog ? ` · в процессе ${c.prog}` : ''}{late ? ` · просрочено на ${over} дн.` : ''}</span>
                      </div>
                      <div className="ah-step-act">
                        <Link to={item.href} className="ah-btn">Открыть</Link>
                        <button type="button" className="ah-btn ah-btn-ghost" onClick={() => { setTab('stats'); setSub(item.section === 'homework' ? 'hw' : 'tasks'); }}>Результаты</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <aside className="ah-card ah-aside" aria-label={rosterAside?.title ?? 'Несданные домашки'}>
            {rosterAside ? (
              <>
                <div className="ah-aside-head"><b>{rosterAside.title}</b><span className="ah-muted">{rosterAside.count}</span></div>
                <div className="ah-people">
                  {rosterAside.rows.map((p) => (
                    <button key={p.key} type="button" onClick={p.pick}>
                      <span className="ah-avatar ah-avatar-sm ah-avatar-round" style={{ background: p.color }}>{p.letter}<i data-online={p.online} /></span>
                      <span className="ah-picker-text"><b>{p.name}</b><span>{p.text}</span></span>
                    </button>
                  ))}
                  {rosterAside.rows.length === 0 && <span className="ah-muted">В группе нет учеников</span>}
                </div>
              </>
            ) : (
              <>
                <div className="ah-aside-head"><b>Несданные домашки</b><span className="ah-muted">{studentDebts.length}</span></div>
                <div className="ah-people">
                  {studentDebts.length === 0 && <span className="ah-muted">Долгов нет</span>}
                  {studentDebts.map(({ lesson, item }) => {
                    const over = overdueDays(lesson, item, now);
                    return (
                      <Link key={`${lesson.id}-${item.id}`} to={item.href} className="ah-debt">
                        <b>{item.title}</b>
                        <span>{`Урок ${shortDate(lesson.lesson_at)}`}{over > 0 ? ` · просрочено на ${over} дн.` : ''}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {!fetching && !error && hasPlan && currentLesson && tab === 'stats' && (
        <div className="ah-col">
          <div className="ah-subrow">
            <div className="ah-seg" role="tablist">
              {([['tasks', 'Задания урока'], ['hw', 'Домашние работы']] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={sub === key} data-on={sub === key} onClick={() => setSub(key)}>
                  {label}
                  {key === 'hw' && hwBadge > 0 && <span className="ah-badge">{hwBadge}</span>}
                </button>
              ))}
            </div>
            <div className="ah-tiles">
              {tiles.map((t) => (
                <div key={t.label} className="ah-tile" data-tone={t.tone}><span>{t.label}</span><b>{t.value}</b></div>
              ))}
            </div>
          </div>

          {sub === 'tasks' && (
            <section className="ah-card">
              <div className="ah-lesson-head">
                <div>
                  <h2>{kind === 'group' ? 'Как группа выполняет задания' : 'Как выполнял задания на текущем уроке'}</h2>
                  <span className="ah-muted">
                    {shortDate(currentLesson.lesson_at)}{kind === 'group' && activeStep ? ` · ${activeStep.title} · ${plural(activeStep.tasks.length, 'задача', 'задачи', 'задач')}` : ` · ${currentLesson.title}`}
                  </span>
                </div>
                {kind === 'group' && resultSteps.length > 1 && (
                  <div className="ah-strip">
                    {resultSteps.map((st) => (
                      <button key={st.item_id} type="button" data-on={st.item_id === activeStep?.item_id} onClick={() => setStepId(st.item_id)}>{st.title}</button>
                    ))}
                  </div>
                )}
              </div>

              {results === null && <div className="ah-skeleton ah-skeleton-overview" aria-busy="true" />}
              {results !== null && !activeStep && <div className="ah-muted">В этом уроке нет заданий с ответами.</div>}

              {results !== null && activeStep && kind === 'group' && (
                <div className="ah-scroll">
                  <table className="ah-matrix">
                    <thead>
                      <tr>
                        <th scope="col">Ученик <small>· верный ответ под номером</small></th>
                        {activeStep.tasks.map((t) => (
                          <th scope="col" key={t.task_id}><span>{t.number}</span><small className="ah-ans" title="Правильный ответ">{t.correct || '—'}</small></th>
                        ))}
                        <th scope="col" className="ah-right">Итог</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((person) => {
                        const row = activeStep.rows.find((r) => r.user_id === person.id);
                        const cells = row?.cells ?? [];
                        const good = cellGood(cells);
                        return (
                          <tr key={person.id}>
                            <th scope="row">
                              <button type="button" onClick={() => pickStudent(person.id)}>
                                <i data-online={now - Date.parse(person.last_active_at) < ONLINE_MS} />{person.name}
                              </button>
                            </th>
                            {activeStep.tasks.map((t, index) => {
                              const cell = cells[index] ?? { state: 'none', answer: '' };
                              return (
                                <td key={t.task_id}>
                                  <span className="ah-cell" data-s={cell.state} title={cell.state === 'none' ? `Задача ${t.number}: не решал` : `Задача ${t.number}: ${cell.state === 'ok' ? 'верно' : `ответил ${cell.answer}, верно ${t.correct}`}`}>{cell.answer}</span>
                                </td>
                              );
                            })}
                            <td className="ah-right ah-score" data-pct={cellAnswered(cells) ? scoreTone(good, activeStep.tasks.length) : ''}>{cellAnswered(cells) ? `${good} из ${activeStep.tasks.length}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Верно у группы</th>
                        {activeStep.tasks.map((t, index) => {
                          const ok = activeStep.rows.filter((r) => r.cells[index]?.state === 'ok').length;
                          const pct = activeStep.rows.length ? Math.round((ok / activeStep.rows.length) * 100) : 0;
                          return <td key={t.task_id} data-pct={pct >= 70 ? 'hi' : pct >= 40 ? 'mid' : 'lo'}>{pct}%</td>;
                        })}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {results !== null && kind === 'student' && activeStudent && (
                <div className="ah-steps">
                  {resultSteps.map((st) => {
                    const cells = st.rows.find((r) => r.user_id === activeStudent.id)?.cells ?? [];
                    const answered = cellAnswered(cells);
                    const state: Status = answered === 0 ? 'none' : answered === st.tasks.length ? 'done' : 'prog';
                    return (
                      <div key={st.item_id} className="ah-step ah-step-student">
                        <div className="ah-step-student-head">
                          <div className="ah-step-main"><span className="ah-eyebrow">{planItemTypeLabel(st)}</span><b>{st.title}</b></div>
                          <span className="ah-pill" data-s={state}>{state === 'done' ? 'Сделано' : state === 'prog' ? `В процессе · ${answered} из ${st.tasks.length}` : 'Не начато'}</span>
                        </div>
                        <div className="ah-tcells">
                          {st.tasks.map((t, index) => {
                            const cell = cells[index] ?? { state: 'none', answer: '' };
                            return (
                              <span key={t.task_id} className="ah-tcell" data-s={cell.state}>
                                <small>{t.number}</small>
                                {cell.answer || '—'}
                                {cell.state === 'bad' && <small className="ah-ans">верно: {t.correct}</small>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {sub === 'hw' && (
            <section className="ah-card">
              <div className="ah-lesson-head">
                <div>
                  <h2>Домашние работы</h2>
                  <span className="ah-muted">{kind === 'group' ? 'Кто сдал, кто нет и на сколько просрочено' : 'Что не сделано и что просрочено'}</span>
                </div>
              </div>
              <div className="ah-steps">
                {homeworkRows.length === 0 && <div className="ah-muted">В планах пока нет домашних заданий.</div>}
                {homeworkRows.map(({ lesson, item }) => {
                  const over = overdueDays(lesson, item, now);
                  const fresh = over === 0;
                  if (kind === 'student' && activeStudent) {
                    const s = itemStatus(item, activeStudent.id);
                    const mine = item.progress.find((p) => p.user_id === activeStudent.id);
                    return (
                      <div key={`${lesson.id}-${item.id}`} className="ah-step ah-step-hw" data-bad={s !== 'done' && !fresh}>
                        <div className="ah-step-main"><b>{item.title}</b><span className="ah-muted">Урок {shortDate(lesson.lesson_at)}</span></div>
                        <div className="ah-step-prog">
                          <div className="ah-bar"><span style={{ width: `${mine && mine.total ? (mine.solved / mine.total) * 100 : s === 'done' ? 100 : 0}%` }} /></div>
                          <span className="ah-cap">Решено {mine?.solved ?? 0} из {mine?.total ?? item.total}</span>
                        </div>
                        <span className="ah-pill" data-s={s === 'done' ? 'done' : fresh ? 'sky' : 'bad'}>{s === 'done' ? 'сдана' : fresh ? 'в срок' : `просрочено на ${over} дн.`}</span>
                      </div>
                    );
                  }
                  const c = countItem(item);
                  const missing = roster.filter((p) => itemStatus(item, p.id) !== 'done');
                  return (
                    <div key={`${lesson.id}-${item.id}`} className="ah-step ah-step-hw ah-step-hw-group" data-bad={!fresh && missing.length > 3}>
                      <div className="ah-step-main"><b>{item.title}</b><span className="ah-muted">Урок {shortDate(lesson.lesson_at)}</span></div>
                      <span className="ah-pill" data-s={fresh ? 'sky' : 'bad'}>{fresh ? 'в срок' : `просрочено на ${over} дн.`}</span>
                      <div className="ah-step-prog">
                        <div className="ah-bar"><span style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></div>
                        <span className="ah-cap">Сдали {c.done} из {c.total}</span>
                      </div>
                      <div className="ah-who">
                        {missing.slice(0, 4).map((p) => <button key={p.id} type="button" onClick={() => pickStudent(p.id)}>{p.name}</button>)}
                        {missing.length > 4 && <span className="ah-more">+{missing.length - 4}</span>}
                        {missing.length === 0 && <span className="ah-ok">Все сдали</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {!fetching && !error && hasPlan && (
        <button type="button" className="ah-refresh" onClick={() => { cache.current.clear(); setVersion((v) => v + 1); }}>Обновить данные</button>
      )}
    </div>
  );
}
