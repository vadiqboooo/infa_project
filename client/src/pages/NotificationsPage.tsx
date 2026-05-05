import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight, MessageSquare } from "lucide-react";
import {
  useMarkSolutionCommentNotificationsRead,
  useSolutionCommentNotifications,
} from "../hooks/useApi";

function taskPath(topicCategory: string, topicId: number, taskId: number) {
  const base = topicCategory === "homework" ? "/homework" : "/tasks";
  return `${base}/${topicId}?task=${taskId}&solution=1`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useSolutionCommentNotifications();
  const { mutate: markRead } = useMarkSolutionCommentNotificationsRead();

  useEffect(() => {
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length > 0) {
      markRead({ comment_ids: unreadIds });
    }
  }, [notifications, markRead]);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_50%_0%,rgba(78,140,90,0.11),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.42),rgba(248,247,244,0))] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3F8C62]/10 text-[#3F8C62]">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#18251d]">Уведомления</h1>
            <p className="text-sm font-medium text-[#7a877c]">Комментарии преподавателя к вашим решениям</p>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-[#dfe8df] bg-white p-8 text-sm font-semibold text-[#7a877c]">
            Загрузка уведомлений...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dfe8df] bg-white/80 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0f5f0] text-[#8a948b]">
              <MessageSquare size={20} />
            </div>
            <div className="text-sm font-black text-[#18251d]">Комментариев пока нет</div>
            <div className="mt-1 text-sm text-[#7a877c]">Когда преподаватель отметит место в коде, оно появится здесь.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => (
              <Link
                key={item.id}
                to={taskPath(item.topic_category, item.topic_id, item.task_id)}
                className="group flex items-start gap-4 rounded-3xl border border-[#dfe8df] bg-white p-4 shadow-[0_16px_36px_rgba(15,23,20,0.06)] transition-all hover:border-amber-200 hover:bg-amber-50/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-[#18251d]">
                      {item.ege_number ? `${item.ege_number} - ${item.task_order_index + 1}` : `#${item.task_id} - ${item.task_order_index + 1}`}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8a948b]">{formatDate(item.updated_at || item.created_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-[#344238]">
                    {item.text}
                  </p>
                </div>
                <ChevronRight size={18} className="mt-2 shrink-0 text-[#b8c2b9] transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
