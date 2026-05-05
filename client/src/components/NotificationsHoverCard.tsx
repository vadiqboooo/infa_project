import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  useAdminHelpNotifications,
  useMarkSolutionCommentNotificationsRead,
  useSolutionCommentNotifications,
} from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";

type NotificationsHoverCardProps = {
  className?: string;
  triggerClassName?: string;
  label?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

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

export function NotificationsHoverCard({
  className,
  triggerClassName,
  label,
  side = "right",
  align = "end",
}: NotificationsHoverCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [locallyReadIds, setLocallyReadIds] = useState<Set<number>>(new Set());
  const { data: notifications = [], isLoading } = useSolutionCommentNotifications(!isAdmin);
  const { data: adminNotifications = [], isLoading: isAdminLoading } = useAdminHelpNotifications(isAdmin);
  const markRead = useMarkSolutionCommentNotificationsRead();
  const unreadNotifications = notifications.filter(
    (item) => !item.is_read && !locallyReadIds.has(item.id),
  );
  const unreadCount = isAdmin ? adminNotifications.length : unreadNotifications.length;
  const count = isAdmin ? adminNotifications.length : notifications.length;
  const isListLoading = isAdmin ? isAdminLoading : isLoading;

  function markCurrentNotificationsRead() {
    if (isAdmin || unreadNotifications.length === 0) return;

    const commentIds = unreadNotifications.map((item) => item.id);
    setLocallyReadIds((current) => {
      const next = new Set(current);
      commentIds.forEach((id) => next.add(id));
      return next;
    });
    markRead.mutate({ comment_ids: commentIds });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      markCurrentNotificationsRead();
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={clsx(
            "relative flex items-center justify-center rounded-2xl border border-transparent bg-gray-50 text-gray-500 transition-colors hover:bg-[#3F8C62]/10 hover:text-[#3F8C62]",
            label ? "gap-2 px-3" : "h-11 w-11",
            triggerClassName,
          )}
          aria-label="Уведомления"
        >
          <Bell size={18} />
          {label && <span className="text-xs font-bold">{label}</span>}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        sideOffset={10}
        className={clsx(
          "w-[min(360px,calc(100vw-24px))] rounded-3xl border-[#dfe8df] bg-white p-0 shadow-[0_22px_60px_rgba(15,23,20,0.16)]",
          className,
        )}
      >
        <div className="border-b border-[#eef3ee] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-[#18251d]">Уведомления</div>
              <div className="text-xs font-medium text-[#7a877c]">
                Комментарии к решениям
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                {unreadCount}
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {isListLoading ? (
            <div className="p-4 text-sm font-semibold text-[#7a877c]">
              Загрузка уведомлений...
            </div>
          ) : count === 0 ? (
            <div className="px-4 py-7 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0f5f0] text-[#8a948b]">
                <MessageSquare size={18} />
              </div>
              <div className="text-sm font-black text-[#18251d]">
                Комментариев пока нет
              </div>
              <div className="mt-1 text-xs leading-relaxed text-[#7a877c]">
                Когда преподаватель отметит место в коде, уведомление появится здесь.
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {isAdmin ? adminNotifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/admin/students/${item.student_id}?reviewTask=${item.task_id}`);
                  }}
                  className="group flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-amber-50"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <MessageSquare size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-[#18251d]">
                        {item.ege_number ? `${item.ege_number} - ${item.task_order_index + 1}` : `#${item.task_id} - ${item.task_order_index + 1}`}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-[#8a948b]">
                        {formatDate(item.updated_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] font-bold text-[#667568]">
                      {item.student_name}
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-[#344238]">
                      {item.text}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="mt-2 shrink-0 text-[#b8c2b9] transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600"
                  />
                </button>
              )) : notifications.map((item) => (
                <Link
                  key={item.id}
                  to={taskPath(item.topic_category, item.topic_id, item.task_id)}
                  onClick={() => setOpen(false)}
                  className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-amber-50"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <MessageSquare size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-[#18251d]">
                        {item.ege_number ? `${item.ege_number} - ${item.task_order_index + 1}` : `#${item.task_id} - ${item.task_order_index + 1}`}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-[#8a948b]">
                        {formatDate(item.updated_at || item.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-[#344238]">
                      {item.text}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="mt-2 shrink-0 text-[#b8c2b9] transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
