import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2 } from 'lucide-react';
import { authFetch } from '../../api/client';
import type { TaskAdmin, TaskFile } from '../../api/types';
import TaskView from '../TaskView';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';

type PreviewTask = TaskAdmin & { media_resources?: { files?: TaskFile[] } | null };

export function TopicPreviewButton({ topicId, title, apiKey }: { topicId: number; title: string; apiKey: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery<PreviewTask[]>({
    queryKey: ['admin-topic-preview', topicId],
    enabled: open,
    queryFn: async ({ signal }) => {
      const response = await authFetch(`/api/admin/tasks?topic_id=${topicId}`, {
        signal,
        headers: { 'X-API-Key': apiKey },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Не удалось загрузить топик');
      }
      const tasks: PreviewTask[] = await response.json();
      return tasks.sort((a, b) => a.order_index - b.order_index || a.id - b.id);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-black/15 px-1.5 text-[10px] font-bold text-current transition hover:bg-white/10" title={`Просмотреть топик: ${title}`}>
          <Eye size={13} /> Просмотр
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 text-slate-900 dark:border-white/10 dark:bg-[#202020] dark:text-slate-100 sm:max-w-5xl">
        <div className="shrink-0 border-b border-slate-200 px-6 py-5 pr-12 dark:border-white/10">
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          <DialogDescription className="mt-1">Просмотр заданий топика{query.data ? ` · Всего: ${query.data.length}` : ''}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {query.isPending ? (
            <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Загружаем задания…</div>
          ) : query.isError ? (
            <div role="alert" className="py-6 text-center text-sm">
              <p>{query.error.message}</p>
              <button type="button" onClick={() => void query.refetch()} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Повторить</button>
            </div>
          ) : query.data?.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">В этом топике пока нет заданий.</p>
          ) : (
            <div className="space-y-5">
              {query.data?.map((task, index) => (
                <article key={task.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10 sm:p-5">
                  <h3 className="mb-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    Задание {index + 1}{task.title ? ` · ${task.title}` : ''}
                  </h3>
                  <TaskView content={task.content_html || task.description || 'Условие не добавлено'} files={task.media_resources?.files} />
                  {task.sub_tasks?.map((sub, subIndex) => (
                    <div key={subIndex} className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                      <h4 className="mb-2 text-sm font-semibold">{sub.number != null ? `Задание №${sub.number}` : `Часть ${subIndex + 2}`}</h4>
                      <TaskView content={sub.content_html} />
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
