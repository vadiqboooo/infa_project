import React, { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp, ExternalLink, Shield, User as UserIcon,
  Plus, Pencil, Trash2, X, Check, Users, Printer, KeyRound, RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { StudentOut, GroupOut, PasswordStudentCredential } from '../../api/types';

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

  // Create student state
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newLoginInput, setNewLoginInput] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [lastCreated, setLastCreated] = useState<PasswordStudentCredential | null>(null);

  // Credentials print state
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<PasswordStudentCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);

  // Set credentials for existing student
  const [setCredsFor, setSetCredsFor] = useState<{ id: number; name: string; login: string | null } | null>(null);
  const [setCredsLogin, setSetCredsLogin] = useState('');
  const [setCredsPassword, setSetCredsPassword] = useState('');
  const [setCredsResult, setSetCredsResult] = useState<PasswordStudentCredential | null>(null);
  const [settingCreds, setSettingCreds] = useState(false);
  const [setCredsError, setSetCredsError] = useState('');

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

  const handleCreateStudent = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    setCreatingStudent(true);
    try {
      const body: Record<string, string> = {
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
      };
      if (newLoginInput.trim()) body.login = newLoginInput.trim();
      const res = await fetch(`${API_BASE}/admin/students`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Ошибка' }));
        alert(err.detail || 'Ошибка создания');
        return;
      }
      const created: PasswordStudentCredential = await res.json();
      setLastCreated(created);
      setNewFirstName('');
      setNewLastName('');
      setNewLoginInput('');
      onRefresh?.();
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleLoadCredentials = async () => {
    setLoadingCredentials(true);
    try {
      const res = await fetch(`${API_BASE}/admin/students/credentials`, {
        headers: authHeaders(apiKey),
      });
      const data: PasswordStudentCredential[] = await res.json();
      setCredentials(data);
      setShowCredentials(true);
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleResetPassword = async (studentId: number, customPassword?: string) => {
    setResettingId(studentId);
    try {
      const res = await fetch(`${API_BASE}/admin/students/${studentId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: customPassword ? JSON.stringify({ password: customPassword }) : undefined,
      });
      if (!res.ok) return;
      const updated: PasswordStudentCredential = await res.json();
      setCredentials((prev) => prev.map((c) => c.id === studentId ? updated : c));
      setResetModal(null);
      setResetPassword('');
    } finally {
      setResettingId(null);
    }
  };

  const handleSetCredentials = async () => {
    if (!setCredsFor || !setCredsLogin.trim()) return;
    setSettingCreds(true);
    setSetCredsError('');
    try {
      // If student already has a login — use reset-password with optional custom password
      if (setCredsFor.login) {
        const res = await fetch(`${API_BASE}/admin/students/${setCredsFor.id}/reset-password`, {
          method: 'POST',
          headers: authHeaders(apiKey),
          body: JSON.stringify({ password: setCredsPassword.trim() || undefined }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Ошибка' }));
          setSetCredsError(err.detail || 'Ошибка');
          return;
        }
        const result: PasswordStudentCredential = await res.json();
        setSetCredsResult(result);
        setCredentials((prev) => prev.map((c) => c.id === result.id ? result : c));
      } else {
        // New credentials — set login + auto-generate password
        const res = await fetch(`${API_BASE}/admin/students/${setCredsFor.id}/credentials`, {
          method: 'PUT',
          headers: authHeaders(apiKey),
          body: JSON.stringify({ login: setCredsLogin.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Ошибка' }));
          setSetCredsError(err.detail || 'Ошибка');
          return;
        }
        const result: PasswordStudentCredential = await res.json();
        setSetCredsResult(result);
      }
    } finally {
      setSettingCreds(false);
    }
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-1">{sorted.length} учеников</span>
          <button
            onClick={handleLoadCredentials}
            disabled={loadingCredentials}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all disabled:opacity-50"
          >
            <Printer size={14} />
            Данные для входа
          </button>
          <button
            onClick={() => setShowCreateStudent(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl transition-all shadow-sm"
          >
            <Plus size={14} />
            Добавить ученика
          </button>
        </div>
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
                          onClick={() => {
                            setSetCredsFor({ id: student.id, name: student.name, login: student.login });
                            setSetCredsLogin(student.login || '');
                            setSetCredsPassword('');
                            setSetCredsResult(null);
                            setSetCredsError('');
                          }}
                          title="Логин / пароль"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition-all"
                        >
                          <KeyRound size={15} />
                        </button>
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

      {/* ── Set Credentials Modal ────────────────────────────────── */}
      {setCredsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Логин и пароль</h2>
                <p className="text-xs text-gray-400 mt-0.5">{setCredsFor.name}</p>
              </div>
              <button
                onClick={() => { setSetCredsFor(null); setSetCredsResult(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {setCredsResult ? (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-800 mb-2">Данные для входа установлены!</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Логин</span>
                    <span className="text-sm font-mono font-bold text-[#3F8C62]">{setCredsResult.login}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Пароль</span>
                    <span className="text-sm font-mono font-bold text-[#3F8C62]">{setCredsResult.plain_password}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setSetCredsFor(null); setSetCredsResult(null); }}
                  className="w-full py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all"
                >
                  Готово
                </button>
              </div>
            ) : setCredsFor.login ? (
              /* Student already has login — change password */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Логин</label>
                  <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-mono">{setCredsFor.login}</div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Новый пароль</label>
                  <input
                    value={setCredsPassword}
                    onChange={(e) => setSetCredsPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSetCredentials(); }}
                    placeholder="Оставьте пустым для авто-генерации"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] transition-all"
                    autoFocus
                  />
                </div>
                {setCredsError && <p className="text-red-500 text-xs ml-1">{setCredsError}</p>}
                <button
                  onClick={handleSetCredentials}
                  disabled={settingCreds}
                  className="w-full py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settingCreds ? 'Сохранение...' : 'Сменить пароль'}
                </button>
              </div>
            ) : (
              /* New student — set login, auto-generate password */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Логин</label>
                  <input
                    value={setCredsLogin}
                    onChange={(e) => setSetCredsLogin(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSetCredentials(); }}
                    placeholder="ivanov_ivan"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] transition-all"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-400 mt-1 ml-1">Пароль будет сгенерирован автоматически</p>
                </div>
                {setCredsError && <p className="text-red-500 text-xs ml-1">{setCredsError}</p>}
                <button
                  onClick={handleSetCredentials}
                  disabled={settingCreds || !setCredsLogin.trim()}
                  className="w-full py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settingCreds ? 'Сохранение...' : 'Установить'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Student Modal ──────────────────────────────────── */}
      {showCreateStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Добавить ученика</h2>
              <button onClick={() => { setShowCreateStudent(false); setLastCreated(null); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {lastCreated ? (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-bold text-emerald-800 mb-3">Ученик создан успешно!</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Имя</span>
                      <span className="text-sm font-semibold text-gray-900">{lastCreated.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Логин</span>
                      <span className="text-sm font-mono font-bold text-[#3F8C62]">{lastCreated.login}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Пароль</span>
                      <span className="text-sm font-mono font-bold text-[#3F8C62]">{lastCreated.plain_password}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLastCreated(null)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Добавить ещё
                  </button>
                  <button
                    onClick={() => { setShowCreateStudent(false); setLastCreated(null); }}
                    className="flex-1 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all"
                  >
                    Готово
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Имя</label>
                  <input
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Иван"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Фамилия</label>
                  <input
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Иванов"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    Логин <span className="text-gray-300 font-normal normal-case">(необязательно — сгенерируется автоматически)</span>
                  </label>
                  <input
                    value={newLoginInput}
                    onChange={(e) => setNewLoginInput(e.target.value)}
                    placeholder="ivanov_i"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] transition-all"
                  />
                </div>
                <button
                  onClick={handleCreateStudent}
                  disabled={creatingStudent || !newFirstName.trim() || !newLastName.trim()}
                  className="w-full py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingStudent ? 'Создание...' : 'Создать ученика'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Print Credentials Modal ───────────────────────────────── */}
      {showCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Данные для входа учеников</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl transition-all"
                >
                  <Printer size={14} />
                  Печать
                </button>
                <button onClick={() => setShowCredentials(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {credentials.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <KeyRound size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="font-bold text-gray-900">Нет учеников с паролем</p>
                  <p className="text-sm">Добавьте учеников через кнопку "Добавить ученика"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {credentials.map((cred) => {
                    const group = groups.find(g => cred.group_ids.includes(g.id));
                    return (
                      <div key={cred.id} className="border border-gray-200 rounded-xl p-4 relative group/cred">
                        {group && (
                          <span
                            className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                            style={{ backgroundColor: group.color }}
                          >
                            {group.name}
                          </span>
                        )}
                        <p className="text-sm font-bold text-gray-900 mb-2 pr-16">{cred.name}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-12">Логин</span>
                            <span className="text-xs font-mono font-semibold text-gray-700">{cred.login}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-12">Пароль</span>
                            <span className="text-xs font-mono font-semibold text-[#3F8C62]">{cred.plain_password}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSetCredsFor({ id: cred.id, name: cred.name, login: cred.login });
                            setSetCredsLogin(cred.login);
                            setSetCredsPassword('');
                            setSetCredsResult(null);
                            setSetCredsError('');
                          }}
                          title="Сменить пароль"
                          className="absolute bottom-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-orange-500 hover:bg-orange-50 opacity-0 group-hover/cred:opacity-100 transition-all print:hidden"
                        >
                          <RefreshCw size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
