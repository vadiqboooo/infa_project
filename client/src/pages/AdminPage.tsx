import React, { useCallback, useEffect, useState, useMemo } from "react";
import { 
    Users, 
    BookOpen, 
    Search, 
    Download,
    Plus,
    FolderOpen,
    Trash2,
    Settings,
    LogOut,
    ShieldAlert
} from "lucide-react";
import { clsx } from "clsx";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { 
    ImportVariantResult, 
    TaskAdmin, 
    TopicAdmin, 
    TopicIn, 
    TopicCategory,
    StudentOut
} from "../api/types";
import { TopicDetail } from "../components/admin/TopicDetail";
import { StudentsTable } from "../components/admin/StudentsTable";
import { ImportTopicModal } from "../components/admin/ImportTopicModal";
import { useAuth } from "../context/AuthContext";
import "./AdminPage.css";

const API_BASE = "http://localhost:8000";

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
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Ошибка запроса");
        }
        if (res.status === 204) return undefined as T;
        return res.json();
    });
}

type FilterCategory = 'все' | 'tutorial' | 'homework' | 'variants';

const FILTER_OPTIONS: { key: FilterCategory; label: string }[] = [
  { key: 'все', label: 'Все' },
  { key: 'tutorial', label: 'Разбор' },
  { key: 'homework', label: 'Домашняя работа' },
  { key: 'variants', label: 'Вариант' },
];

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
                <Route path="topics/:id" element={<AdminTopicEdit apiKey={apiKey} />} />
            </Routes>
        </div>
    );
}

function AdminDashboard({ apiKey }: { apiKey: string }) {
    const [activeTab, setActiveTab] = useState<'topics' | 'students'>('topics');
    const [topics, setTopics] = useState<TopicAdmin[]>([]);
    const [students, setStudents] = useState<StudentOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterCategory>("все");
    const [showImport, setShowImport] = useState(false);
    
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [t, s] = await Promise.all([
                adminFetch<TopicAdmin[]>("/admin/topics", apiKey),
                adminFetch<StudentOut[]>("/admin/students", apiKey)
            ]);
            setTopics(t);
            setStudents(s);
        } finally {
            setLoading(false);
        }
    }, [apiKey]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredTopics = useMemo(() => {
        return topics.filter(t => {
            const matchesFilter = filter === 'все' || t.category === filter;
            const matchesSearch = search === '' || t.title.toLowerCase().includes(search.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [topics, filter, search]);

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

    const handleImportVariant = async (topic_title: string, variant_id: number) => {
        try {
            await adminFetch<ImportVariantResult>("/admin/import-variant", apiKey, {
                method: "POST",
                body: JSON.stringify({ variant_id, topic_title }),
            });
            queryClient.invalidateQueries({ queryKey: ["navigation"] });
            await loadData();
            setShowImport(false);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const categoryLabel = (cat: string) => {
        if (cat === 'tutorial') return 'Разбор';
        if (cat === 'homework') return 'ДЗ';
        return 'Вариант';
    };

    const categoryColor = (cat: string) => {
        if (cat === 'tutorial') return 'bg-blue-100 text-blue-700';
        if (cat === 'homework') return 'bg-violet-100 text-violet-700';
        return 'bg-orange-100 text-orange-700';
    };

    return (
        <div className="p-8 flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
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
            </div>

            {activeTab === 'topics' ? (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Filters Row */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Поиск топика..."
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
                                Импорт
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
                    <div className="flex-1 overflow-y-auto">
                        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-gray-100">
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
                                                <td colSpan={4} className="px-6 py-4 h-16 bg-white" />
                                            </tr>
                                        ))
                                    ) : filteredTopics.map((topic) => (
                                        <tr
                                            key={topic.id}
                                            onClick={() => navigate(`topics/${topic.id}`)}
                                            className="hover:bg-gray-50/80 transition-all cursor-pointer group"
                                        >
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
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTopic(topic.id);
                                                    }}
                                                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {!loading && filteredTopics.length === 0 && (
                                <div className="text-center py-24 text-gray-400">
                                    <FolderOpen size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-bold text-gray-900">Топики не найдены</p>
                                    <p className="text-sm">Попробуйте изменить параметры фильтрации</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <StudentsTable 
                    students={students} 
                    apiKey={apiKey} 
                    onRefresh={loadData} 
                />
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
            is_mock: data.is_mock !== undefined ? data.is_mock : topic.is_mock
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
            media_resources: (taskData as any).media_resources
        };
        
        await adminFetch(url, apiKey, {
            method,
            body: JSON.stringify(body)
        });
        
        queryClient.invalidateQueries({ queryKey: ["navigation"] });
        await loadTopicData();
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
                    onDeleteTask={handleDeleteTask}
                />
            </div>
        </div>
    );
}
