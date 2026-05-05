import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { TopicCard } from '../components/TopicCard';
import { useNavigation } from '../hooks/useApi';
import { TopicCategory, type TopicNav } from '../api/types';
import { api } from '../api/client';

export function TasksListPage() {
  const { data: allTopics, isLoading } = useNavigation();
  const queryClient = useQueryClient();
  const [newTaskNotices, setNewTaskNotices] = useState<Record<number, number>>({});

  const taskGroups = useMemo(() => {
    if (!allTopics) return [];

    const tutorials = allTopics.filter(t => t.category === TopicCategory.tutorial);
    const homeworks  = allTopics.filter(t => t.category === TopicCategory.homework);

    const egeNums = new Set([
      ...tutorials.map(t => t.ege_number).filter((n): n is number => n != null),
      ...homeworks.map(t => t.ege_number).filter((n): n is number => n != null),
    ]);

    return Array.from(egeNums)
      .sort((a, b) => a - b)
      .map(egeNum => {
        const tutTopics = tutorials
          .filter(t => t.ege_number === egeNum)
          .sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
        const hwTopics = homeworks
          .filter(t => t.ege_number === egeNum)
          .sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
        const tut = tutTopics[0] ?? null;
        const hw  = hwTopics[0] ?? null;
        // Topic-level explicit range (ege_number_end) takes priority
        const explicitEnd = tut?.ege_number_end ?? hw?.ege_number_end ?? null;
        // Otherwise compute composite range from tasks' sub_tasks
        const allTasks = [...tutTopics, ...hwTopics].flatMap(t => t.tasks);
        const taskMax = allTasks.reduce<number | null>((acc, t) => {
          const m = (t as any).ege_number_max as number | null | undefined;
          if (typeof m === 'number' && (acc == null || m > acc)) return m;
          return acc;
        }, null);
        const maxNum = explicitEnd ?? taskMax;
        const egeLabel = maxNum != null && maxNum > egeNum ? `${egeNum}-${maxNum}` : String(egeNum);
        // Image: prefer tutorial topic's image, else homework's
        const imgSrc = tut?.has_image ? tut : hw?.has_image ? hw : null;
        const image = imgSrc
          ? {
              topicId: imgSrc.id,
              position: (imgSrc.image_position ?? 'cover') as any,
              size: imgSrc.image_size ?? 120,
            }
          : null;
        // Background / character: tutorial in priority, homework as fallback
        const bgSrc = tut?.background_url ? tut : hw?.background_url ? hw : null;
        const charSrc = tut?.character_url ? tut : hw?.character_url ? hw : null;
        return {
          egeNum,
          egeLabel,
          topicIds: [...tutTopics, ...hwTopics].map(topic => topic.id),
          title: tut?.title ?? hw?.title ?? `Задание ${egeLabel}`,
          tutorial: tut ? {
            id: tut.id,
            solved: tutTopics.reduce((sum, topic) => sum + topic.tasks.filter(t => t.status === 'solved').length, 0),
            total: tutTopics.reduce((sum, topic) => sum + topic.tasks.length, 0),
          } : null,
          homework: hw ? {
            id: hw.id,
            solved: hwTopics.reduce((sum, topic) => sum + topic.tasks.filter(t => t.status === 'solved').length, 0),
            total: hwTopics.reduce((sum, topic) => sum + topic.tasks.length, 0),
          } : null,
          image,
          backgroundUrl: bgSrc?.background_url ?? undefined,
          characterUrl: charSrc?.character_url ?? undefined,
          newTasksCount: tutTopics.reduce((sum, topic) => sum + (topic.new_tasks_count ?? 0), 0)
            + hwTopics.reduce((sum, topic) => sum + (topic.new_tasks_count ?? 0), 0),
        };
      });
  }, [allTopics]);

  useEffect(() => {
    if (isLoading || taskGroups.length === 0) return;

    const nextNotices: Record<number, number> = {};
    const seenTopicIds: number[] = [];

    for (const group of taskGroups) {
      if (group.newTasksCount > 0) {
        nextNotices[group.egeNum] = group.newTasksCount;
        seenTopicIds.push(...group.topicIds);
      }
    }

    if (seenTopicIds.length > 0) {
      setNewTaskNotices(nextNotices);
      api("/navigation/seen-topics", {
        method: "POST",
        body: JSON.stringify({ topic_ids: seenTopicIds }),
      }).then(() => {
        const marked = new Set(seenTopicIds);
        queryClient.setQueryData<TopicNav[]>(["navigation"], (current) =>
          current?.map(topic => marked.has(topic.id) ? { ...topic, new_tasks_count: 0 } : topic)
        );
      }).catch(() => {
        // Non-critical: the badge can be marked seen on the next successful request.
      });
    }
  }, [isLoading, taskGroups, queryClient]);

  // ── Шатл: рандомно выбираем карточку и проигрываем пролёт по её картинке ──
  const [shuttle, setShuttle] = useState<{ ege: number; key: number } | null>(null);
  const groupsRef = useRef(taskGroups);
  groupsRef.current = taskGroups;

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const FLIGHT_MS = 6500; // максимальная длительность одного пролёта (см. ShuttleInImage)

    const tick = () => {
      if (cancelled) return;
      const items = groupsRef.current;
      if (items.length === 0) {
        timer = window.setTimeout(tick, 3000);
        return;
      }
      const target = items[Math.floor(Math.random() * items.length)];
      setShuttle({ ege: target.egeNum, key: Date.now() });

      timer = window.setTimeout(() => {
        if (cancelled) return;
        setShuttle(null);
        const pause = 2500 + Math.random() * 7000; // 2.5-9.5s между пролётами
        timer = window.setTimeout(tick, pause);
      }, FLIGHT_MS);
    };

    timer = window.setTimeout(tick, 1500 + Math.random() * 3000);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-full space-y-6 p-4 md:p-8 animate-in fade-in duration-500 bg-[radial-gradient(circle_at_50%_0%,rgba(78,140,90,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.34),rgba(248,247,244,0))]">
      {isLoading ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 max-w-[1400px] mx-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 rounded-[18px] border border-[#dfe8df] bg-white/70 animate-pulse" />
          ))}
        </div>
      ) : taskGroups.length > 0 ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 max-w-[1400px] mx-auto">
          {taskGroups.map(g => (
            <TopicCard
              key={g.egeNum}
              egeId={g.egeLabel}
              egeNum={g.egeNum}
              title={g.title}
              tutorial={g.tutorial}
              homework={g.homework}
              image={g.image}
              backgroundUrl={g.backgroundUrl}
              characterUrl={g.characterUrl}
              shuttleKey={shuttle?.ege === g.egeNum ? shuttle.key : null}
              newTasksCount={newTaskNotices[g.egeNum] ?? 0}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 max-w-[1400px] mx-auto">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} className="opacity-20" />
          </div>
          <p className="font-bold text-lg text-gray-900">Заданий пока нет</p>
          <p className="text-sm">Темы появятся, когда учитель их добавит</p>
        </div>
      )}
    </div>
  );
}
