import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, ClipboardList, FileText, User, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { ProfileModal } from './ProfileModal';
import { useAuth } from '../context/AuthContext';

const links = [
    { icon: Home, label: 'Главная', path: '/dashboard' },
    { icon: BookOpen, label: 'Задания', path: '/tasks' },
    { icon: FileText, label: 'Варианты', path: '/exams' },
];

export function BottomNav() {
    const location = useLocation();
    const { user } = useAuth();
    const [showProfile, setShowProfile] = useState(false);
    const isAdmin = user?.role === 'admin';

    const isActive = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
        if (path === '/tasks') return location.pathname === '/tasks'
            || location.pathname.startsWith('/tasks/')
            || location.pathname.startsWith('/homework/');
        return location.pathname.startsWith(path);
    };

    const navLinks = isAdmin
        ? [...links, { icon: ShieldCheck, label: 'Админ', path: '/admin' }]
        : links;

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 md:hidden">
                <div className="flex items-stretch h-16">
                    {navLinks.map((link) => {
                        const active = isActive(link.path);
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={clsx(
                                    'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                                    active ? 'text-[#3F8C62]' : 'text-gray-400'
                                )}
                            >
                                <link.icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                                <span>{link.label}</span>
                                {active && (
                                    <span className="absolute bottom-0 w-6 h-0.5 bg-[#3F8C62] rounded-full" />
                                )}
                            </Link>
                        );
                    })}

                    {/* Profile button */}
                    <button
                        onClick={() => setShowProfile(true)}
                        className={clsx(
                            'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                            showProfile ? 'text-[#3F8C62]' : 'text-gray-400'
                        )}
                    >
                        {user?.photo_url ? (
                            <img src={user.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                            <User size={22} strokeWidth={1.8} />
                        )}
                        <span>Профиль</span>
                    </button>
                </div>
            </nav>

            {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
        </>
    );
}