import { useEffect, useMemo, useRef, useState } from 'react';
import parse from 'html-react-parser';
import { useNavigate } from 'react-router-dom';
import { Database, Eye, EyeOff, Filter, Pencil, Plus, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { AnswerType, TaskDifficulty, type ExamSubjectSettings, type TaskAdmin, type TaskBankItem } from '../api/types';
import { TaskEditPanel } from '../components/admin/TopicDetail';
import './TaskBankPage.css';

type ExamFilter = 'all' | 'ege' | 'oge';
type SubjectFilter = 'all' | 'informatics' | 'math';

const TASK_BANK_STATE_KEY = 'admin-task-bank-state';

function readTaskBankState(): {
  exam: ExamFilter;
  subject: SubjectFilter;
  numberQuery: string;
  idQuery: string;
  scrollTop: number;
} {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TASK_BANK_STATE_KEY) ?? '{}');
    return {
      exam: ['all', 'ege', 'oge'].includes(saved.exam) ? saved.exam : 'all',
      subject: ['all', 'informatics', 'math'].includes(saved.subject) ? saved.subject : 'all',
      numberQuery: typeof saved.numberQuery === 'string' ? saved.numberQuery.replace(/\D/g, '') : '',
      idQuery: typeof saved.idQuery === 'string' ? saved.idQuery : '',
      scrollTop: typeof saved.scrollTop === 'number' ? saved.scrollTop : 0,
    };
  } catch {
    return { exam: 'all', subject: 'all', numberQuery: '', idQuery: '', scrollTop: 0 };
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
  const [subjectSettings, setSubjectSettings] = useState<ExamSubjectSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exam, setExam] = useState<ExamFilter>(savedState.exam);
  const [subject, setSubject] = useState<SubjectFilter>(savedState.subject);
  const [numberQuery, setNumberQuery] = useState(savedState.numberQuery);
  const [idQuery, setIdQuery] = useState(savedState.idQuery);
  const [visibleAnswers, setVisibleAnswers] = useState<Set<number>>(new Set());
  const [editingStandaloneTask, setEditingStandaloneTask] = useState<Partial<TaskAdmin> | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<TaskBankItem[]>('/admin/task-bank'),
      api<ExamSubjectSettings[]>('/admin/subject-settings'),
    ])
      .then(([taskData, settingsData]) => {
        if (active) {
          setTasks(taskData);
          setSubjectSettings(settingsData);
        }
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
    sessionStorage.setItem(TASK_BANK_STATE_KEY, JSON.stringify({ exam, subject, numberQuery, idQuery, scrollTop: savedState.scrollTop }));
  }, [exam, subject, numberQuery, idQuery, savedState.scrollTop]);

  useEffect(() => {
    if (loading || !pageRef.current) return;
    const scrollContainer = pageRef.current.parentElement;
    requestAnimationFrame(() => {
      if (scrollContainer) scrollContainer.scrollTop = savedState.scrollTop;
    });
  }, [loading, savedState.scrollTop]);

  const scopedTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (exam !== 'all' && task.exam_type !== exam) return false;
      if (subject !== 'all' && task.subject !== subject) return false;
      return true;
    });
  }, [tasks, exam, subject]);

  const availableNumbers = useMemo(() => {
    const counts = new Map<number, number>();
    scopedTasks.forEach((task) => {
      if (task.ege_number != null) {
        counts.set(task.ege_number, (counts.get(task.ege_number) ?? 0) + 1);
      }
    });
    const configured = exam !== 'all' && subject !== 'all'
      ? subjectSettings.find((item) => item.exam_type === exam && item.subject === subject)
      : undefined;
    if (configured) {
      return Array.from({ length: configured.task_count }, (_, index) => {
        const number = index + 1;
        return [number, counts.get(number) ?? 0] as const;
      });
    }
    return [...counts.entries()].sort(([left], [right]) => left - right);
  }, [scopedTasks, exam, subject, subjectSettings]);

  const selectedSettings = useMemo(() => (
    exam !== 'all' && subject !== 'all'
      ? subjectSettings.find((item) => item.exam_type === exam && item.subject === subject)
      : undefined
  ), [exam, subject, subjectSettings]);

  const selectedNumber = numberQuery ? Number(numberQuery) : null;
  const filteredTasks = useMemo(() => {
    const normalizedId = idQuery.trim().toLowerCase().replace(/^[#№]\s*/, '');
    return scopedTasks.filter((task) => {
      if (selectedNumber != null && task.ege_number !== selectedNumber) return false;
      if (!normalizedId) return true;
      return String(task.id) === normalizedId || task.external_id?.toLowerCase() === normalizedId;
    });
  }, [scopedTasks, selectedNumber, idQuery]);

  const selectedNumberName = selectedNumber == null
    ? ''
    : selectedSettings?.task_names[String(selectedNumber)] ?? '';

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
    sessionStorage.setItem(TASK_BANK_STATE_KEY, JSON.stringify({ exam, subject, numberQuery, idQuery, scrollTop }));
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
      <section className="task-bank-filters" aria-label="Поиск и фильтры заданий">
        <div className="task-bank-heading-title">
          <div className="task-bank-title-icon"><Database size={22} /></div>
          <h1>База заданий</h1>
        </div>
        <div className="task-bank-filter-title"><Filter size={17} /><span>Фильтры</span></div>
        <label>
          <span>Тип экзамена</span>
          <select value={exam} onChange={(event) => {
            setExam(event.target.value as ExamFilter);
            setNumberQuery('');
          }}>
            <option value="all">Все экзамены</option>
            <option value="ege">ЕГЭ</option>
            <option value="oge">ОГЭ</option>
          </select>
        </label>
        <label>
          <span>Предмет</span>
          <select value={subject} onChange={(event) => {
            setSubject(event.target.value as SubjectFilter);
            setNumberQuery('');
          }}>
            <option value="all">Все предметы</option>
            <option value="informatics">Информатика</option>
            <option value="math">Математика</option>
          </select>
        </label>
        <label className="task-bank-number-filter">
          <span>Номер задания экзамена</span>
          <select value={numberQuery} onChange={(event) => setNumberQuery(event.target.value)}>
            <option value="">Все номера</option>
            {availableNumbers.map(([number, count]) => {
              const name = selectedSettings?.task_names[String(number)];
              return (
                <option key={number} value={number}>
                  №{number}{name ? ` — ${name}` : ''} ({count})
                </option>
              );
            })}
          </select>
        </label>
        <label className="task-bank-search-label">
          <span>Поиск по ID</span>
          <div className="task-bank-search">
            <Search size={18} />
            <input
              value={idQuery}
              onChange={(event) => setIdQuery(event.target.value)}
              aria-label="ID задания"
              placeholder="Внутренний или внешний ID"
            />
            {idQuery && (
              <button type="button" onClick={() => setIdQuery('')} aria-label="Очистить поиск по ID">
                <X size={17} />
              </button>
            )}
          </div>
        </label>
        <div className="task-bank-count">Найдено: <strong>{filteredTasks.length}</strong></div>
        <button type="button" className="task-bank-create-button" onClick={createTask}>
          <Plus size={17} />
          Добавить задачу
        </button>
      </section>

      <section className="task-bank-results">
        {!loading && !error && (
          <header className="task-bank-results-heading">
            <h2>
              {idQuery.trim()
                ? `Результаты поиска по ID «${idQuery.trim()}»`
                : selectedNumber == null
                  ? 'Все задания'
                  : `Задание №${selectedNumber}${selectedNumberName ? ` — ${selectedNumberName}` : ''}`}
            </h2>
            <p>{filteredTasks.length === 1 ? 'Найдена 1 задача' : `Найдено задач: ${filteredTasks.length}`}</p>
          </header>
        )}
        {loading ? (
          <div className="task-bank-state">Загружаем задания…</div>
        ) : error ? (
          <div className="task-bank-state task-bank-error">{error}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="task-bank-state">По выбранным фильтрам заданий нет</div>
        ) : (
          <div className="task-bank-list">
            {filteredTasks.map((task) => {
              const answerVisible = visibleAnswers.has(task.id);
              const taskNumberName = task.ege_number == null
                ? ''
                : subjectSettings.find((item) => item.exam_type === task.exam_type && item.subject === task.subject)
                  ?.task_names[String(task.ege_number)] ?? '';
              return (
                <article className="task-bank-card" key={task.id}>
                  <div className="task-bank-number" aria-label={`Номер задания ${task.ege_number ?? 'не указан'}`}>
                    {task.ege_number ?? '—'}
                  </div>
                  <div className="task-bank-card-body">
                    <div className="task-bank-meta">
                      {task.external_id && <span className="task-bank-source-id">№ {task.external_id}</span>}
                      <span className="task-bank-id">ID {task.id}</span>
                      <span className="task-bank-badge task-bank-exam">{task.exam_type.toUpperCase()}</span>
                      <span className={`task-bank-badge task-bank-subject-${task.subject}`}>
                        {subjectNames[task.subject] ?? task.subject}
                      </span>
                    </div>
                    {taskNumberName && <div className="task-bank-number-name">№{task.ege_number} · {taskNumberName}</div>}
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
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
