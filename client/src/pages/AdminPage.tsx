import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
    Users,
    BookOpen,
    Search,
    Download,
    FileText,
    Plus,
    FolderOpen,
    Trash2,
    Settings,
    LogOut,
    ShieldAlert,
    CreditCard,
    Pencil,
    X,
    Check,
    ClipboardList,
} from "lucide-react";
import { clsx } from "clsx";
import { Routes, Route, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type {
    ImportVariantResult,
    TaskAdmin,
    TopicAdmin,
    TopicIn,
    TopicCategory,
    StudentOut,
    StudentDetailOut,
    TopicStatsOut,
    GroupOut,
    PreparationPlan,
    PreparationPlanBlock,
} from "../api/types";
import { TopicDetail } from "../components/admin/TopicDetail";
import { StudentsTable } from "../components/admin/StudentsTable";
import { StudentDetail } from "../components/admin/StudentDetail";
import { TopicStats } from "../components/admin/TopicStats";
import { ImportTopicModal } from "../components/admin/ImportTopicModal";
import AdminImportPdfPage from "./AdminImportPdfPage";
import { useAuth } from "../context/AuthContext";
import "./AdminPage.css";

import { handleSessionExpired } from "../api/client";

const API_BASE = "/api";
const ADMIN_DASHBOARD_STATE_KEY = "admin_dashboard_state";

type AdminDashboardState = {
    activeTab?: 'topics' | 'students' | 'subscriptions' | 'plans';
    search?: string;
    filter?: FilterCategory;
    topicsScrollTop?: number;
    studentsScrollTop?: number;
};

function readAdminDashboardState(): AdminDashboardState {
    try {
        return JSON.parse(sessionStorage.getItem(ADMIN_DASHBOARD_STATE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveAdminDashboardState(patch: AdminDashboardState) {
    const next = { ...readAdminDashboardState(), ...patch };
    sessionStorage.setItem(ADMIN_DASHBOARD_STATE_KEY, JSON.stringify(next));
}

function adminFetch<T>(path: string, apiKey?: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem("jwt_token");
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {}),
    };

    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    }).then(async (res) => {
        if (res.status === 401 && token) {
            handleSessionExpired();
            throw new Error("Сессия истекла. Войдите снова.");
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Ошибка запроса");
        }
        if (res.status === 204) return undefined as T;
        return res.json();
    });
}

type FilterCategory = 'все' | 'learning' | 'tutorial' | 'homework' | 'control' | 'variants' | 'math' | 'mock';

const FILTER_OPTIONS: { key: FilterCategory; label: string }[] = [
    { key: 'все', label: 'Все' },
    { key: 'learning', label: 'Разбор + ДЗ' },
    { key: 'control', label: 'Контрольная' },
    { key: 'variants', label: 'Вариант' },
    { key: 'math', label: 'Математика' },
    { key: 'mock', label: 'Пробник' },
];

function normalizeTopicFilter(filter?: FilterCategory): FilterCategory {
    return filter === 'tutorial' || filter === 'homework' ? 'learning' : (filter ?? 'все');
}

function topicEgeLabel(topic: Pick<TopicAdmin, "ege_number" | "ege_number_end">) {
    if (topic.ege_number == null) return "—";
    if (topic.ege_number_end != null && topic.ege_number_end > topic.ege_number) {
        return `${topic.ege_number}-${topic.ege_number_end}`;
    }
    return String(topic.ege_number);
}

export default function AdminPage() {
    const { user, loggedIn } = useAuth();
    const [apiKey, setApiKey] = useState(() => localStorage.getItem("admin_api_key") ?? "");
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [authed, setAuthed] = useState(false);
    const [authError, setAuthError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Try to auth with either user role or stored key on mount
    useEffect(() => {
        if (user && user.role === 'admin') {
            setAuthed(true);
            return;
        }

        if (apiKey) {
            adminFetch<TopicAdmin[]>("/admin/topics", apiKey)
                .then(() => { setAuthed(true); })
                .catch(() => { 
                    localStorage.removeItem("admin_api_key"); 
                    setApiKey(""); 
                });
        }
    }, [apiKey, user]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setAuthError("");
        try {
            await adminFetch("/admin/topics", apiKeyInput);
            localStorage.setItem("admin_api_key", apiKeyInput);
            setApiKey(apiKeyInput);
            setAuthed(true);
        } catch {
            setAuthError("Неверный API ключ или нет прав доступа");
        } finally {
            setLoading(false);
        }
    }

    if (user && user.role !== 'admin' && !apiKey) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F7F4] p-6 text-center">
                <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert size={40} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Доступ ограничен</h1>
                <p className="text-gray-500 mb-8 max-w-sm">
                    У вас нет прав администратора для доступа к этой панели. 
                    Если это ошибка, обратитесь к разработчику.
                </p>
                <button 
                    onClick={() => navigate('/')}
                    className="px-8 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                >
                    Вернуться на главную
                </button>
            </div>
        );
    }

    if (!authed) {
        return (
            <div className="admin-auth-screen flex items-center justify-center min-h-screen bg-[#F8F7F4]">
                <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 w-full max-w-md">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-[#3F8C62]/10 rounded-2xl flex items-center justify-center mb-4">
                            <Settings size={32} className="text-[#3F8C62]" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 text-center">Админ-панель</h1>
                        <p className="text-gray-500 text-sm mt-1">Авторизуйтесь для управления контентом</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">API Ключ</label>
                            <input
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                                type="password"
                                placeholder="Введите ключ доступа"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                autoFocus
                            />
                        </div>
                        {authError && <span className="text-red-500 text-xs block ml-1">{authError}</span>}
                        <button 
                            className="w-full bg-[#3F8C62] hover:bg-[#357A54] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#3F8C62]/20 disabled:opacity-50" 
                            type="submit" 
                            disabled={loading}
                        >
                            {loading ? "Проверка..." : "Войти"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-[#F8F7F4]">
            <Routes>
                <Route index element={<AdminDashboard apiKey={apiKey} />} />
                <Route path="topics/:id/stats" element={<AdminTopicStatsPage apiKey={apiKey} />} />
                <Route path="topics/:id" element={<AdminTopicEdit apiKey={apiKey} />} />
                <Route path="students/:id" element={<AdminStudentDetailPage apiKey={apiKey} />} />
                <Route path="import-pdf" element={<AdminImportPdfPage apiKey={apiKey} />} />
            </Routes>
        </div>
    );
}

function AdminDashboard({ apiKey }: { apiKey: string }) {
    const savedState = readAdminDashboardState();
    const [activeTab, setActiveTab] = useState<'topics' | 'students' | 'subscriptions' | 'plans'>(savedState.activeTab ?? 'topics');
    const [topics, setTopics] = useState<TopicAdmin[]>([]);
    const [students, setStudents] = useState<StudentOut[]>([]);
    const [groups, setGroups] = useState<GroupOut[]>([]);
    const [plans, setPlans] = useState<PreparationPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(savedState.search ?? "");
    const [filter, setFilter] = useState<FilterCategory>(normalizeTopicFilter(savedState.filter));
    const [showImport, setShowImport] = useState(false);
    const topicsScrollRef = useRef<HTMLDivElement | null>(null);
    const studentsScrollRef = useRef<HTMLDivElement | null>(null);

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [t, s, g, p] = await Promise.all([
                adminFetch<TopicAdmin[]>("/admin/topics", apiKey),
                adminFetch<StudentOut[]>("/admin/students", apiKey),
                adminFetch<GroupOut[]>("/admin/groups", apiKey),
                adminFetch<PreparationPlan[]>("/admin/preparation-plans", apiKey),
            ]);
            setTopics(t);
            setStudents(s);
            setGroups(g);
            setPlans(p);
        } finally {
            setLoading(false);
        }
    }, [apiKey]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        saveAdminDashboardState({ activeTab, search, filter });
    }, [activeTab, search, filter]);

    const filteredTopics = useMemo(() => {
        const query = search.trim().toLowerCase();
        return topics.filter(t => {
            const matchesFilter =
                filter === 'все'
                || (filter === 'learning' && (t.category === 'tutorial' || t.category === 'homework'))
                || t.category === filter;
            const egeLabel = topicEgeLabel(t).toLowerCase();
            const matchesSearch =
                query === ''
                || t.title.toLowerCase().includes(query)
                || egeLabel.includes(query)
                || (t.ege_number != null && String(t.ege_number).includes(query))
                || (t.ege_number_end != null && String(t.ege_number_end).includes(query));
            return matchesFilter && matchesSearch;
        });
    }, [topics, filter, search]);

    useEffect(() => {
        if (loading) return;
        const state = readAdminDashboardState();
        if (activeTab === 'subscriptions' || activeTab === 'plans') return;
        const scrollTop = activeTab === 'students' ? state.studentsScrollTop : state.topicsScrollTop;
        requestAnimationFrame(() => {
            const target = activeTab === 'students' ? studentsScrollRef.current : topicsScrollRef.current;
            if (target && scrollTop != null) target.scrollTop = scrollTop;
        });
    }, [activeTab, loading, students.length, filteredTopics.length]);

    const handleCreateTopic = async () => {
        const title = prompt("Введите название новой темы");
        if (!title) return;
        const body: TopicIn = { 
            title, 
            order_index: topics.length, 
            category: 'tutorial' as TopicCategory,
            time_limit_minutes: 60,
            is_mock: false
        };
        await adminFetch("/admin/topics", apiKey, { 
            method: "POST", 
            body: JSON.stringify(body) 
        });
        queryClient.invalidateQueries({ queryKey: ["navigation"] });
        await loadData();
    };

    const handleDeleteTopic = async (id: number) => {
        if (!confirm("Удалить топик? Это удалит все задачи внутри.")) return;
        await adminFetch(`/admin/topics/${id}`, apiKey, { method: "DELETE" });
        queryClient.invalidateQueries({ queryKey: ["navigation"] });
        await loadData();
    };

    const handleImportVariant = async (
        topic_title: string,
        variant_id: number,
        options: { category: 'tutorial' | 'homework' | 'control' | 'variants' | 'math' | 'mock'; ege_number: number | null; ege_number_end: number | null }
    ) => {
        try {
            const data = await adminFetch<{
                tasks: any[];
                topic_title: string;
            }>("/admin/import-variant/preview", apiKey, {
                method: "POST",
                body: JSON.stringify({ variant_id, topic_title }),
            });
            setShowImport(false);
            // Navigate to the import editor pre-populated with kompege data
            navigate('import-pdf', {
                state: {
                    source: 'kompege',
                    tasks: data.tasks,
                    topic_title: data.topic_title,
                    category: options.category,
                    is_mock: options.category === 'mock',
                    time_limit_minutes: 235,
                    ege_number: options.ege_number,
                    ege_number_end: options.ege_number_end,
                },
            });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const categoryLabel = (cat: string) => {
        if (cat === 'tutorial') return 'Разбор';
        if (cat === 'homework') return 'ДЗ';
        if (cat === 'control') return 'КР';
        if (cat === 'math') return 'Математика';
        if (cat === 'mock') return 'Пробник';
        return 'Вариант';
    };

    const categoryColor = (cat: string) => {
        if (cat === 'tutorial') return 'bg-blue-100 text-blue-700';
        if (cat === 'homework') return 'bg-violet-100 text-violet-700';
        if (cat === 'control') return 'bg-sky-100 text-sky-700';
        if (cat === 'math') return 'bg-emerald-100 text-emerald-700';
        if (cat === 'mock') return 'bg-purple-100 text-purple-700';
        return 'bg-orange-100 text-orange-700';
    };

    return (
        <div className="p-8 flex flex-col h-full min-h-0">
            <div className="hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Админ-панель</h1>
                    <p className="text-sm text-gray-500">Управление контентом и учениками</p>
                </div>
                <button 
                    onClick={() => { localStorage.removeItem("admin_api_key"); window.location.reload(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors"
                >
                    <LogOut size={16} />
                    Выйти
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-8 bg-gray-200/50 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setActiveTab('topics')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all',
                        activeTab === 'topics' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                >
                    <BookOpen size={16} />
                    Топики
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all',
                        activeTab === 'students' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                >
                    <Users size={16} />
                    Ученики
                </button>
                <button
                    onClick={() => setActiveTab('subscriptions')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all',
                        activeTab === 'subscriptions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                >
                    <CreditCard size={16} />
                    Подписка
                </button>
                <button
                    onClick={() => setActiveTab('plans')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all',
                        activeTab === 'plans' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                >
                    <ClipboardList size={16} />
                    Планы
                </button>
            </div>

            {activeTab === "topics" ? (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Filters Row */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Поиск по топику или № задания..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 focus:border-[#3F8C62] bg-white transition-all shadow-sm"
                            />
                        </div>

                        <div className="flex bg-gray-200/50 rounded-xl p-1">
                            {FILTER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => setFilter(opt.key)}
                                    className={clsx(
                                        'px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                                        filter === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <button
                                onClick={() => setShowImport(true)}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all"
                            >
                                <Download size={16} />
                                Kompege
                            </button>
                            <button
                                onClick={() => navigate('import-pdf')}
                                className="flex items-center gap-2 px-4 py-2.5 border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-sm font-bold transition-all"
                            >
                                <FileText size={16} />
                                PDF
                            </button>
                            <button
                                onClick={handleCreateTopic}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#3F8C62]/20"
                            >
                                <Plus size={16} />
                                Новый топик
                            </button>
                        </div>
                    </div>

                    {/* Topics Table */}
                    <div
                        ref={topicsScrollRef}
                        onScroll={(e) => saveAdminDashboardState({ topicsScrollTop: e.currentTarget.scrollTop })}
                        className="flex-1 overflow-y-auto"
                    >
                        <div className="rounded-2xl bg-gradient-to-br from-violet-100 via-sky-100 to-emerald-50 p-3 shadow-sm">
                            <div className="hidden lg:grid grid-cols-[120px_minmax(280px,1.5fr)_minmax(140px,0.8fr)_110px_120px] gap-4 px-4 pb-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                <span className="text-center">№ задания</span>
                                <span>Топик</span>
                                <span>Категория</span>
                                <span className="text-center">Задач</span>
                                <span className="text-right">Управление</span>
                            </div>

                            <div className="space-y-2">
                                {loading ? (
                                    [1, 2, 3].map((i) => (
                                        <div key={i} className="h-[76px] rounded-xl bg-white/70 border border-white/80 animate-pulse" />
                                    ))
                                ) : filteredTopics.map((topic) => (
                                    <div
                                        key={topic.id}
                                        onClick={() => navigate(`topics/${topic.id}`)}
                                        className="grid grid-cols-1 lg:grid-cols-[120px_minmax(280px,1.5fr)_minmax(140px,0.8fr)_110px_120px] gap-4 items-center rounded-xl bg-white/90 border border-white/80 px-4 py-3 shadow-sm cursor-pointer hover:bg-white transition-colors group"
                                    >
                                        <div className="lg:text-center">
                                            <span className={clsx(
                                                "inline-flex min-w-12 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-black",
                                                topic.ege_number == null
                                                    ? "bg-gray-100 text-gray-400"
                                                    : "bg-[#3F8C62]/10 text-[#3F8C62]"
                                            )}>
                                                {topicEgeLabel(topic)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center shrink-0">
                                                <FolderOpen size={19} className="text-[#3F8C62]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-gray-900 truncate group-hover:text-[#3F8C62] transition-colors">{topic.title}</div>
                                                <div className="mt-1 text-[11px] text-gray-500">ЕГЭ {topicEgeLabel(topic)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide', categoryColor(topic.category))}>
                                                {categoryLabel(topic.category)}
                                            </span>
                                            {topic.is_mock && (
                                                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                                                    Пробник
                                                </span>
                                            )}
                                        </div>

                                        <div className="lg:text-center">
                                            <span className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-700">
                                                {topic.task_count}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-start lg:justify-end gap-1.5">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`topics/${topic.id}/stats`);
                                                }}
                                                title="Статистика"
                                                className="p-2 rounded-lg text-gray-500 hover:text-[#3F8C62] hover:bg-emerald-50 transition-all"
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTopic(topic.id);
                                                }}
                                                title="Удалить"
                                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!loading && filteredTopics.length === 0 && (
                                <div className="text-center py-20 text-gray-400 bg-white/80 rounded-xl">
                                    <FolderOpen size={42} className="mx-auto mb-3 opacity-25" />
                                    <p className="text-sm font-bold text-gray-900">Топики не найдены</p>
                                    <p className="text-sm">Попробуйте изменить параметры фильтрации</p>
                                </div>
                            )}
                        </div>

                        <div className="hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-gray-100">
                                        <th className="px-6 py-4 w-28 text-center">№ задания</th>
                                        <th className="px-6 py-4">Топик</th>
                                        <th className="px-6 py-4 w-40">Категория</th>
                                        <th className="px-6 py-4 w-28 text-center">Задач</th>
                                        <th className="px-6 py-4 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        [1,2,3].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={5} className="px-6 py-4 h-16 bg-white" />
                                            </tr>
                                        ))
                                    ) : filteredTopics.map((topic) => (
                                        <tr
                                            key={topic.id}
                                            onClick={() => navigate(`topics/${topic.id}`)}
                                            className="hover:bg-gray-50/80 transition-all cursor-pointer group"
                                        >
                                            <td className="px-6 py-4 text-center">
                                                <span className={clsx(
                                                    "inline-flex min-w-9 items-center justify-center rounded-xl px-2.5 py-1 text-xs font-black",
                                                    topic.ege_number == null
                                                        ? "bg-gray-100 text-gray-400"
                                                        : "bg-[#3F8C62]/10 text-[#3F8C62]"
                                                )}>
                                                    {topicEgeLabel(topic)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center shrink-0">
                                                        <FolderOpen size={18} className="text-[#3F8C62]" />
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-900 group-hover:text-[#3F8C62] transition-colors">{topic.title}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide', categoryColor(topic.category))}>
                                                        {categoryLabel(topic.category)}
                                                    </span>
                                                    {topic.is_mock && (
                                                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                                                            Пробник
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-xs font-bold text-gray-500">{topic.task_count}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`topics/${topic.id}/stats`);
                                                        }}
                                                        title="Статистика"
                                                        className="p-2 rounded-lg text-gray-300 hover:text-[#3F8C62] hover:bg-emerald-50 transition-all"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTopic(topic.id);
                                                        }}
                                                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {!loading && false && filteredTopics.length === 0 && (
                                <div className="text-center py-24 text-gray-400">
                                    <FolderOpen size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-bold text-gray-900">Топики не найдены</p>
                                    <p className="text-sm">Попробуйте изменить параметры фильтрации</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : activeTab === "students" ? (
                <div
                    ref={studentsScrollRef}
                    onScroll={(e) => saveAdminDashboardState({ studentsScrollTop: e.currentTarget.scrollTop })}
                    className="flex-1 overflow-y-auto"
                >
                    <StudentsTable
                        students={students}
                        groups={groups}
                        apiKey={apiKey}
                        onRefresh={loadData}
                        onViewStudent={(id) => navigate(`students/${id}`)}
                    />
                </div>
            ) : activeTab === "subscriptions" ? (
                <SubscriptionsPanel groups={groups} apiKey={apiKey} onRefresh={loadData} />
            ) : (
                <PlansPanel plans={plans} topics={topics} apiKey={apiKey} onRefresh={loadData} />
            )}

            {showImport && (
                <ImportTopicModal
                    onClose={() => setShowImport(false)}
                    onImportVariant={handleImportVariant}
                />
            )}


        </div>
    );
}

const SUBSCRIPTION_COLORS = ['#3F8C62', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

function SubscriptionsPanel({
    groups,
    apiKey,
    onRefresh,
}: {
    groups: GroupOut[];
    apiKey: string;
    onRefresh: () => Promise<void>;
}) {
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#3F8C62');
    const [editingGroup, setEditingGroup] = useState<GroupOut | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            await adminFetch('/admin/groups', apiKey, {
                method: 'POST',
                body: JSON.stringify({ name: newName.trim(), color: newColor }),
            });
            setNewName('');
            await onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingGroup || !editName.trim()) return;
        setSaving(true);
        try {
            await adminFetch(`/admin/groups/${editingGroup.id}`, apiKey, {
                method: 'PUT',
                body: JSON.stringify({ name: editName.trim(), color: editColor }),
            });
            setEditingGroup(null);
            await onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (group: GroupOut) => {
        if (!confirm(`Удалить подписку «${group.name}»? Ученики останутся без этой подписки.`)) return;
        await adminFetch(`/admin/groups/${group.id}`, apiKey, { method: 'DELETE' });
        await onRefresh();
    };

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl space-y-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Подписка</h2>
                            <p className="text-sm text-gray-500 mt-1">Создание и настройка групп, в которых занимаются ученики.</p>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-[#3F8C62]/10 text-[#3F8C62] text-xs font-bold">
                            {groups.length} подписок
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-1">
                            {SUBSCRIPTION_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setNewColor(color)}
                                    className={clsx('w-6 h-6 rounded-full border-2 transition-all', newColor === color ? 'border-gray-700 scale-110' : 'border-white')}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                            placeholder="Название подписки..."
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3F8C62]/20 focus:border-[#3F8C62]"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={saving || !newName.trim()}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        >
                            <Plus size={16} />
                            Создать
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {groups.map((group) => {
                        const isEditing = editingGroup?.id === group.id;
                        return (
                            <div key={group.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-1">
                                            {SUBSCRIPTION_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setEditColor(color)}
                                                    className={clsx('w-5 h-5 rounded-full border-2 transition-all', editColor === color ? 'border-gray-700 scale-110' : 'border-white')}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdate();
                                                if (e.key === 'Escape') setEditingGroup(null);
                                            }}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#3F8C62]"
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingGroup(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                                                <X size={16} />
                                            </button>
                                            <button onClick={handleUpdate} disabled={saving || !editName.trim()} className="p-2 rounded-lg text-[#3F8C62] hover:bg-emerald-50 disabled:opacity-50">
                                                <Check size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                                                <h3 className="text-sm font-bold text-gray-900 truncate">{group.name}</h3>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{group.student_count} учеников</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingGroup(group);
                                                    setEditName(group.name);
                                                    setEditColor(group.color);
                                                }}
                                                className="p-2 rounded-lg text-gray-400 hover:bg-sky-50 hover:text-sky-600 transition-all"
                                                title="Редактировать"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(group)}
                                                className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                                title="Удалить"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {groups.length === 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400">
                        <CreditCard size={42} className="mx-auto mb-3 opacity-25" />
                        <p className="text-sm font-bold text-gray-900">Подписок пока нет</p>
                        <p className="text-sm">Создайте первую подписку выше.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const defaultPlanBlocks: PreparationPlanBlock[] = [
    { title: "База", order_index: 0, ege_numbers: [], task_ids: [], estimated_score: 8, required_solved_count: 4, min_accuracy: 70, requires_control_work: false, control_topic_id: null, includes_variant: false },
    { title: "Средний блок", order_index: 1, ege_numbers: [], task_ids: [], estimated_score: 12, required_solved_count: 4, min_accuracy: 65, requires_control_work: false, control_topic_id: null, includes_variant: false },
    { title: "Добор баллов", order_index: 2, ege_numbers: [], task_ids: [], estimated_score: 9, required_solved_count: 4, min_accuracy: 65, requires_control_work: false, control_topic_id: null, includes_variant: true },
];

function parseEgeNumbers(value: string): number[] {
    const result: number[] = [];
    for (const part of value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean)) {
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            for (let n = Math.min(start, end); n <= Math.max(start, end); n += 1) result.push(n);
            continue;
        }
        const num = Number(part);
        if (Number.isFinite(num)) result.push(num);
    }
    return Array.from(new Set(result)).sort((a, b) => a - b);
}

function formatEgeNumbers(nums: number[]) {
    return nums.join(", ");
}

const PLAN_EGE_OPTIONS = [
    ...Array.from({ length: 18 }, (_, index) => ({ label: String(index + 1), numbers: [index + 1] })),
    { label: "19-21", numbers: [19, 20, 21] },
    ...Array.from({ length: 6 }, (_, index) => ({ label: String(index + 22), numbers: [index + 22] })),
];

function isPlanEgeOptionSelected(selected: number[], option: { numbers: number[] }) {
    return option.numbers.every((number) => selected.includes(number));
}

function togglePlanEgeOption(selected: number[], option: { numbers: number[] }) {
    const set = new Set(selected);
    if (isPlanEgeOptionSelected(selected, option)) {
        option.numbers.forEach((number) => set.delete(number));
    } else {
        option.numbers.forEach((number) => set.add(number));
    }
    return Array.from(set).sort((a, b) => a - b);
}

function formatPlanEgeNumbers(nums: number[]) {
    const set = new Set(nums);
    const labels: string[] = [];
    for (const option of PLAN_EGE_OPTIONS) {
        if (option.numbers.every((number) => set.has(number))) {
            labels.push(option.label);
            option.numbers.forEach((number) => set.delete(number));
        }
    }
    return labels.join(", ");
}

function PlansPanel({
    plans,
    topics,
    apiKey,
    onRefresh,
}: {
    plans: PreparationPlan[];
    topics: TopicAdmin[];
    apiKey: string;
    onRefresh: () => Promise<void>;
}) {
    const [editing, setEditing] = useState<PreparationPlan | null>(null);
    const [title, setTitle] = useState("План на 60 баллов");
    const [targetScore, setTargetScore] = useState(60);
    const [duration, setDuration] = useState(14);
    const [variants, setVariants] = useState(2);
    const [description, setDescription] = useState("Маршрут подготовки с контрольной после каждого блока.");
    const [courseType, setCourseType] = useState<'year' | 'summer'>('year');
    const [isActive, setIsActive] = useState(true);
    const [blocks, setBlocks] = useState<PreparationPlanBlock[]>(defaultPlanBlocks);
    const [saving, setSaving] = useState(false);
    const controlTopics = useMemo(
        () => topics.filter((topic) => topic.category === 'control').sort((a, b) => a.order_index - b.order_index),
        [topics],
    );
    const controlTopicTitleById = useMemo(
        () => new Map(controlTopics.map((topic) => [topic.id, topic.title])),
        [controlTopics],
    );

    const startEdit = (plan: PreparationPlan | null) => {
        setEditing(plan);
        setTitle(plan?.title ?? "План на 60 баллов");
        setTargetScore(plan?.target_score ?? 60);
        setDuration(plan?.default_duration_days ?? 14);
        setVariants(plan?.final_variants_count ?? 2);
        setDescription(plan?.description ?? "Маршрут подготовки с контрольной после каждого блока.");
        setCourseType(plan?.course_type === 'summer' ? 'summer' : 'year');
        setIsActive(plan?.is_active ?? true);
        setBlocks(plan?.blocks?.length ? plan.blocks.map((block, index) => ({
            ...block,
            order_index: index,
            ege_numbers: block.ege_numbers ?? [],
            task_ids: [],
            estimated_score: block.estimated_score ?? 0,
            required_solved_count: block.required_solved_count ?? 4,
            min_accuracy: block.min_accuracy ?? 70,
            requires_control_work: Boolean(block.control_topic_id),
            control_topic_id: block.control_topic_id ?? null,
            includes_variant: block.includes_variant ?? false,
        })) : defaultPlanBlocks);
    };

    const updateBlock = (index: number, patch: Partial<PreparationPlanBlock>) => {
        setBlocks(prev => prev.map((block, i) => i === index ? { ...block, ...patch } : block));
    };

    const toggleBlockEgeNumber = (index: number, option: { numbers: number[] }) => {
        updateBlock(index, {
            ege_numbers: togglePlanEgeOption(blocks[index]?.ege_numbers ?? [], option),
            task_ids: [],
        });
    };

    const savePlan = async () => {
        if (!title.trim() || blocks.length === 0) return;
        setSaving(true);
        try {
            const body = {
                title: title.trim(),
                target_score: targetScore,
                course_type: courseType,
                description: description.trim() || null,
                default_duration_days: duration,
                final_variants_count: variants,
                is_active: isActive,
                blocks: blocks.map((block, index) => ({
                    ...block,
                    task_ids: [],
                    order_index: index,
                    requires_control_work: Boolean(block.control_topic_id),
                    control_topic_id: block.control_topic_id || null,
                })),
            };
            await adminFetch(
                editing ? `/admin/preparation-plans/${editing.id}` : "/admin/preparation-plans",
                apiKey,
                { method: editing ? "PUT" : "POST", body: JSON.stringify(body) },
            );
            setEditing(null);
            await onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const deletePlan = async (plan: PreparationPlan) => {
        if (!confirm(`Удалить план «${plan.title}»?`)) return;
        await adminFetch(`/admin/preparation-plans/${plan.id}`, apiKey, { method: "DELETE" });
        await onRefresh();
    };

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,480px)_1fr] gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm h-fit">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-900">{editing ? "Редактировать план" : "Новый план"}</h2>
                        {editing && (
                            <button onClick={() => startEdit(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62]" placeholder="Название плана" />
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] min-h-20" placeholder="Описание для ученика" />
                        <label className="block text-xs font-bold text-gray-500">
                            Тип курса
                            <select
                                value={courseType}
                                onChange={(e) => setCourseType(e.target.value === 'summer' ? 'summer' : 'year')}
                                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:border-[#3F8C62]"
                            >
                                <option value="year">Годовой курс</option>
                                <option value="summer">Летний курс</option>
                            </select>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <label className="text-xs font-bold text-gray-500">Баллы<input type="number" value={targetScore} onChange={(e) => setTargetScore(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></label>
                            <label className="text-xs font-bold text-gray-500">Дней<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></label>
                            <label className="text-xs font-bold text-gray-500">Вариантов<input type="number" value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></label>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                            Активен для учеников
                        </label>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase text-gray-400">Блоки</p>
                                <button onClick={() => setBlocks(prev => [...prev, { title: "Новая секция", order_index: prev.length, ege_numbers: [], task_ids: [], estimated_score: 0, required_solved_count: 4, min_accuracy: 70, requires_control_work: false, control_topic_id: null, includes_variant: false }])} className="text-xs font-bold text-[#3F8C62]">+ секция</button>
                            </div>
                            {blocks.map((block, index) => (
                                <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-2">
                                    <div className="flex gap-2">
                                        <input value={block.title} onChange={(e) => updateBlock(index, { title: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                        <button onClick={() => setBlocks(prev => prev.filter((_, i) => i !== index))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                                    </div>
                                    <div>
                                        <p className="mb-2 text-[11px] font-bold uppercase text-gray-400">Задания ЕГЭ в секции</p>
                                        <div className="grid grid-cols-7 gap-1.5">
                                            {PLAN_EGE_OPTIONS.map((option) => {
                                                const selected = isPlanEgeOptionSelected(block.ege_numbers ?? [], option);
                                                return (
                                                    <button
                                                        key={option.label}
                                                        type="button"
                                                        onClick={() => toggleBlockEgeNumber(index, option)}
                                                        className={clsx(
                                                            "h-8 rounded-lg border text-xs font-bold transition",
                                                            selected
                                                                ? "border-[#3F8C62] bg-emerald-50 text-[#2F754F]"
                                                                : "border-gray-200 bg-white text-gray-500 hover:border-emerald-200 hover:bg-emerald-50",
                                                        )}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2 text-[11px] text-gray-500">
                                            Выбрано: {formatPlanEgeNumbers(block.ege_numbers ?? []) || "ничего"}
                                        </p>
                                    </div>
                                    <input value={formatEgeNumbers(block.ege_numbers)} onChange={(e) => updateBlock(index, { ege_numbers: parseEgeNumbers(e.target.value), task_ids: [] })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Можно вручную: 1, 4, 19-21" />
                                    <div className="grid grid-cols-3 gap-2">
                                        <label className="text-[11px] text-gray-500">Задач<input type="number" value={block.required_solved_count} onChange={(e) => updateBlock(index, { required_solved_count: Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" /></label>
                                        <label className="text-[11px] text-gray-500">Баллов<input type="number" value={block.estimated_score} onChange={(e) => updateBlock(index, { estimated_score: Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" /></label>
                                        <label className="text-[11px] text-gray-500">Точность %<input type="number" value={block.min_accuracy} onChange={(e) => updateBlock(index, { min_accuracy: Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" /></label>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" checked={block.includes_variant} onChange={(e) => updateBlock(index, { includes_variant: e.target.checked })} /> Вариант после секции</label>
                                    </div>
                                    <label className="block text-[11px] text-gray-500">
                                        Контрольная работа
                                        <select
                                            value={block.control_topic_id ?? ''}
                                            onChange={(e) => updateBlock(index, { control_topic_id: e.target.value ? Number(e.target.value) : null, requires_control_work: Boolean(e.target.value) })}
                                            className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-sm"
                                        >
                                            <option value="">Без контрольной</option>
                                            {controlTopics.map((topic) => (
                                                <option key={topic.id} value={topic.id}>{topic.title}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            ))}
                        </div>
                        <button onClick={savePlan} disabled={saving || !title.trim()} className="w-full py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm font-bold disabled:opacity-50">
                            {saving ? "Сохранение..." : "Сохранить план"}
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {plans.map((plan) => (
                        <div key={plan.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900">{plan.title}</h3>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                            {plan.course_type === 'summer' ? 'Летний' : 'Годовой'}
                                        </span>
                                        <span className={clsx("px-2 py-0.5 rounded-md text-[10px] font-bold", plan.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>{plan.is_active ? "Активен" : "Скрыт"}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className="text-xs font-bold bg-gray-100 text-gray-700 rounded-lg px-2 py-1">{plan.target_score} баллов</span>
                                        <span className="text-xs font-bold bg-gray-100 text-gray-700 rounded-lg px-2 py-1">{plan.default_duration_days} дней</span>
                                        <span className="text-xs font-bold bg-gray-100 text-gray-700 rounded-lg px-2 py-1">{plan.final_variants_count} вариантов</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => startEdit(plan)} className="p-2 rounded-lg text-gray-400 hover:bg-sky-50 hover:text-sky-600"><Pencil size={16} /></button>
                                    <button onClick={() => deletePlan(plan)} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {plan.blocks.map((block) => (
                                    <div key={block.id ?? block.order_index} className="rounded-xl bg-gray-50 px-3 py-2">
                                        <div className="text-xs font-bold text-gray-900">{block.title}</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">
                                            № {formatPlanEgeNumbers(block.ege_numbers) || "—"} · {block.estimated_score} б. · {block.required_solved_count} реш. · {block.min_accuracy}%
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {block.control_topic_id && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{controlTopicTitleById.get(block.control_topic_id) ?? "Контрольная"}</span>}
                                            {block.includes_variant && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber-700">вариант</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {plans.length === 0 && (
                        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-gray-400">
                            <ClipboardList size={42} className="mx-auto mb-3 opacity-25" />
                            <p className="text-sm font-bold text-gray-900">Планов пока нет</p>
                            <p className="text-sm">Создайте первый план слева.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function AdminStudentDetailPage({ apiKey }: { apiKey: string }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [student, setStudent] = useState<StudentDetailOut | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        adminFetch<StudentDetailOut>(`/admin/students/${id}`, apiKey)
            .then(setStudent)
            .finally(() => setLoading(false));
    }, [id, apiKey]);

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>;
    if (!student) return null;

    return (
        <div className="p-8 h-full">
            <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <StudentDetail
                    student={student}
                    onBack={() => navigate("/admin")}
                    onViewTopicStats={(topicId) => navigate(`/admin/topics/${topicId}/stats`)}
                    apiKey={apiKey}
                    initialReviewTaskId={Number(searchParams.get("reviewTask")) || undefined}
                />
            </div>
        </div>
    );
}


function AdminTopicStatsPage({ apiKey }: { apiKey: string }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [stats, setStats] = useState<TopicStatsOut | null>(null);
    const [groups, setGroups] = useState<GroupOut[]>([]);
    const [loading, setLoading] = useState(true);

    const loadStats = useCallback(async (silent = false) => {
        if (!id) return;
        if (!silent) setLoading(true);
        try {
            const [s, g] = await Promise.all([
                adminFetch<TopicStatsOut>(`/admin/topics/${id}/stats`, apiKey),
                adminFetch<GroupOut[]>(`/admin/groups`, apiKey),
            ]);
            setStats(s);
            setGroups(g);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id, apiKey]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => {
        const interval = window.setInterval(() => {
            loadStats(true).catch((error) => console.error("Failed to refresh topic stats:", error));
        }, 3000);
        return () => window.clearInterval(interval);
    }, [loadStats]);

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>;
    if (!stats) return null;

    return (
        <div className="p-8 h-full">
            <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <TopicStats
                    stats={stats}
                    groups={groups}
                    onBack={() => navigate(-1)}
                    apiKey={apiKey}
                    onRefresh={loadStats}
                />
            </div>
        </div>
    );
}


function AdminTopicEdit({ apiKey }: { apiKey: string }) {
    const { id } = useParams();
    const [topic, setTopic] = useState<TopicAdmin | null>(null);
    const [tasks, setTasks] = useState<TaskAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const loadTopicData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const allTopics = await adminFetch<TopicAdmin[]>("/admin/topics", apiKey);
            const currentTopic = allTopics.find(t => t.id === parseInt(id));
            if (!currentTopic) {
                navigate("/admin");
                return;
            }
            setTopic(currentTopic);
            const t = await adminFetch<TaskAdmin[]>(`/admin/tasks?topic_id=${id}`, apiKey);
            setTasks(t);
        } catch (err: any) {
            console.error("Failed to load topic data:", err);
            alert(`Ошибка загрузки задач: ${err?.message ?? err}`);
        } finally {
            setLoading(false);
        }
    }, [id, apiKey, navigate]);

    useEffect(() => {
        loadTopicData();
    }, [loadTopicData]);

    const handleSaveTopic = async (data: Partial<TopicAdmin>) => {
        if (!topic) return;
        const body: TopicIn = {
            title: data.title || topic.title,
            order_index: data.order_index ?? topic.order_index,
            category: (data.category as TopicCategory) || topic.category,
            time_limit_minutes: data.time_limit_minutes !== undefined ? data.time_limit_minutes : topic.time_limit_minutes,
            is_mock: data.is_mock !== undefined ? data.is_mock : topic.is_mock,
            ege_number: data.ege_number !== undefined ? data.ege_number : topic.ege_number ?? null,
            ege_number_end: data.ege_number_end !== undefined ? data.ege_number_end : topic.ege_number_end ?? null,
            image_position: data.image_position !== undefined ? data.image_position : topic.image_position ?? null,
            image_size: data.image_size !== undefined ? data.image_size : topic.image_size ?? null,
            character_url: data.character_url !== undefined ? data.character_url : topic.character_url ?? null,
            background_url: data.background_url !== undefined ? data.background_url : topic.background_url ?? null,
        };
        await adminFetch(`/admin/topics/${topic.id}`, apiKey, {
            method: "PUT",
            body: JSON.stringify(body)
        });
        queryClient.invalidateQueries({ queryKey: ["navigation"] });
        await loadTopicData();
    };

    const handleSaveTask = async (taskData: Partial<TaskAdmin>) => {
        if (!topic) return;
        const isNew = !taskData.id;
        const method = isNew ? "POST" : "PUT";
        const url = isNew ? "/admin/tasks" : `/admin/tasks/${taskData.id}`;

        // Explicitly include all fields to be sure
        const body = {
            topic_id: topic.id,
            external_id: taskData.external_id,
            ege_number: taskData.ege_number,
            title: taskData.title,
            description: taskData.description,
            content_html: taskData.content_html,
            answer_type: taskData.answer_type,
            difficulty: taskData.difficulty,
            correct_answer: taskData.correct_answer,
            solution_steps: taskData.solution_steps,
            full_solution_code: taskData.full_solution_code,
            media_resources: (taskData as any).media_resources,
            order_index: taskData.order_index
        };
        
        await adminFetch(url, apiKey, {
            method,
            body: JSON.stringify(body)
        });
        
        queryClient.invalidateQueries({ queryKey: ["navigation"] });
        await loadTopicData();
    };

    const handleReorderTasks = async (orderedTasks: TaskAdmin[]) => {
        if (!topic) return;
        const previousTasks = tasks;
        setTasks(orderedTasks);

        const changedTasks = orderedTasks.filter((task) => {
            const previous = previousTasks.find((item) => item.id === task.id);
            return previous?.order_index !== task.order_index;
        });

        try {
            await Promise.all(changedTasks.map((task) =>
                adminFetch(`/admin/tasks/${task.id}`, apiKey, {
                    method: "PUT",
                    body: JSON.stringify({
                        topic_id: topic.id,
                        external_id: task.external_id,
                        ege_number: task.ege_number,
                        title: task.title,
                        description: task.description,
                        content_html: task.content_html,
                        answer_type: task.answer_type,
                        difficulty: task.difficulty,
                        correct_answer: task.correct_answer,
                        solution_steps: task.solution_steps,
                        full_solution_code: task.full_solution_code,
                        media_resources: (task as any).media_resources,
                        order_index: task.order_index,
                    }),
                })
            ));
            queryClient.invalidateQueries({ queryKey: ["navigation"] });
        } catch (err) {
            setTasks(previousTasks);
            console.error("Failed to reorder tasks:", err);
            alert("Не удалось изменить порядок задач");
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!confirm("Удалить задачу?")) return;
        await adminFetch(`/admin/tasks/${taskId}`, apiKey, { method: "DELETE" });
        queryClient.invalidateQueries({ queryKey: ["navigation"] });
        await loadTopicData();
    };

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>;
    if (!topic) return null;

    return (
        <div className="p-8 h-full">
            <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <TopicDetail
                    topic={topic}
                    tasks={tasks}
                    onBack={() => navigate("/admin")}
                    onSaveTopic={handleSaveTopic}
                    onSaveTask={handleSaveTask}
                    onReorderTasks={handleReorderTasks}
                    onDeleteTask={handleDeleteTask}
                    apiKey={apiKey}
                />
            </div>
        </div>
    );
}
