import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, FileText, GraduationCap, Settings, ShieldCheck, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { ProfileModal } from './ProfileModal';
import { NotificationsHoverCard } from './NotificationsHoverCard';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import './SidebarCollapse.css';

type SidebarProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const { user, logout } = useAuth();

  const links = [
    { icon: Home, label: 'Главная', path: '/dashboard' },
    { icon: BookOpen, label: 'Задания', path: '/tasks' },
    { icon: FileText, label: 'Варианты', path: '/exams' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard')
      return location.pathname === '/dashboard' || location.pathname === '/';
    if (path === '/tasks')
      return location.pathname === '/tasks'
        || location.pathname.startsWith('/tasks/')
        || location.pathname.startsWith('/homework/');
    if (path === '/exams')
      return location.pathname === '/exams' || location.pathname.startsWith('/exams/');
    return location.pathname.startsWith(path);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <div className={clsx(
        "app-sidebar flex h-screen shrink-0 flex-col border-r border-white/10 bg-[#07111D] text-slate-200 shadow-[10px_0_40px_rgba(0,0,0,0.18)] transition-[width] duration-200",
        collapsed ? "app-sidebar-collapsed w-20" : "w-60"
      )}>
        {/* Logo / Brand */}
        <div className={clsx("flex items-center gap-3 p-4", collapsed && "flex-col justify-center gap-2 px-3")}>
          <div className="w-9 h-9 bg-[#21B66F] rounded-xl flex items-center justify-center text-white shadow-[0_0_24px_rgba(33,182,111,0.25)]">
            <GraduationCap size={20} />
          </div>
          <div className={clsx("flex flex-col", collapsed && "hidden")}>
            <span className="text-sm font-bold text-white leading-tight">Информатика</span>
            <span className="text-[11px] text-slate-500 leading-tight">Подготовка к ЕГЭ</span>
          </div>
          <button
            type="button"
            onClick={() => onCollapsedChange?.(!collapsed)}
            className={clsx(
              "sidebar-collapse-toggle ml-auto flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white",
              collapsed && "mx-auto"
            )}
            title={collapsed ? "Показать меню" : "Скрыть меню"}
            aria-label={collapsed ? "Показать меню" : "Скрыть меню"}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {links.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.label}
                to={link.path}
                title={link.label}
                className={clsx(
                  'flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors',
                  collapsed ? 'justify-center px-0' : 'px-4',
                  active
                    ? 'bg-[#113E2D] text-[#8AF0B8] font-medium shadow-[0_8px_24px_rgba(33,182,111,0.12)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <link.icon size={18} />
                {!collapsed && <span className="flex-1">{link.label}</span>}
              </Link>
            );
          })}

          {/* Admin link */}
          {isAdmin && (
            <>
              <div className="h-px bg-white/10 my-2 mx-2" />
              <Link
                to="/admin"
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors',
                  location.pathname.startsWith('/admin')
                    ? 'bg-[#113E2D] text-[#8AF0B8] font-medium'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <ShieldCheck size={18} />
                <span>Админ-панель</span>
              </Link>
            </>
          )}
        </nav>

        {/* User card */}
        <div className="p-3 space-y-2">
          <ThemeToggle
            compact={collapsed}
            className={clsx(
              "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] hover:text-white",
              collapsed ? "mx-auto" : "w-full"
            )}
          />

          <div className={clsx("flex items-stretch gap-2", collapsed && "flex-col")}>
            <div
              onClick={() => setShowProfile(true)}
              className={clsx(
                'flex min-w-0 flex-1 items-center gap-3 px-3 py-3 rounded-2xl transition-colors cursor-pointer group',
                collapsed && "justify-center px-0",
                showProfile
                  ? 'bg-[#3F8C62]/10 ring-1 ring-[#3F8C62]/20'
                  : 'bg-white/[0.04] hover:bg-white/[0.07]'
              )}
            >
              <div className="relative shrink-0">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt={user.first_name || ''} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3F8C62] to-[#2D6B4A] flex items-center justify-center text-white text-sm font-bold">
                    {user?.first_name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#4ADE80] rounded-full border-2 border-[#07111D]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{user?.first_name || 'Загрузка...'}</p>
                <p className="text-[11px] text-emerald-300 truncate leading-tight">Онлайн</p>
              </div>
              <Settings
                size={16}
                className={clsx(
                  'transition-colors shrink-0',
                  showProfile
                    ? 'text-emerald-300'
                    : 'text-slate-600 group-hover:text-slate-300'
                )}
              />
            </div>
            <NotificationsHoverCard
              side="right"
              align="end"
              triggerClassName={clsx(
                "shrink-0 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]",
                collapsed ? "h-11 w-full" : "h-auto w-12"
              )}
            />
          </div>

          <button
            onClick={logout}
            title="Выйти"
            className={clsx(
              "flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300",
              collapsed ? "justify-center px-0" : "px-4"
            )}
          >
            <LogOut size={18} />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}
