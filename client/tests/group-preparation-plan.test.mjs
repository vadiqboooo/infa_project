import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlanSections, getPlanItemState, planItemTypeLabel } from '../src/lib/groupPreparationPlan.ts';

const now = Date.parse('2026-09-09T12:00:00Z');
const item = (id, section = 'lesson', completion_status = 'not_started') => ({ id, section, completion_status });
const lesson = (id, date, items, extra = {}) => ({ id, group_id: 1, student_id: null, lesson_at: `${date}T10:00:00Z`, items, homework_deadline: null, ...extra });

test('lesson materials are ordered as theory, testing, classroom topics and mixed homework without losing items', () => {
  const sections = buildPlanSections([lesson(1, '2026-09-09', [
    item(6, 'homework'), item(3, 'lesson'), item(2, 'testing'), item(1, 'theory'), item(4, 'lesson'), item(5, 'homework'),
  ])], now);
  assert.deepEqual(sections[0].rows.map(row => row.item.id), [1, 2, 3, 4, 6, 5]);
  assert.equal(planItemTypeLabel({ ...item(1, 'theory'), resource_type: 'article' }), 'Теория');
  assert.equal(planItemTypeLabel({ ...item(2, 'testing'), resource_type: 'quiz' }), 'Тестирование');
  assert.equal(planItemTypeLabel({ ...item(6, 'homework'), resource_type: 'quiz' }), 'ДЗ · тест');
  const homework = lesson(1, '2026-09-09', [], { homework_deadline: '2026-09-08T10:00:00Z' });
  assert.equal(getPlanItemState({ lesson: homework, item: item(2, 'testing') }, now).overdue, false);
  assert.equal(getPlanItemState({ lesson: homework, item: { ...item(6, 'homework'), resource_type: 'quiz' } }, now).overdue, true);
});

test('overdue work is first, current work stays paired, future lessons run chronologically, and no material is lost', () => {
  const lessons = [
    lesson(4, '2026-09-23', [item(7)]),
    lesson(2, '2026-09-09', [item(4, 'homework'), item(3)]),
    lesson(1, '2026-08-26', [item(1), item(2, 'homework'), item(8, 'homework', 'completed')], { homework_deadline: '2026-09-01T10:00:00Z' }),
    lesson(3, '2026-09-16', [item(5), item(6, 'homework')]),
  ];
  const original = structuredClone(lessons);
  const sections = buildPlanSections(lessons, now);
  assert.deepEqual(sections.map((section) => section.kind), ['overdue', 'current', 'upcoming', 'previous', 'completed']);
  assert.deepEqual(sections.map((section) => section.rows.map(({ item }) => item.id)), [[2], [3, 4], [5, 6, 7], [1], [8]]);
  assert.deepEqual(lessons, original);
});

test('each group and individual schedule keeps its own current lesson', () => {
  const sections = buildPlanSections([
    lesson(1, '2026-09-01', [item(1)]),
    lesson(2, '2026-09-08', [item(2)], { student_id: 42 }),
    lesson(3, '2026-09-09', [item(3)], { group_id: 2 }),
  ], now);
  assert.equal(sections.filter((section) => section.kind === 'current').length, 3);
});

test('an all-future plan has no current lesson; completed latest work does not promote old lessons', () => {
  assert.deepEqual(buildPlanSections([lesson(1, '2026-09-16', [item(1)])], now).map((section) => section.kind), ['upcoming']);
  assert.deepEqual(buildPlanSections([
    lesson(1, '2026-09-01', [item(1)]),
    lesson(2, '2026-09-09', [item(2, 'lesson', 'completed')]),
  ], now).map((section) => section.kind), ['previous', 'completed']);
  assert.deepEqual(buildPlanSections([], now), []);
});

test('deadline applies only to homework and completed homework never becomes overdue', () => {
  const past = lesson(1, '2026-09-01', [], { homework_deadline: '2026-09-08T12:00:00Z' });
  assert.equal(getPlanItemState({ lesson: past, item: item(1) }, now).deadline, null);
  assert.equal(getPlanItemState({ lesson: past, item: item(2, 'homework') }, now).deadlineText, 'Просрочено на 1 дн.');
  const complete = getPlanItemState({ lesson: past, item: item(3, 'homework', 'completed') }, now);
  assert.equal(complete.overdue, false);
  assert.equal(complete.status, 'Выполнено');
});

test('deadline boundary, urgency and a started future material have accurate statuses', () => {
  const current = lesson(1, '2026-09-09', [], { homework_deadline: new Date(now).toISOString() });
  assert.equal(getPlanItemState({ lesson: current, item: item(1, 'homework') }, now).deadlineText, 'Сегодня');
  assert.equal(getPlanItemState({ lesson: current, item: item(1, 'homework') }, now + 1).overdue, true);
  const next = { ...current, homework_deadline: '2026-09-15T12:00:00Z' };
  assert.equal(getPlanItemState({ lesson: next, item: item(1, 'homework') }, now).deadlineText, '6 дн. осталось');
  assert.equal(getPlanItemState({ lesson: next, item: item(1, 'homework') }, now).urgent, true);
  assert.equal(getPlanItemState({ lesson: lesson(2, '2026-09-16', []), item: item(1, 'lesson', 'in_progress') }, now).status, 'В работе');
});
