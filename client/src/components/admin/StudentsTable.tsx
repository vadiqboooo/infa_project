import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, ExternalLink, Shield, User as UserIcon } from 'lucide-react';
import { clsx } from 'clsx';
import type { StudentOut } from '../../api/types';

interface StudentsTableProps {
  students: StudentOut[];
  apiKey?: string;
  onRefresh?: () => void;
  onViewStudent?: (id: number) => void;
}

const API_BASE = "/api";

export function StudentsTable({ students, apiKey, onRefresh, onViewStudent }: StudentsTableProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'name'>('progress');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.username && s.username.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'progress') {
        const aPct = a.total_tasks === 0 ? 0 : a.total_solved / a.total_tasks;
        const bPct = b.total_tasks === 0 ? 0 : b.total_solved / b.total_tasks;
        return bPct - aPct;
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const getProgressPercent = (solved: number, total: number) =>
    total === 0 ? 0 : Math.round((solved / total) * 100);

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    return date.toLocaleDateString();
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!apiKey) return;
    setUpdatingId(userId);
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({ role: newRole })
        });
        if (!res.ok) throw new Error('Failed to update role');
        if (onRefresh) onRefresh();
    } catch (err) {
        alert('Ошибка при смене роли');
    } finally {
        setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск учеников..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white"
            />
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([
                { key: 'progress', label: 'По прогрессу' },
                { key: 'name', label: 'По имени' },
            ] as const).map((opt) => (
                <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={clsx(
                    'px-3 py-1.5 rounded-md text-xs transition-colors',
                    sortBy === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
                >
                {opt.label}
                </button>
            ))}
            </div>
        </div>
        <div className="text-sm text-gray-500">{sorted.length} учеников</div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-gray-100">
              <th className="px-6 py-4">Ученик</th>
              <th className="px-6 py-4 w-32">Роль</th>
              <th className="px-6 py-4 w-40">Прогресс</th>
              <th className="px-6 py-4 w-40">Лучший вариант</th>
              <th className="px-6 py-4 w-36">Активность</th>
              <th className="px-6 py-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((student) => {
              const pct = getProgressPercent(student.total_solved, student.total_tasks);
              const isExpanded = expandedId === student.id;
              const bestExam = student.exam_scores.length
                ? student.exam_scores.reduce((best, e) => (e.score > best.score ? e : best), student.exam_scores[0])
                : null;

              return (
                <React.Fragment key={student.id}>
                  <tr className={clsx(
                    "group transition-colors hover:bg-gray-50/50",
                    isExpanded && "bg-emerald-50/30"
                  )}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold uppercase">
                              {student.name.charAt(0)}
                            </div>
                          )}
                          <div className={clsx(
                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                            new Date().getTime() - new Date(student.last_active_at).getTime() < 300000 ? "bg-emerald-500" : "bg-gray-300"
                          )} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-gray-900 truncate group-hover:text-[#3F8C62] transition-colors">{student.name}</span>
                          <span className="text-[11px] text-gray-400">@{student.username || 'id' + student.id}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                        <div className="relative">
                            <select 
                                value={student.role}
                                disabled={updatingId === student.id}
                                onChange={(e) => handleRoleChange(student.id, e.target.value)}
                                className={clsx(
                                    "text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border-none outline-none cursor-pointer transition-all appearance-none pr-7 w-full",
                                    student.role === 'admin' 
                                        ? "bg-violet-100 text-violet-700 hover:bg-violet-200" 
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                                    updatingId === student.id && "opacity-50 animate-pulse"
                                )}
                            >
                                <option value="student">Ученик</option>
                                <option value="admin">Админ</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-50">
                                {student.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                            </div>
                        </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-gray-400">{pct}%</span>
                          <span className="text-gray-900">{student.total_solved}/{student.total_tasks}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3F8C62] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {bestExam ? (
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-gray-900 truncate max-w-[140px]">{bestExam.variant_name}</span>
                          <span className="text-[10px] text-emerald-600 font-bold">{bestExam.score.toFixed(0)} из {bestExam.max_score}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-[11px] text-gray-500 font-medium">
                      {formatLastActive(student.last_active_at)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {onViewStudent && (
                          <button
                            onClick={() => onViewStudent(student.id)}
                            title="Подробнее"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-[#3F8C62]/10 hover:text-[#3F8C62] transition-all"
                          >
                            <ExternalLink size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : student.id)}
                          className={clsx(
                            "p-1.5 rounded-lg transition-all",
                            isExpanded ? "bg-emerald-100 text-emerald-700" : "text-gray-400 hover:bg-gray-100"
                          )}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {student.topic_progress.map((tp, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
                              <span className="text-xs font-semibold text-gray-700 truncate mr-2">{tp.topic_name}</span>
                              <span className="text-[10px] font-bold px-2 py-1 bg-gray-50 text-gray-500 rounded-md">
                                {tp.solved}/{tp.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-center py-20 text-gray-400 bg-white">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserIcon size={32} className="opacity-20" />
            </div>
            <p className="font-bold text-gray-900">Ученики не найдены</p>
            <p className="text-sm">Попробуйте изменить параметры поиска</p>
          </div>
        )}
      </div>
    </div>
  );
}
