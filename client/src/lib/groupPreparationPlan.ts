import type { GroupLesson, GroupLessonItem } from '../api/types';

export type PlanRow = { lesson: GroupLesson; item: GroupLessonItem };
export const PLAN_SECTION_LABELS = { theory: 'Теория', testing: 'Тестирование', lesson: 'На уроке', homework: 'Домашняя работа' } as const;
const SECTION_ORDER = { theory: 0, testing: 1, lesson: 2, homework: 3 };

export function planItemTypeLabel(item: GroupLessonItem) {
  if (item.section === 'homework') return item.resource_type === 'quiz' ? 'ДЗ · тест' : item.resource_type === 'article' ? 'ДЗ · теория' : 'ДЗ';
  if (item.resource_type === 'quiz') return 'Тестирование';
  if (item.resource_type === 'article') return 'Теория';
  return PLAN_SECTION_LABELS[item.section];
}
export type PlanSection = {
  id: string;
  kind: 'overdue' | 'current' | 'upcoming' | 'previous' | 'completed';
  title: string;
  rows: PlanRow[];
};

export function formatPlanDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(value)).replace(/\s*г\.$/, '');
}

export function getPlanItemState({ lesson, item }: PlanRow, now: number) {
  const complete = item.completion_status === 'completed';
  const deadline = item.section === 'homework' ? lesson.homework_deadline : null;
  const difference = deadline ? new Date(deadline).getTime() - now : null;
  const overdue = difference !== null && difference < 0 && !complete;
  const upcoming = new Date(lesson.lesson_at).getTime() > now;
  const inProgress = item.completion_status === 'in_progress';
  const status = complete ? 'Выполнено' : overdue ? 'Просрочено' : inProgress ? 'В работе' : upcoming ? 'Предстоит' : 'Не начато';
  const days = difference === null ? null : Math.ceil(Math.abs(difference) / 86_400_000);
  const deadlineText = !deadline ? '—' : complete ? formatPlanDate(deadline)
    : overdue ? `Просрочено на ${days} дн.`
      : days === 0 ? 'Сегодня' : `${days} дн. осталось`;
  return { complete, overdue, upcoming, inProgress, status, deadline, deadlineText, urgent: !complete && !overdue && days !== null && days <= 7 };
}

export function buildPlanSections(lessons: GroupLesson[], now: number): PlanSection[] {
  const ordered = [...lessons].sort((a, b) => new Date(a.lesson_at).getTime() - new Date(b.lesson_at).getTime() || a.id - b.id);
  // A student can have both group and individual lessons, each with its own current session.
  const currentByGroup = new Map<string, string>();
  const groupKey = (lesson: GroupLesson) => `${lesson.group_id}:${lesson.student_id ?? 'group'}`;
  for (const lesson of ordered) {
    if (new Date(lesson.lesson_at).getTime() <= now && lesson.items.length > 0) {
      currentByGroup.set(groupKey(lesson), lesson.lesson_at);
    }
  }

  const overdue: PlanSection = { id: 'overdue', kind: 'overdue', title: 'Просроченные', rows: [] };
  const upcoming: PlanSection = { id: 'upcoming', kind: 'upcoming', title: 'Предстоящие занятия', rows: [] };
  const previous: PlanSection = { id: 'previous', kind: 'previous', title: 'Предыдущие занятия', rows: [] };
  const completed: PlanSection = { id: 'completed', kind: 'completed', title: 'История выполненных', rows: [] };
  const current = new Map<string, PlanSection>();
  for (const lesson of ordered) {
    for (const item of [...lesson.items].sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section])) {
      const row = { lesson, item };
      const state = getPlanItemState(row, now);
      if (state.complete) completed.rows.push(row);
      else if (state.overdue) overdue.rows.push(row);
      else if (state.upcoming) upcoming.rows.push(row);
      else if (currentByGroup.get(groupKey(lesson)) === lesson.lesson_at) {
        const id = `current:${groupKey(lesson)}:${lesson.lesson_at}`;
        if (!current.has(id)) {
          current.set(id, { id, kind: 'current', title: `Текущее занятие — ${formatPlanDate(lesson.lesson_at)}`, rows: [] });
        }
        current.get(id)!.rows.push(row);
      } else previous.rows.push(row);
    }
  }
  completed.rows.reverse();
  return [overdue, ...current.values(), upcoming, previous, completed].filter((section) => section.rows.length > 0);
}
