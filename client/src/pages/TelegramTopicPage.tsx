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
  const { user, loading, login } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const start = params.get('tgWebAppStartParam') ?? params.get('topic') ?? '';
  const match = /^(?:topic_)?([1-9]\d*)(?:_([A-Za-z0-9_-]{20,48}))?$/.exec(start);
  const topicId = match ? Number(match[1]) : null;
  const target = topicId ? `/tasks/${topicId}` : null;
  const shareToken = match?.[2] ?? null;
  const initData = window.Telegram?.WebApp?.initData ?? '';

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  useEffect(() => {
    if (!initData) return;
    try {
      const rawUser = new URLSearchParams(initData).get('user');
      if (rawUser) setTelegramId(Number(JSON.parse(rawUser).id));
    } catch { /* Server remains the authority for this value. */ }
  }, [initData]);

  useEffect(() => {
    if (!target || loading) return;
    if (user && (!initData || (telegramId != null && user.tg_id === telegramId))) {
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
    } else if (!user && !initData) {
      navigate(`/login?next=${encodeURIComponent(`/telegram?topic=${encodeURIComponent(start)}`)}`, { replace: true });
    }
  }, [target, topicId, shareToken, start, loading, user, initData, telegramId, navigate]);

  useEffect(() => {
    if (!target || !initData || loading || user || busy || error) return;
    setBusy(true);
    fetch('/api/auth/telegram-mini-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Не удалось войти через Telegram');
      login(data.access_token);
    }).catch((err: Error) => setError(err.message)).finally(() => setBusy(false));
  }, [target, initData, loading, user, busy, error, login]);

  const linkAccount = async () => {
    if (!target || !initData) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/telegram-mini-app/link', {
        method: 'POST',
        body: JSON.stringify({ init_data: initData }),
      });
      if (shareToken) await api(`/auth/telegram-topic/${topicId}/${shareToken}`, { method: 'POST' });
      window.location.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось привязать Telegram');
    } finally {
      setBusy(false);
    }
  };

  const switchAccount = async () => {
    if (!initData) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/telegram-mini-app', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: initData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Не удалось войти');
      login(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-5 dark:bg-[#151716]">
    <div className="w-full max-w-md rounded-3xl bg-white p-7 text-gray-900 shadow-lg dark:bg-[#242725] dark:text-white">
      <h1 className="text-xl font-black">Решение задач</h1>
      {!target && <p className="mt-3">В ссылке не указан топик. Откройте ссылку из поста ещё раз.</p>}
      {target && !user && !error && <p className="mt-3">Загружаем ваш профиль…</p>}
      {target && user && initData && telegramId !== user.tg_id && <>
        <p className="mt-3 text-sm">Вы вошли в аккаунт сайта. Привяжите к нему Telegram, чтобы сохранить прогресс в этом профиле.</p>
        {user.tg_id == null
          ? <button onClick={linkAccount} disabled={busy} className="mt-5 rounded-xl bg-[#3F8C62] px-5 py-3 font-bold text-white disabled:opacity-60">Привязать Telegram и решать</button>
          : <button onClick={switchAccount} disabled={busy} className="mt-5 rounded-xl bg-[#3F8C62] px-5 py-3 font-bold text-white disabled:opacity-60">Продолжить с аккаунтом Telegram</button>}
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {error.includes('уже привязан') && initData && <button onClick={switchAccount} disabled={busy} className="mt-4 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold dark:border-white/10">Продолжить с аккаунтом Telegram</button>}
    </div>
  </main>;
}
