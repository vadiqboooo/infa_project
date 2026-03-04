import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, ClipboardList, FileText, GraduationCap, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavigationSidebar() {
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);

  const links = [
    { icon: Home, label: 'Главная', path: '/dashboard' },
    { icon: BookOpen, label: 'Разбор', path: '/' },
    { icon: FileText, label: 'Варианты', path: '/exams' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/') return location.pathname === '/' || location.pathname.startsWith('/task');
    if (path === '/exams') return location.pathname.startsWith('/exams');
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-screen w-60 bg-white border-r border-gray-200 shrink-0">
      {/* Logo / Brand */}
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-[#3F8C62] rounded-xl flex items-center justify-center text-white">
          <GraduationCap size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900 leading-tight">Информатика</span>
          <span className="text-[11px] text-gray-400 leading-tight">Подготовка к ЕГЭ</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2">
        {links.map((link) => {
          const active = isActive(link.path);
          return (
            <Link
              key={link.label}
              to={link.path}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-[#3F8C62] text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <link.icon size={18} />
              <span>{link.label}</span>
            </Link>
          );
        })}

        {/* Admin link */}
        <div className="h-px bg-gray-100 my-2 mx-2" />
        <Link
          to="/admin"
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors',
            isActive('/admin')
              ? 'bg-[#3F8C62] text-white font-medium'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <ShieldCheck size={18} />
          <span>Админ-панель</span>
        </Link>
      </nav>

      {/* User card */}
      <div className="p-3">
        <div
          onClick={() => setShowProfile(!showProfile)}
          className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors cursor-pointer group',
            showProfile
              ? 'bg-[#3F8C62]/10 ring-1 ring-[#3F8C62]/20'
              : 'bg-gray-50 hover:bg-gray-100'
          )}
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3F8C62] to-[#2D6B4A] flex items-center justify-center text-white text-sm font-bold">
              С
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#4ADE80] rounded-full border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate leading-tight">Студент</p>
            <p className="text-[11px] text-[#3F8C62] truncate leading-tight">Онлайн</p>
          </div>
          <Settings
            size={16}
            className={cn(
              'transition-colors shrink-0',
              showProfile
                ? 'text-[#3F8C62]'
                : 'text-gray-300 group-hover:text-gray-500'
            )}
          />
        </div>
      </div>
    </div>
  );
}
