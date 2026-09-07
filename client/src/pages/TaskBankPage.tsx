import { useEffect, useMemo, useRef, useState } from 'react';
import parse from 'html-react-parser';
import { useNavigate } from 'react-router-dom';
import { Database, Eye, EyeOff, Filter, Pencil, Plus, Search } from 'lucide-react';
import { api } from '../api/client';
import { AnswerType, TaskDifficulty, type TaskAdmin, type TaskBankItem } from '../api/types';
import { TaskEditPanel } from '../components/admin/TopicDetail';
import './TaskBankPage.css';

type ExamFilter = 'all' | 'ege' | 'oge';
type SubjectFilter = 'all' | 'informatics' | 'math';

const TASK_BANK_STATE_KEY = 'admin-task-bank-state';

function readTaskBankState(): {
  exam: ExamFilter;
  subject: SubjectFilter;
  numberQuery: string;
  scrollTop: number;
} {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TASK_BANK_STATE_KEY) ?? '{}');
    return {
      exam: ['all', 'ege', 'oge'].includes(saved.exam) ? saved.exam : 'all',
      subject: ['all', 'informatics', 'math'].includes(saved.subject) ? saved.subject : 'all',
      numberQuery: typeof saved.numberQuery === 'string' ? saved.numberQuery : '',
      scrollTop: typeof saved.scrollTop === 'number' ? saved.scrollTop : 0,
    };
  } catch {
    return { exam: 'all', subject: 'all', numberQuery: '', scrollTop: 0 };
  }
}

const subjectNames: Record<string, string> = {
  informatics: 'Информатика',
  math: 'Математика',
};

function answerText(value: unknown): string {
  if (value == null || value === '') return 'Ответ не указан';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(answerText).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['val', 'value', 'answer', 'correct_answer', 'values']) {
      if (record[key] != null) return answerText(record[key]);
    }
    return Object.entries(record)
      .map(([key, item]) => `${key}: ${answerText(item)}`)
      .join('; ');
  }
  return String(value);
}

function TaskAnswer({ task }: { task: TaskBankItem }) {
  const mainAnswer = answerText(task.correct_answer);
  const subAnswers = (task.sub_tasks ?? []).filter((item) => item.correct_answer != null);

  return (
    <div className="task-bank-answer-content">
      {task.correct_answer != null && <div>{mainAnswer}</div>}
      {subAnswers.map((item, index) => (
        <div key={`${item.number ?? index}-${index}`}>
          <span>{item.number != null ? `${item.number}. ` : `${index + 1}. `}</span>
          {answerText(item.correct_answer)}
        </div>
      ))}
      {task.correct_answer == null && subAnswers.length === 0 && <div>Ответ не указан</div>}
    </div>
  );
}

export default function TaskBankPage() {
  const navigate = useNavigate();
  const [savedState] = useState(readTaskBankState);
  const pageRef = useRef<HTMLElement | null>(null);
  const [tasks, setTasks] = useState<TaskBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exam, setExam] = useState<ExamFilter>(savedState.exam);
  const [subject, setSubject] = useState<SubjectFilter>(savedState.subject);
  const [numberQuery, setNumberQuery] = useState(savedState.numberQuery);
  const [visibleAnswers, setVisibleAnswers] = useState<Set<number>>(new Set());
  const [editingStandaloneTask, setEditingStandaloneTask] = useState<Partial<TaskAdmin> | null>(null);

  useEffect(() => {
    let active = true;
    api<TaskBankItem[]>('/admin/task-bank')
      .then((data) => {
        if (active) setTasks(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить задания');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem(TASK_BANK_STATE_KEY, JSON.stringify({ exam, subject, numberQuery, scrollTop: savedState.scrollTop }));
  }, [exam, subject, numberQuery, savedState.scrollTop]);

  useEffect(() => {
    if (loading || !pageRef.current) return;
    const scrollContainer = pageRef.current.parentElement;
    requestAnimationFrame(() => {
      if (scrollContainer) scrollContainer.scrollTop = savedState.scrollTop;
    });
  }, [loading, savedState.scrollTop]);

  const filteredTasks = useMemo(() => {
    const query = numberQuery.trim().toLowerCase().replace(/^№\s*/, '');
    return tasks.filter((task) => {
      if (exam !== 'all' && task.exam_type !== exam) return false;
      if (subject !== 'all' && task.subject !== subject) return false;
      if (!query) return true;
      return [task.ege_number, task.external_id, task.id]
        .filter((value) => value != null)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [tasks, exam, subject, numberQuery]);

  const toggleAnswer = (taskId: number) => {
    setVisibleAnswers((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const editTask = (task: TaskBankItem) => {
    if (task.topic_id == null) {
      setEditingStandaloneTask(task);
      return;
    }
    const scrollTop = pageRef.current?.parentElement?.scrollTop ?? 0;
    sessionStorage.setItem(TASK_BANK_STATE_KEY, JSON.stringify({ exam, subject, numberQuery, scrollTop }));
    navigate(`/admin/topics/${task.topic_id}?task=${task.id}&from=task-bank`);
  };

  const createTask = () => {
    setEditingStandaloneTask({
      topic_id: null,
      subject: subject === 'all' ? 'informatics' : subject,
      exam_type: exam === 'all' ? 'ege' : exam,
      ege_number: 1,
      title: '',
      description: '',
      content_html: '',
      answer_type: AnswerType.single_number,
      difficulty: TaskDifficulty.easy,
      correct_answer: null,
      solution_steps: [],
      full_solution_code: '',
      order_index: 0,
      sub_tasks: null,
    });
  };

  const saveStandaloneTask = async (taskData: Partial<TaskAdmin>) => {
    const isNew = !taskData.id;
    const saved = await api<TaskAdmin>(isNew ? '/admin/tasks' : `/admin/tasks/${taskData.id}`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({ ...taskData, topic_id: null }),
    });
    const bankItem: TaskBankItem = {
      ...saved,
      topic_title: 'Без топика',
      subject: saved.subject ?? taskData.subject ?? 'informatics',
      exam_type: saved.exam_type ?? taskData.exam_type ?? 'ege',
    };
    setTasks((current) => isNew
      ? [...current, bankItem]
      : current.map((task) => task.id === bankItem.id ? bankItem : task));
    setEditingStandaloneTask(null);
  };

  if (editingStandaloneTask) {
    return (
      <main className="task-bank-page task-bank-editor-page">
        <div className="task-bank-editor-shell">
          <div className="task-bank-editor-body">
            <TaskEditPanel
              task={editingStandaloneTask}
              onBack={() => setEditingStandaloneTask(null)}
              onSave={(data) => { void saveStandaloneTask(data); }}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main ref={pageRef} className="task-bank-page">
      <section className="task-bank-heading">
        <div className="task-bank-heading-title">
          <div className="task-bank-title-icon"><Database size={22} /></div>
          <div>
            <h1>База заданий</h1>
          </div>
        </div>
        <section className="task-bank-filters" aria-label="Фильтры заданий">
          <div className="task-bank-filter-title"><Filter size={17} /><span>Фильтры</span></div>
          <label>
            <span>Тип экзамена</span>
            <select value={exam} onChange={(event) => setExam(event.target.value as ExamFilter)}>
              <option value="all">Все экзамены</option>
              <option value="ege">ЕГЭ</option>
              <option value="oge">ОГЭ</option>
            </select>
          </label>
          <label>
            <span>Предмет</span>
            <select value={subject} onChange={(event) => setSubject(event.target.value as SubjectFilter)}>
              <option value="all">Все предметы</option>
              <option value="informatics">Информатика</option>
              <option value="math">Математика</option>
            </select>
          </label>
          <label className="task-bank-search-label">
            <span>Номер задания</span>
            <div className="task-bank-search">
              <Search size={16} />
              <input
                value={numberQuery}
                onChange={(event) => setNumberQuery(event.target.value)}
                inputMode="numeric"
                placeholder="Например, 14"
              />
            </div>
          </label>
          <div className="task-bank-count">Найдено: <strong>{filteredTasks.length}</strong></div>
        </section>
        <button type="button" className="task-bank-create-button" onClick={createTask}>
          <Plus size={17} />
          Добавить задачу
        </button>
      </section>

      <section className="task-bank-table-wrap">
        {loading ? (
          <div className="task-bank-state">Загружаем задания…</div>
        ) : error ? (
          <div className="task-bank-state task-bank-error">{error}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="task-bank-state">По выбранным фильтрам заданий нет</div>
        ) : (
          <table className="task-bank-table">
            <thead>
              <tr>
                <th>Данные</th>
                <th>№</th>
                <th>Условие задания</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const answerVisible = visibleAnswers.has(task.id);
                return (
                  <tr key={task.id}>
                    <td data-label="Данные">
                      <div className="task-bank-meta">
                        <span className="task-bank-id">#{task.id}</span>
                        <span className="task-bank-badge task-bank-exam">{task.exam_type.toUpperCase()}</span>
                        <span className={`task-bank-badge task-bank-subject-${task.subject}`}>
                          {(subjectNames[task.subject] ?? task.subject).slice(0, 4)}
                        </span>
                      </div>
                    </td>
                    <td data-label="Номер"><strong>{task.ege_number ?? '—'}</strong></td>
                    <td data-label="Условие" className="task-bank-condition-cell">
                      <div className="task-bank-topic">{task.topic_title}</div>
                      {task.title && <div className="task-bank-task-title">{task.title}</div>}
                      <div className="task-bank-condition">
                        {task.content_html ? parse(task.content_html) : task.description || 'Условие не добавлено'}
                      </div>
                      <div className="task-bank-answer-row">
                        <div className="task-bank-actions">
                          <button
                            type="button"
                            className="task-bank-answer-button"
                            onClick={() => toggleAnswer(task.id)}
                            aria-expanded={answerVisible}
                          >
                            {answerVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                            {answerVisible ? 'Скрыть ответ' : 'Показать ответ'}
                          </button>
                          <button
                            type="button"
                            className="task-bank-edit-button"
                            onClick={() => editTask(task)}
                          >
                            <Pencil size={15} />
                            Редактировать
                          </button>
                        </div>
                        {answerVisible && <TaskAnswer task={task} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
