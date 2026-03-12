import React, { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp, ExternalLink, Shield, User as UserIcon,
  Plus, Pencil, Trash2, X, Check, Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { StudentOut, GroupOut } from '../../api/types';

interface StudentsTableProps {
  students: StudentOut[];
  groups: GroupOut[];
  apiKey?: string;
  onRefresh?: () => void;
  onViewStudent?: (id: number) => void;
}

const API_BASE = "/api";

function authHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('jwt_token');
  if (apiKey) headers['X-API-Key'] = apiKey;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function StudentsTable({ students, groups, apiKey, onRefresh, onViewStudent }: StudentsTableProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'name'>('progress');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState<number | null>(null);

  // Group management state
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3F8C62');
  const [editingGroup, setEditingGroup] = useState<GroupOut | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupColor, setEditGroupColor] = useState('');
  const [openAssignFor, setOpenAssignFor] = useState<number | null>(null);

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.username && s.username.toLowerCase().includes(search.toLowerCase()));
    const matchesGroup = groupFilter === null || (s.group_ids ?? []).includes(groupFilter);
    return matchesSearch && matchesGroup;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'progress') {
      const aPct = a.total_tasks === 0 ? 0 : a.total_solved / a.total_tasks;
      const bPct = b.total_tasks === 0 ? 0 : b.total_solved / b.total_tasks;
      return bPct - aPct;
    }
    return a.name.localeCompare(b.name);
  });

  const getProgressPercent = (solved: number, total: number) =>
    total === 0 ? 0 : Math.round((solved / total) * 100);

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
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
        headers: authHeaders(apiKey),
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      onRefresh?.();
    } catch {
      alert('Ошибка при смене роли');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Group CRUD ──────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await fetch(`${API_BASE}/admin/groups`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }),
    });
    setNewGroupName('');
    onRefresh?.();
  };

  const handleUpdateGroup = async (g: GroupOut) => {
    await fetch(`${API_BASE}/admin/groups/${g.id}`, {
      method: 'PUT',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ name: editGroupName.trim(), color: editGroupColor }),
    });
    setEditingGroup(null);
    onRefresh?.();
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('Удалить группу?')) return;
    await fetch(`${API_BASE}/admin/groups/${id}`, {
      method: 'DELETE',
      headers: authHeaders(apiKey),
    });
    if (groupFilter === id) setGroupFilter(null);
    onRefresh?.();
  };

  const toggleStudentGroup = async (studentId: number, groupId: number, inGroup: boolean) => {
    const method = inGroup ? 'DELETE' : 'POST';
    await fetch(`${API_BASE}/admin/groups/${groupId}/students/${studentId}`, {
      method,
      headers: authHeaders(apiKey),
    });
    onRefresh?.();
  };

  const GROUP_COLORS = ['#3F8C62', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="space-y-4">
      {/* ── Groups Panel ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowGroupPanel(!showGroupPanel)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3F8C62]/10 flex items-center justify-center">
              <Users size={16} className="text-[#3F8C62]" />
            </div>
            <div className="text-left">
              <span className="text-sm font-bold text-gray-900">Группы</span>
              <span className="text-xs text-gray-400 ml-2">{groups.length} групп</span>
            </div>
          </div>
          {showGroupPanel ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showGroupPanel && (
          <div className="px-6 pb-5 border-t border-gray-100">
            {/* Existing groups */}
            <div className="flex flex-wrap gap-2 mt-4 mb-4">
              {groups.map((g) =>
                editingGroup?.id === g.id ? (
                  <div key={g.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <div className="flex gap-1">
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditGroupColor(c)}
                          className={clsx('w-4 h-4 rounded-full border-2 transition-all', editGroupColor === c ? 'border-gray-600 scale-110' : 'border-transparent')}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateGroup(g); if (e.key === 'Escape') setEditingGroup(null); }}
                      className="text-xs font-bold px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3F8C62] w-28"
                      autoFocus
                    />
                    <button onClick={() => handleUpdateGroup(g)} className="text-[#3F8C62] hover:text-[#357A54]"><Check size={14} /></button>
                    <button onClick={() => setEditingGroup(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                ) : (
                  <div key={g.id} className="flex items-center gap-1 group/grp">
                    <span
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold cursor-pointer select-none"
                      style={{ backgroundColor: g.color }}
                      onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
                      title={groupFilter === g.id ? 'Снять фильтр' : `Фильтр: ${g.name}`}
                    >
                      {g.name}
                      <span className="opacity-70 text-[10px]">{g.student_count}</span>
                      {groupFilter === g.id && <X size={10} className="opacity-80" />}
                    </span>
                    <button
                      onClick={() => { setEditingGroup(g); setEditGroupName(g.name); setEditGroupColor(g.color); }}
                      className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover/grp:opacity-100 transition-all"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(g.id)}
                      className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/grp:opacity-100 transition-all"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              )}

              {groups.length === 0 && (
                <p className="text-xs text-gray-400 py-1">Нет групп. Создайте первую →</p>
              )}
            </div>

            {/* Create group form */}
            <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
              <div className="flex gap-1">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewGroupColor(c)}
                    className={clsx('w-5 h-5 rounded-full border-2 transition-all', newGroupColor === c ? 'border-gray-600 scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                placeholder="Название группы..."
                className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#3F8C62] transition-all max-w-xs"
              />
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#3F8C62] hover:bg-[#357A54] text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors"
              >
                <Plus size={12} />
                Создать
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
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
          {groupFilter !== null && (
            <button
              onClick={() => setGroupFilter(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-white"
              style={{ backgroundColor: groups.find(g => g.id === groupFilter)?.color ?? '#888' }}
            >
              {groups.find(g => g.id === groupFilter)?.name}
              <X size={11} />
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">{sorted.length} учеников</div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
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
              const studentGroupIds = student.group_ids ?? [];
              const isAssignOpen = openAssignFor === student.id;

              return (
                <React.Fragment key={student.id}>
                  <tr className={clsx('group transition-colors hover:bg-gray-50/50', isExpanded && 'bg-emerald-50/30')}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold uppercase">
                              {student.name.charAt(0)}
                            </div>
                          )}
                          <div className={clsx(
                            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                            Date.now() - new Date(student.last_active_at).getTime() < 300000 ? 'bg-emerald-500' : 'bg-gray-300'
                          )} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-gray-900 truncate group-hover:text-[#3F8C62] transition-colors">{student.name}</span>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[11px] text-gray-400">@{student.username || 'id' + student.id}</span>
                            {/* Group badges */}
                            {studentGroupIds.map((gid) => {
                              const g = groups.find(x => x.id === gid);
                              if (!g) return null;
                              return (
                                <span
                                  key={gid}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white leading-none"
                                  style={{ backgroundColor: g.color }}
                                >
                                  {g.name}
                                </span>
                              );
                            })}
                            {/* Assign group button */}
                            {groups.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={() => setOpenAssignFor(isAssignOpen ? null : student.id)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-[#3F8C62] hover:text-[#3F8C62] transition-colors leading-none"
                                  title="Управление группами"
                                >
                                  + группа
                                </button>
                                {isAssignOpen && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenAssignFor(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-xl p-2 min-w-[160px]">
                                      <p className="text-[10px] font-black text-gray-400 uppercase px-2 pb-1.5">Группы</p>
                                      {groups.map((g) => {
                                        const inGroup = studentGroupIds.includes(g.id);
                                        return (
                                          <button
                                            key={g.id}
                                            onClick={() => toggleStudentGroup(student.id, g.id, inGroup)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                                          >
                                            <div className={clsx('w-4 h-4 rounded flex items-center justify-center border-2 transition-all')}
                                              style={{ backgroundColor: inGroup ? g.color : 'transparent', borderColor: g.color }}>
                                              {inGroup && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700">{g.name}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
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
                            'text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border-none outline-none cursor-pointer transition-all appearance-none pr-7 w-full',
                            student.role === 'admin' ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                            updatingId === student.id && 'opacity-50 animate-pulse'
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
                          <div className="h-full bg-[#3F8C62] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
                          className={clsx('p-1.5 rounded-lg transition-all', isExpanded ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100')}
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
