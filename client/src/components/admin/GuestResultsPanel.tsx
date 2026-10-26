import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';
import { articleRequest } from '../../api/articles';

interface GuestAttempt {
  attempt_id: number;
  guest_id: number;
  guest_name: string;
  topic_id: number;
  topic_title: string;
  started_at: string | null;
  finished_at: string | null;
  primary_score: number | null;
  score: number | null;
  answered_count: number;
  total_tasks: number;
}

interface TaskResultRow {
  task_id: number;
  ege_number: number | null;
  user_answer: { val: unknown } | null;
  correct_answer: { val: unknown } | null;
  is_correct: boolean;
  points: number;
  max_points: number;
  auto_checked?: boolean;
}

interface AttemptResults {
  primary_score: number | null;
  score: number | null;
  task_results: TaskResultRow[];
}

const fmtDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtAnswer = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(item => (Array.isArray(item) ? item.join(' ') : String(item))).join('; ');
  return String(value);
};

function AttemptModal({ attempt, apiKey, onClose }: { attempt: GuestAttempt; apiKey: string; onClose: () => void }) {
  const [data, setData] = useState<AttemptResults | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attempt.finished_at) return;
    articleRequest<AttemptResults>(`/admin/attempts/${attempt.attempt_id}/results`, {}, apiKey)
      .then(setData)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Не удалось загрузить результаты'));
  }, [attempt.attempt_id, attempt.finished_at, apiKey]);

  const rows = [...(data?.task_results ?? [])].sort((a, b) => (a.ege_number ?? 99) - (b.ege_number ?? 99));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <div className="text-sm font-bold text-gray-900">{attempt.guest_name}</div>
            <div className="text-[11px] text-gray-400">{attempt.topic_title} · {fmtDate(attempt.finished_at ?? attempt.started_at)}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {!attempt.finished_at && <p className="text-sm text-gray-500">Вариант не сдан. Сохранено ответов: {attempt.answered_count}.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {attempt.finished_at && !data && !error && <p className="text-sm text-gray-400">Загрузка…</p>}
          {data && rows.length === 0 && <p className="text-sm text-gray-500">В этой попытке нет сохранённых ответов.</p>}
          {rows.length > 0 && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-gray-400">
                  <th className="py-2">№</th><th>Ответ ученика</th><th>Верный ответ</th><th className="text-right">Баллы</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.task_id} className="border-t border-gray-100">
                    <td className="py-2 font-bold text-gray-700">{row.ege_number ?? '?'}</td>
                    <td className={clsx('font-mono font-bold', row.auto_checked === false ? 'text-gray-700' : row.is_correct ? 'text-emerald-600' : 'text-red-500')}>
                      {fmtAnswer(row.user_answer?.val)}
                    </td>
                    <td className="font-mono text-gray-500">{fmtAnswer(row.correct_answer?.val)}</td>
                    <td className="text-right font-bold text-gray-700">{row.points}/{row.max_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function GuestResultsPanel({ apiKey }: { apiKey: string }) {
  const [items, setItems] = useState<GuestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [selected, setSelected] = useState<GuestAttempt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await articleRequest<GuestAttempt[]>('/admin/guest-results', {}, apiKey));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить результаты');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);
  useEffect(() => { void load(); }, [load]);

  const topics = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach(item => map.set(item.topic_id, item.topic_title));
    return [...map.entries()];
  }, [items]);

  const visible = items.filter(item =>
    (topic === 'all' || item.topic_id === Number(topic)) &&
    item.guest_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Поиск по имени"
            className="h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-[#3F8C62]"
          />
        </div>
        <select
          value={topic}
          onChange={event => setTopic(event.target.value)}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900"
        >
          <option value="all">Все варианты</option>
          {topics.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <button onClick={() => void load()} className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-600 hover:bg-gray-50">Обновить</button>
        <span className="text-xs text-gray-400">Попыток: {visible.length}</span>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-400">Загрузка…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">Гостевых попыток пока нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-gray-400">
                <th className="px-4 py-3">Ученик</th><th>Вариант</th><th>Начал</th><th>Сдал</th>
                <th>Ответов</th><th>Первичный</th><th>Балл</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(item => (
                <tr key={item.attempt_id} onClick={() => setSelected(item)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.guest_name}</td>
                  <td className="text-gray-600">{item.topic_title}</td>
                  <td className="text-gray-500">{fmtDate(item.started_at)}</td>
                  <td className={item.finished_at ? 'text-gray-500' : 'font-semibold text-amber-600'}>{item.finished_at ? fmtDate(item.finished_at) : 'не сдал'}</td>
                  <td className="text-gray-700">{item.answered_count}/{item.total_tasks}</td>
                  <td className="font-bold text-gray-900">{item.finished_at ? item.primary_score ?? '—' : '—'}</td>
                  <td className="font-bold text-gray-900">{item.finished_at ? item.score ?? '—' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <AttemptModal attempt={selected} apiKey={apiKey} onClose={() => setSelected(null)} />}
    </div>
  );
}
