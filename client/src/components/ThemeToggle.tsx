import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "../context/ThemeContext";

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={clsx(
        "theme-toggle inline-flex items-center justify-center gap-2 rounded-xl border transition-colors",
        compact ? "h-8 w-8" : "h-10 px-3 text-xs font-bold",
        className,
      )}
      aria-label={isDark ? "Включить светлую тему" : "Включить темную тему"}
      title={isDark ? "Светлая тема" : "Темная тема"}
    >
      <Icon size={compact ? 18 : 16} />
      {!compact && <span>{isDark ? "Темная" : "Светлая"}</span>}
    </button>
  );
}
