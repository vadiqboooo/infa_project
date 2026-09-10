import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, BookOpen, CalendarDays, CheckCircle2, FileDown, Home, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { GroupLesson, GroupLessonIn, GroupLessonItemIn, GroupPlanResources, GroupOut, StudentOut } from '../../api/types';
import { handleSessionExpired } from '../../api/client';
import { GroupLessonProgress } from './GroupLessonProgress';
import { TopicPreviewButton } from './TopicPreviewButton';

type Props = { group: GroupOut; students: StudentOut[]; apiKey: string; onClose: () => void };
type TopicFilter = 'tutorial' | 'homework' | 'variants' | 'control';

const TOPIC_FILTERS: { value: TopicFilter; label: string }[] = [
  { value: 'tutorial', label: 'Разбор' },
  { value: 'homework', label: 'ДЗ' },
  { value: 'variants', label: 'Вариант' },
  { value: 'control', label: 'КР' },
];

const emptyForm = (): GroupLessonIn => {
  const lesson = new Date();
  lesson.setMinutes(0, 0, 0);
  const deadline = new Date(lesson);
  deadline.setDate(deadline.getDate() + 7);
  return {
    title: 'Новое занятие',
    lesson_at: toLocalValue(lesson),
    homework_deadline: toLocalValue(deadline),
    note: '',
    status: 'draft',
    items: [],
  };
};

export function GroupPlanEditor({ group, students, apiKey, onClose }: Props) {
  const isIndividualGroup = isIndividualGroupName(group.name);
  const groupStudents = useMemo(
    () => students.filter((student) => (student.group_ids ?? []).includes(group.id)),
    [group.id, students],
  );
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => groupStudents[0]?.id ?? null);
  const programStudentId = isIndividualGroup ? (selectedStudentId ?? groupStudents[0]?.id ?? null) : null;
  const selectedStudent = groupStudents.find((student) => student.id === programStudentId) ?? null;
  const studentQuery = programStudentId == null ? '' : `?student_id=${programStudentId}`;
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [resources, setResources] = useState<GroupPlanResources>({ topics: [] });
  const [form, setForm] = useState<GroupLessonIn>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [lessonResource, setLessonResource] = useState('');
  const [homeworkResource, setHomeworkResource] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = localStorage.getItem('jwt_token');
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string> || {}),
      },
    });
    if (response.status === 401) handleSessionExpired();
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Ошибка запроса');
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }, [apiKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isIndividualGroup && programStudentId == null) {
        setLessons([]);
        setResources(await request<GroupPlanResources>('/admin/group-plan/resources'));
        return;
      }
      const [lessonData, resourceData] = await Promise.all([
        request<GroupLesson[]>(`/admin/groups/${group.id}/lessons${studentQuery}`),
        request<GroupPlanResources>('/admin/group-plan/resources'),
      ]);
      setLessons(lessonData);
      setResources(resourceData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить план');
    } finally {
      setLoading(false);
    }
  }, [group.id, isIndividualGroup, programStudentId, request, studentQuery]);

  useEffect(() => { load(); }, [load]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    resources.topics.forEach((topic) => {
      map.set(`topic:${topic.id}`, topic.title);
      topic.tasks.forEach((task) => map.set(`task:${task.id}`, `${topic.title} · ${task.title}`));
    });
    return map;
  }, [resources]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setLessonResource('');
    setHomeworkResource('');
    setError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditingId(null);
    setForm(emptyForm());
    setLessonResource('');
    setHomeworkResource('');
    setError('');
    setEditorOpen(false);
  };

  const startEdit = (lesson: GroupLesson) => {
    setEditingId(lesson.id);
    setLessonResource('');
    setHomeworkResource('');
    setForm({
      title: lesson.title,
      lesson_at: toLocalValue(new Date(lesson.lesson_at)),
      homework_deadline: lesson.homework_deadline ? toLocalValue(new Date(lesson.homework_deadline)) : null,
      note: lesson.note || '',
      status: lesson.status,
      items: lesson.items.map((item, index) => ({ section: item.section, topic_id: item.resource_type === 'topic' ? item.topic_id : null, task_id: item.resource_type === 'task' ? item.task_id : null, order_index: index })),
    });
    setError('');
    setEditorOpen(true);
  };

  const addResource = (section: 'lesson' | 'homework', value: string) => {
    if (!value) return;
    const item: GroupLessonItemIn = { section, topic_id: Number(value), task_id: null };
    const duplicate = form.items.some((current) => current.section === section && current.topic_id === item.topic_id && current.task_id === item.task_id);
    if (!duplicate) setForm((current) => ({ ...current, items: [...current.items, item] }));
    if (section === 'lesson') setLessonResource('');
    else setHomeworkResource('');
  };

  const removeResource = (index: number) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));

  const save = async () => {
    if (!form.title.trim() || !form.lesson_at) {
      setError('Укажите название и дату занятия');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        lesson_at: new Date(form.lesson_at).toISOString(),
        homework_deadline: form.homework_deadline ? new Date(form.homework_deadline).toISOString() : null,
        note: form.note?.trim() || null,
        items: form.items.map((item, index) => ({ ...item, order_index: index })),
      };
      await request(editingId ? `/admin/group-lessons/${editingId}` : `/admin/groups/${group.id}/lessons${studentQuery}`, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      closeEditor();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить занятие');
    } finally {
      setSaving(false);
    }
  };

  const removeLesson = async (lesson: GroupLesson) => {
    if (!confirm(`Удалить занятие «${lesson.title}»?`)) return;
    await request(`/admin/group-lessons/${lesson.id}`, { method: 'DELETE' });
    if (editingId === lesson.id) closeEditor();
    await load();
  };

  return (
      <div className="admin-group-plan flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#191919] text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
        <header className="flex items-center justify-between border-b border-white/[0.07] bg-[#202020] px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={editorOpen ? closeEditor : onClose} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              <ArrowLeft size={17} />
              {editorOpen ? 'К плану' : 'К группам'}
            </button>
            <div>
              <div className="flex items-center gap-2"><CalendarDays className="text-emerald-400" size={19} /><h2 className="text-lg font-bold text-white">{editorOpen ? (editingId ? 'Редактирование урока' : 'Новый урок') : 'План уроков'}</h2></div>
              <p className="mt-1 text-sm text-slate-500">
                Группа «{group.name}»{selectedStudent ? ` · ${selectedStudent.name}` : ''}
              </p>
            </div>
          </div>
          {!editorOpen && (
            <div className="flex items-center gap-3">
              {isIndividualGroup && (
                <label className="block">
                  <span className="sr-only">Ученик</span>
                  <select
                    value={programStudentId ?? ''}
                    onChange={(event) => setSelectedStudentId(event.target.value ? Number(event.target.value) : null)}
                    className="admin-plan-input h-11 min-w-[240px]"
                  >
                    {groupStudents.length === 0 && <option value="">В группе нет учеников</option>}
                    {groupStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                  </select>
                </label>
              )}
              <button disabled={isIndividualGroup && programStudentId == null} onClick={startNew} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
                <Plus size={16} />
                Добавить урок
              </button>
            </div>
          )}
        </header>

        {editorOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#191919] p-6">
            <div className="mx-auto max-w-4xl rounded-xl border border-white/[0.08] bg-[#202020] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{editingId ? 'Изменить урок' : 'Добавить новый урок'}</h3>
                  <p className="mt-1 text-sm text-slate-500">Настройте дату, материалы урока и домашнюю работу.</p>
                </div>
                {editingId && <button onClick={startNew} className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">Создать новый</button>}
              </div>
              <div className="space-y-5">
                <Field label="Название урока"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="admin-plan-input" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Дата урока"><input type="datetime-local" value={form.lesson_at} onChange={(e) => setForm({ ...form, lesson_at: e.target.value })} className="admin-plan-input" /></Field>
                  <Field label="Дедлайн домашней работы"><input type="datetime-local" value={form.homework_deadline || ''} onChange={(e) => setForm({ ...form, homework_deadline: e.target.value || null })} className="admin-plan-input" /></Field>
                </div>
                <Field label="Статус"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as GroupLessonIn['status'] })} className="admin-plan-input"><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="completed">Урок проведён</option></select></Field>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResourceSection title="Топики на уроке" icon={<BookOpen size={16} />} section="lesson" value={lessonResource} onChange={setLessonResource} onAdd={() => addResource('lesson', lessonResource)} resources={resources} items={form.items} labels={labels} onRemove={removeResource} />
                  <ResourceSection title="Топики на дом" icon={<Home size={16} />} section="homework" value={homeworkResource} onChange={setHomeworkResource} onAdd={() => addResource('homework', homeworkResource)} resources={resources} items={form.items} labels={labels} onRemove={removeResource} />
                </div>
                <Field label="Комментарий"><textarea rows={3} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} className="admin-plan-input resize-none" placeholder="Что важно повторить или принести на урок" /></Field>
                {error && <p className="rounded-lg border border-red-400/15 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-300">{error}</p>}
                <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-5">
                  <button onClick={closeEditor} className="h-11 rounded-lg border border-white/[0.08] px-5 text-sm font-semibold text-slate-400 hover:bg-white/[0.05] hover:text-white">Отмена</button>
                  <button onClick={save} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50"><CheckCircle2 size={17} />{saving ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить урок'}</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          isIndividualGroup && programStudentId == null
            ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><CalendarDays size={38} className="text-slate-700" /><p className="mt-3 text-base font-bold text-slate-300">В группе нет учеников</p><p className="mt-1 text-sm text-slate-500">Сначала добавьте ученика в группу «Индивидуалы».</p></div>
            : <LessonPlanTable key={`${group.id}:${programStudentId ?? 'group'}`} groupId={group.id} apiKey={apiKey} lessons={lessons} loading={loading} error={error} onAdd={startNew} onEdit={startEdit} onDelete={removeLesson} />
        )}
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function ResourceSection({ title, icon, section, value, onChange, onAdd, resources, items, labels, onRemove }: { title: string; icon: React.ReactNode; section: 'lesson' | 'homework'; value: string; onChange: (value: string) => void; onAdd: () => void; resources: GroupPlanResources; items: GroupLessonItemIn[]; labels: Map<string, string>; onRemove: (index: number) => void }) {
  const [filter, setFilter] = useState<TopicFilter>(section === 'homework' ? 'homework' : 'tutorial');
  const [subject, setSubject] = useState('all');
  const subjects = useMemo(() => Array.from(new Set(resources.topics.map((topic) => topic.subject).filter(Boolean))).sort(), [resources.topics]);
  const filteredTopics = resources.topics.filter((topic) => {
    const matchesType = filter === 'variants'
      ? topic.category === 'variants' || topic.category === 'mock'
      : filter === 'tutorial'
        ? topic.category === 'tutorial' || topic.category === 'math'
        : topic.category === filter;
    return matchesType && (subject === 'all' || topic.subject === subject);
  });

  const changeFilter = (nextFilter: TopicFilter) => {
    setFilter(nextFilter);
    onChange('');
  };

  const changeSubject = (nextSubject: string) => {
    setSubject(nextSubject);
    onChange('');
  };

  return <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">{icon}{title}</div>
    <div className="mb-2 grid grid-cols-2 gap-2">
      <select value={filter} onChange={(event) => changeFilter(event.target.value as TopicFilter)} className="admin-plan-input">
        {TOPIC_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select value={subject} onChange={(event) => changeSubject(event.target.value)} className="admin-plan-input">
        <option value="all">Все предметы</option>
        {subjects.map((item) => <option key={item} value={item}>{subjectLabel(item)}</option>)}
      </select>
    </div>
    <div className="flex gap-2"><select value={value} onChange={(e) => onChange(e.target.value)} className="admin-plan-input min-w-0 flex-1"><option value="">{filteredTopics.length ? 'Выберите топик' : 'Топиков этого типа нет'}</option>{filteredTopics.map((topic) => <option key={topic.id} value={String(topic.id)}>{topic.title}</option>)}</select><button type="button" onClick={onAdd} disabled={!value} className="rounded-lg bg-emerald-500 px-3 text-white disabled:opacity-30"><Plus size={17} /></button></div>
    <div className="mt-2 space-y-1.5">{items.map((item, index) => {
      if (item.section !== section) return null;
      const key = item.topic_id ? `topic:${item.topic_id}` : `task:${item.task_id}`;
      return (
        <div key={`${key}:${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.035] px-2.5 py-2 text-xs font-medium text-slate-300">
          <span className="min-w-0 flex-1 truncate">{labels.get(key) || 'Материал'}</span>
          {item.topic_id && (
            <a
              href={`/worksheet/${item.topic_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-400/20 hover:text-emerald-200"
              title="Открыть рабочий лист PDF"
            >
              <FileDown size={12} />
              Рабочий лист
            </a>
          )}
          <button type="button" onClick={() => onRemove(index)} className="shrink-0 text-slate-600 hover:text-red-400" title="Убрать топик"><X size={14} /></button>
        </div>
      );
    })}</div>
  </div>;
}

function subjectLabel(subject: string) {
  if (subject === 'informatics') return 'Информатика';
  if (subject === 'math') return 'Математика';
  return subject;
}

function LessonPlanTable({
  groupId,
  apiKey,
  lessons,
  loading,
  error,
  onAdd,
  onEdit,
  onDelete,
}: {
  groupId: number;
  apiKey: string;
  lessons: GroupLesson[];
  loading: boolean;
  error: string;
  onAdd: () => void;
  onEdit: (lesson: GroupLesson) => void;
  onDelete: (lesson: GroupLesson) => void;
}) {
  const [selected, setSelected] = useState<{ lessonId: number; itemId: number } | null>(null);
  if (loading) return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Загрузка плана...</div>;
  if (error) return <div className="m-6 rounded-lg border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>;
  if (lessons.length === 0) {
    return <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><CalendarDays size={38} className="text-slate-700" /><p className="mt-3 text-base font-bold text-slate-300">Уроков пока нет</p><p className="mt-1 text-sm text-slate-500">Добавьте первый урок в план группы.</p><button onClick={onAdd} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white hover:bg-emerald-400"><Plus size={16} />Добавить урок</button></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[960px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#202020]">
          <tr className="border-b border-white/[0.07] text-left">
            <th className="h-12 px-6 text-[11px] font-bold uppercase tracking-wide text-slate-500">Дата урока</th>
            <th className="h-12 px-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Урок</th>
            <th className="h-12 px-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Топики на уроке</th>
            <th className="h-12 px-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Топики на дом</th>
            <th className="h-12 px-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Дедлайн ДЗ</th>
            <th className="h-12 px-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Статус</th>
            <th className="h-12 px-6 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Управление</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => {
            const lessonTopics = lesson.items.filter((item) => item.section === 'lesson');
            const homeworkTopics = lesson.items.filter((item) => item.section === 'homework');
            const statusLabel = lesson.status === 'completed' ? 'Проведён' : lesson.status === 'published' ? 'Опубликован' : 'Черновик';
            const selectedItem = selected?.lessonId === lesson.id ? lesson.items.find(item => item.id === selected.itemId) : undefined;
            const showProgress = (itemId: number) => setSelected(current => current?.lessonId === lesson.id && current.itemId === itemId ? null : { lessonId: lesson.id, itemId });
            return (
              <Fragment key={lesson.id}>
              <tr className="border-b border-white/[0.055] align-top transition-colors last:border-b-0 hover:bg-white/[0.025]">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-300">{formatDate(lesson.lesson_at)}</td>
                <td className="max-w-[220px] px-5 py-4"><p className="text-sm font-bold text-slate-100">{lesson.title}</p>{lesson.note && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{lesson.note}</p>}</td>
                <td className="max-w-[260px] px-5 py-4"><LessonMaterials apiKey={apiKey} items={lessonTopics} tone="lesson" selectedId={selectedItem?.id} onShowProgress={showProgress} /></td>
                <td className="max-w-[260px] px-5 py-4"><LessonMaterials apiKey={apiKey} items={homeworkTopics} tone="homework" selectedId={selectedItem?.id} onShowProgress={showProgress} /></td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-400">{lesson.homework_deadline ? formatDate(lesson.homework_deadline) : '—'}</td>
                <td className="px-5 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide ${lesson.status === 'completed' ? 'bg-emerald-400/10 text-emerald-300' : lesson.status === 'published' ? 'bg-sky-400/10 text-sky-300' : 'bg-white/[0.05] text-slate-500'}`}>{statusLabel}</span></td>
                <td className="px-6 py-4"><div className="flex justify-end gap-1"><button onClick={() => onEdit(lesson)} className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-400/10 hover:text-sky-400" title="Изменить урок"><Pencil size={16} /></button><button onClick={() => onDelete(lesson)} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-400/10 hover:text-red-400" title="Удалить урок"><Trash2 size={16} /></button></div></td>
              </tr>
              {selectedItem && (
                <tr><td colSpan={7} className="p-0">
                  <GroupLessonProgress key={`${lesson.id}:${selectedItem.id}`} groupId={groupId} studentId={lesson.student_id} item={selectedItem} apiKey={apiKey} onClose={() => setSelected(null)} />
                </td></tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LessonMaterials({ items, tone, selectedId, onShowProgress, apiKey }: { items: GroupLesson['items']; tone: 'lesson' | 'homework'; selectedId?: number; onShowProgress: (itemId: number) => void; apiKey: string }) {
  if (items.length === 0) return <span className="text-sm text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <div key={item.id} className={`flex max-w-full items-center gap-1 rounded-lg py-1 pl-2.5 pr-1 text-xs font-semibold ${tone === 'lesson' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-violet-400/10 text-violet-300'}`} title={item.title}>
          <button type="button" disabled={item.topic_id == null} onClick={() => onShowProgress(item.id)} aria-expanded={selectedId === item.id} title="Показать выполнение учениками" className="inline-flex min-w-0 items-center gap-1.5 rounded-md py-1 text-left hover:underline disabled:opacity-50">
            <BarChart3 size={14} className="shrink-0" />
            <span className="truncate">{item.title}</span>
          </button>
          {item.resource_type === 'topic' && item.topic_id != null && (
            <TopicPreviewButton topicId={item.topic_id} title={item.title} apiKey={apiKey} />
          )}
          {item.resource_type === 'topic' && item.topic_id && (
            <a
              href={`/worksheet/${item.topic_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-black/15 px-1.5 text-[10px] font-bold text-current transition hover:bg-white/10"
              title="Открыть рабочий лист PDF"
            >
              <FileDown size={12} />
              Лист
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function toLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function isIndividualGroupName(name: string) {
  const normalizedName = name.trim().toLocaleLowerCase('ru-RU');
  return normalizedName.startsWith('индивидуал') || normalizedName.startsWith('individual');
}
