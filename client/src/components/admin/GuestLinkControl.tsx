import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface GuestLinkState {
  enabled: boolean;
  token: string | null;
  guests_count: number;
}

/** Teacher-side switch for the public "solve without an account" link of a variant. */
export default function GuestLinkControl({ topicId }: { topicId: number }) {
  const [state, setState] = useState<GuestLinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GuestLinkState>(`/admin/topics/${topicId}/guest-link`)
      .then((data) => !cancelled && setState(data))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const toggle = async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      setState(await api<GuestLinkState>(`/admin/topics/${topicId}/guest-link`, { method: state.enabled ? 'DELETE' : 'POST' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить ссылку');
    } finally {
      setBusy(false);
    }
  };

  const url = state?.token ? `${window.location.origin}/v/${state.token}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Не удалось скопировать — выделите ссылку вручную');
    }
  };

  return (
    <section className="border-t border-gray-100 pt-6 dark:border-white/10">
      <div className="mb-4">
        <h4 className="text-sm font-black text-gray-900 dark:text-white">Ссылка для учеников без аккаунта</h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Ученик открывает ссылку, вводит фамилию и имя и решает вариант. Результаты видны в списке учеников.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
        {state?.enabled && (
          <div className="mb-3 flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-white/10 dark:bg-[#151716] dark:text-white"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-xl bg-[#3F8C62] px-4 py-2 text-xs font-black text-white hover:opacity-90"
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {state?.enabled ? `Гостей зашло: ${state.guests_count}` : 'Ссылка выключена'}
          </span>
          <button
            type="button"
            onClick={toggle}
            disabled={!state || busy}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-white disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
          >
            {state?.enabled ? 'Выключить ссылку' : 'Включить ссылку'}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      </div>
    </section>
  );
}
