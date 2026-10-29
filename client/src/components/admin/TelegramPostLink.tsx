import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function TelegramPostLink({ topicId, title }: { topicId: number; title: string }) {
  const [copied, setCopied] = useState<'link' | 'post' | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bot = (import.meta.env.VITE_BOT_USERNAME || 'easymath26_bot').replace(/^@/, '');
  const link = token ? `https://t.me/${bot}?startapp=topic_${topicId}_${token}` : '';
  const post = `📚 ${title}\n\n[Здесь ваш разбор: ключевая идея, шаги решения и частая ошибка.]\n\nТеперь попробуйте решить задачи самостоятельно. Ответ можно сразу проверить на сайте, а прогресс сохранится в вашем профиле.\n\n👉 Решать задачи: ${link}`;

  useEffect(() => {
    let active = true;
    api<{ token: string | null }>(`/admin/topics/${topicId}/telegram-link`)
      .then(data => { if (active) setToken(data.token); })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [topicId]);

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api<{ token: string | null }>(`/admin/topics/${topicId}/telegram-link`, {
        method: token ? 'DELETE' : 'POST',
      });
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить ссылку');
    } finally { setBusy(false); }
  };

  const copy = async (value: string, kind: 'link' | 'post') => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return <section className="border-t border-gray-100 pt-6 dark:border-white/10">
    <h4 className="text-sm font-black text-gray-900 dark:text-white">Пост для Telegram</h4>
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ссылка откроет этот топик через мини-приложение бота. Добавьте свой разбор перед ссылкой.</p>
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Для работы ссылки Main Mini App бота должен вести на https://rancheasy.ru/telegram.</p>
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      {token && <>
        <a href={link} target="_blank" rel="noreferrer" className="break-all text-sm font-bold text-[#3F8C62] underline">{link}</a>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(link, 'link')} className="rounded-xl bg-[#3F8C62] px-4 py-2 text-xs font-bold text-white">{copied === 'link' ? 'Скопировано' : 'Копировать ссылку'}</button>
          <button type="button" onClick={() => copy(post, 'post')} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 dark:border-white/10 dark:text-white">{copied === 'post' ? 'Скопировано' : 'Копировать черновик поста'}</button>
        </div>
      </>}
      <button type="button" onClick={toggle} disabled={busy} className="mt-3 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 disabled:opacity-60 dark:border-white/10 dark:text-white">{token ? 'Отключить ссылку' : 'Включить ссылку для поста'}</button>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  </section>;
}
