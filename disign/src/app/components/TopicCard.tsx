import { Link } from "react-router";
import { CircleCheck, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

interface TopicCardProps {
  id: string;
  egeId: string;
  title: string;
  description: string;
  progress: { solved: number; total: number };
}

export function TopicCard({ id, egeId, title, description, progress }: TopicCardProps) {
  const isComplete = progress.solved === progress.total;
  const percent = Math.round((progress.solved / progress.total) * 100);

  const barColor =
    percent >= 80
      ? 'bg-[#3F8C62]'
      : percent >= 50
        ? 'bg-amber-400'
        : 'bg-red-300';

  return (
    <Link
      to={`/task/${id}`}
      className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1 block"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={clsx(
          "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
          isComplete ? "bg-green-100 text-green-700" : "bg-[#3F8C62] text-white"
        )}>
          {egeId}
        </div>
        <div className={clsx(
          "px-2 py-1 rounded-full text-xs font-medium",
          isComplete ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        )}>
          {progress.solved}/{progress.total}
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-4 group-hover:text-[#3F8C62] transition-colors">
        {title}
      </h3>

      <div className="flex items-center gap-2.5">
        <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div
            className={clsx(barColor, 'h-full rounded-full transition-all duration-500 ease-out')}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{percent}%</span>
      </div>
    </Link>
  );
}