import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } };
  }
}

export default function TelegramTopicPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, telegramAuthError } = useAuth();
  const [error, setError] = useState('');
  const start = params.get('tgWebAppStartParam') ?? params.get('topic') ?? '';
  const match = /^(?:topic_)?([1-9]\d*)(?:_([A-Za-z0-9_-]{20,48}))?$/.exec(start);
  const topicId = match ? Number(match[1]) : null;
  const target = topicId ? `/tasks/${topicId}` : start ? null : '/tasks';
  const shareToken = match?.[2] ?? null;
  const inTelegram = Boolean(window.Telegram?.WebApp?.initData);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  useEffect(() => {
    if (!target || loading || telegramAuthError) return;
    if (!user) {
      if (!inTelegram) navigate(`/login?next=${encodeURIComponent(`/telegram?topic=${encodeURIComponent(start)}`)}`, { replace: true });
      return;
    }

    let active = true;
    const enter = async () => {
      try {
        if (shareToken) await api(`/auth/telegram-topic/${topicId}/${shareToken}`, { method: 'POST' });
        if (active) navigate(target, { replace: true });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Ссылка недействительна');
      }
    };
    void enter();
    return () => { active = false; };
  }, [target, topicId, shareToken, start, loading, user, telegramAuthError, inTelegram, navigate]);

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-5 dark:bg-[#151716]">
    <div className="w-full max-w-md rounded-3xl bg-white p-7 text-gray-900 shadow-lg dark:bg-[#242725] dark:text-white">
      <h1 className="text-xl font-black">Решение задач</h1>
      {!target && <p className="mt-3">Ссылка на топик недействительна. Откройте ссылку из поста ещё раз.</p>}
      {target && !error && !telegramAuthError && <p className="mt-3">Открываем задачи…</p>}
      {(error || telegramAuthError) && <>
        <p role="alert" className="mt-3 text-sm text-red-600">{error || telegramAuthError}</p>
        {telegramAuthError && <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[#3F8C62] px-5 py-3 font-bold text-white">Повторить</button>}
      </>}
    </div>
  </main>;
}
