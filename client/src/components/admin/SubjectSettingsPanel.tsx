import { useEffect, useMemo, useState } from 'react';
import { Check, Hash, LoaderCircle, Save, Settings2 } from 'lucide-react';
import { api } from '../../api/client';
import type { ExamSubjectSettings, TopicSubject } from '../../api/types';

type ExamType = 'ege' | 'oge';

const subjectLabels: Record<TopicSubject, string> = {
  informatics: 'Информатика',
  math: 'Математика',
};

export function SubjectSettingsPanel() {
  const [allSettings, setAllSettings] = useState<ExamSubjectSettings[]>([]);
  const [examType, setExamType] = useState<ExamType>('ege');
  const [subject, setSubject] = useState<TopicSubject>('informatics');
  const [taskCount, setTaskCount] = useState(1);
  const [taskNames, setTaskNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ExamSubjectSettings[]>('/admin/subject-settings')
      .then(setAllSettings)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  }, []);

  const currentSettings = useMemo(
    () => allSettings.find((item) => item.exam_type === examType && item.subject === subject),
    [allSettings, examType, subject],
  );

  useEffect(() => {
    if (!currentSettings) return;
    setTaskCount(currentSettings.task_count);
    setTaskNames(currentSettings.task_names ?? {});
    setSaved(false);
    setError('');
  }, [currentSettings]);

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const result = await api<ExamSubjectSettings>(`/admin/subject-settings/${examType}/${subject}`, {
        method: 'PUT',
        body: JSON.stringify({ task_count: taskCount, task_names: taskNames }),
      });
      setAllSettings((current) => [
        ...current.filter((item) => item.exam_type !== examType || item.subject !== subject),
        result,
      ]);
      setTaskNames(result.task_names);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid flex-1 place-items-center text-sm text-gray-500"><LoaderCircle className="animate-spin" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <section className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-7">
        <header className="mb-6 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Settings2 size={21} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Настройки предметов</h2>
            <p className="mt-1 text-sm text-gray-500">Задайте структуру экзамена и подпишите каждый номер задания.</p>
          </div>
        </header>

        <div className="mb-7 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-bold text-gray-600">
            Тип экзамена
            <select className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm" value={examType} onChange={(event) => setExamType(event.target.value as ExamType)}>
              <option value="ege">ЕГЭ</option>
              <option value="oge">ОГЭ</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-gray-600">
            Предмет
            <select className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm" value={subject} onChange={(event) => setSubject(event.target.value as TopicSubject)}>
              {Object.entries(subjectLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-gray-600">
            Количество заданий
            <input
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              type="number"
              min={1}
              max={100}
              value={taskCount}
              onChange={(event) => {
                setSaved(false);
                setTaskCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)));
              }}
            />
          </label>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-gray-900">Названия заданий</h3>
            <p className="text-xs text-gray-500">Название можно оставить пустым.</p>
          </div>
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">{examType.toUpperCase()} · {subjectLabels[subject]}</span>
        </div>

        <div className="grid gap-2">
          {Array.from({ length: taskCount }, (_, index) => index + 1).map((number) => (
            <label key={number} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 transition-colors focus-within:border-emerald-500">
              <span className="flex w-14 shrink-0 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-2 text-sm font-black text-emerald-700">
                <Hash size={13} />{number}
              </span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-sm outline-none"
                value={taskNames[String(number)] ?? ''}
                onChange={(event) => {
                  setSaved(false);
                  setTaskNames((current) => ({ ...current, [String(number)]: event.target.value }));
                }}
                placeholder={`Название задания №${number}`}
              />
            </label>
          ))}
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
        <div className="subject-settings-savebar">
          {saved && (
            <span className="subject-settings-saved-message">
              <Check size={16} />
              Изменения сохранены
            </span>
          )}
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className="subject-settings-save-button"
          >
            {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </section>
    </div>
  );
}
