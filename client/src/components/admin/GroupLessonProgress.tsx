import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../api/client';
import type { GroupLessonItem, TopicStatsOut } from '../../api/types';
import { TopicStats } from './TopicStats';

interface Props {
  groupId: number;
  studentId: number | null;
  item: GroupLessonItem;
  apiKey: string;
  onClose: () => void;
}

export function GroupLessonProgress({ groupId, studentId, item, apiKey, onClose }: Props) {
  const query = useQuery<TopicStatsOut>({
    queryKey: ['group-lesson-topic-progress', groupId, studentId, item.topic_id],
    queryFn: async ({ signal }) => {
      const response = await authFetch(
        `/api/admin/topics/${item.topic_id}/stats?group_id=${groupId}&include_unstarted=true`,
        { signal, cache: 'no-store', headers: { 'X-API-Key': apiKey } },
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Не удалось обновить выполнение топика');
      }
      return response.json();
    },
    enabled: item.topic_id != null,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const stats = query.data && {
    ...query.data,
    students: studentId == null ? query.data.students : query.data.students.filter(row => row.student_id === studentId),
    tasks: item.resource_type === 'task'
      ? query.data.tasks.filter(task => task.task_id === item.task_id)
      : query.data.tasks,
  };

  return (
    <section aria-label={`Выполнение: ${item.title}`} className="w-full bg-white">
      {query.isError && stats && <p role="status" className="px-6 py-2 text-xs text-amber-600">Не удалось обновить данные. Показаны последние результаты; повторяем подключение…</p>}
      {item.topic_id == null ? (
        <p className="p-6 text-sm text-gray-500">Топик удалён.</p>
      ) : stats ? (
        <>
          {stats.students.length === 0 && <p className="px-6 pt-4 text-sm text-gray-500">В группе нет учеников для этого урока.</p>}
            <TopicStats
              embedded
              stats={stats}
              groups={[]}
              apiKey={apiKey}
              onBack={onClose}
              onRefresh={() => void query.refetch()}
              onReviewSolution={(student, task) => window.open(
                `/admin/students/${student.student_id}/tasks/${task.task_id}/review`, '_blank', 'noopener,noreferrer',
              )}
            />
        </>
      ) : (
        <p role="status" className="p-6 text-sm text-gray-500">
          {query.isError ? query.error.message : 'Загружаем результаты учеников…'}
        </p>
      )}
    </section>
  );
}
