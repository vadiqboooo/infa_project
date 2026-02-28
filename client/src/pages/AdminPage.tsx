import React, { useCallback, useEffect, useState } from "react";
import type { AnswerType, ImportVariantResult, TaskAdmin, TaskAdminIn, TopicAdmin, TopicIn } from "../api/types";
import TaskView from "../components/TaskView";
import "./AdminPage.css";

const API_BASE = "http://localhost:8000";

function adminFetch<T>(path: string, apiKey: string, options: RequestInit = {}): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            ...(options.headers as Record<string, string> || {}),
        },
    }).then(async (res) => {
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Ошибка запроса");
        }
        if (res.status === 204) return undefined as T;
        return res.json();
    });
}

// ── Import Variant Form ───────────────────────────────────────

function ImportVariantForm({
    apiKey,
    onImported,
    onCancel,
}: {
    apiKey: string;
    onImported: (result: ImportVariantResult) => void;
    onCancel: () => void;
}) {
    const [variantId, setVariantId] = useState("");
    const [topicTitle, setTopicTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const id = parseInt(variantId);
        if (!id) { setError("Введите номер варианта"); return; }
        setLoading(true);
        setError("");
        try {
            const result = await adminFetch<ImportVariantResult>("/admin/import-variant", apiKey, {
                method: "POST",
                body: JSON.stringify({ variant_id: id, topic_title: topicTitle.trim() || null }),
            });
            onImported(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form className="admin-import-form" onSubmit={handleSubmit}>
            <div className="admin-import-header">
                <span>Импорт из kompege.ru</span>
                <a
                    className="admin-import-link"
                    href="https://kompege.ru"
                    target="_blank"
                    rel="noreferrer"
                >
                    kompege.ru ↗
                </a>
            </div>
            <div className="admin-import-fields">
                <input
                    className="input"
                    placeholder="Номер варианта (напр. 25159856)"
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    type="number"
                    min={1}
                />
                <input
                    className="input"
                    placeholder="Название темы (необязательно)"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                />
            </div>
            {error && <span className="admin-error">{error}</span>}
            <div className="admin-form-actions">
                <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? "Загружаю..." : "Импортировать"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={onCancel}>
                    Отмена
                </button>
            </div>
        </form>
    );
}

// ── Topic Form ────────────────────────────────────────────────

function TopicForm({
    initial,
    onSave,
    onCancel,
}: {
    initial?: TopicAdmin;
    onSave: (data: TopicIn) => Promise<void>;
    onCancel: () => void;
}) {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [orderIndex, setOrderIndex] = useState(initial?.order_index ?? 0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) { setError("Введите название"); return; }
        setLoading(true);
        try {
            await onSave({ title: title.trim(), order_index: orderIndex });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form className="admin-inline-form" onSubmit={handleSubmit}>
            <input
                className="input"
                placeholder="Название темы"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <input
                className="input admin-order-input"
                type="number"
                placeholder="Порядок"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
            />
            {error && <span className="admin-error">{error}</span>}
            <div className="admin-form-actions">
                <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? "..." : "Сохранить"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={onCancel}>
                    Отмена
                </button>
            </div>
        </form>
    );
}

// ── Task Modal ────────────────────────────────────────────────

function TaskModal({
    initial,
    topicId,
    onSave,
    onClose,
}: {
    initial?: TaskAdmin;
    topicId: number;
    onSave: (data: TaskAdminIn) => Promise<void>;
    onClose: () => void;
}) {
    const [contentHtml, setContentHtml] = useState(initial?.content_html ?? "");
    const [answerType, setAnswerType] = useState<AnswerType>(initial?.answer_type ?? "single_number");
    const [correctAnswer, setCorrectAnswer] = useState(
        initial?.correct_answer ? JSON.stringify(initial.correct_answer) : '{"val": 0}'
    );
    const [externalId, setExternalId] = useState(initial?.external_id ?? "");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        let parsed: Record<string, unknown> | null = null;
        try {
            parsed = JSON.parse(correctAnswer);
        } catch {
            setError("Правильный ответ — невалидный JSON");
            return;
        }
        setLoading(true);
        try {
            await onSave({
                topic_id: topicId,
                external_id: externalId.trim() || null,
                content_html: contentHtml,
                answer_type: answerType,
                correct_answer: parsed,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="admin-modal">
                <div className="admin-modal-header">
                    <h2>{initial ? "Редактировать задачу" : "Новая задача"}</h2>
                    <button className="btn btn-ghost admin-close-btn" onClick={onClose}>✕</button>
                </div>
                <form className="admin-modal-body" onSubmit={handleSubmit}>
                    <div className="admin-modal-split">
                        {/* Left: fields */}
                        <div className="admin-modal-fields">
                            <label className="admin-label">
                                External ID (необязательно)
                                <input
                                    className="input"
                                    placeholder="task-001"
                                    value={externalId}
                                    onChange={(e) => setExternalId(e.target.value)}
                                />
                            </label>

                            <label className="admin-label">
                                Тип ответа
                                <select
                                    className="input"
                                    value={answerType}
                                    onChange={(e) => setAnswerType(e.target.value as AnswerType)}
                                >
                                    <option value="single_number">Одно число</option>
                                    <option value="pair">Два числа</option>
                                    <option value="table">Таблица чисел</option>
                                </select>
                            </label>

                            <label className="admin-label">
                                Правильный ответ (JSON)
                                <input
                                    className="input"
                                    placeholder='{"val": 42}'
                                    value={correctAnswer}
                                    onChange={(e) => setCorrectAnswer(e.target.value)}
                                />
                                <span className="admin-hint">
                                    single_number: {`{"val": 42}`} &nbsp;|&nbsp;
                                    pair: {`{"val": [1, 2]}`} &nbsp;|&nbsp;
                                    table: {`{"val": [[1,2],[3,4]]}`}
                                </span>
                            </label>

                            <label className="admin-label admin-label-grow">
                                HTML-контент задачи
                                <textarea
                                    className="input admin-textarea"
                                    placeholder="<p>Условие задачи...</p>"
                                    value={contentHtml}
                                    onChange={(e) => setContentHtml(e.target.value)}
                                />
                            </label>

                            {error && <span className="admin-error">{error}</span>}

                            <div className="admin-form-actions">
                                <button className="btn btn-primary" type="submit" disabled={loading}>
                                    {loading ? "Сохраняю..." : "Сохранить"}
                                </button>
                                <button className="btn btn-ghost" type="button" onClick={onClose}>
                                    Отмена
                                </button>
                            </div>
                        </div>

                        {/* Right: preview */}
                        <div className="admin-modal-preview">
                            <div className="admin-preview-label">Предпросмотр</div>
                            <div className="admin-preview-content">
                                {contentHtml
                                    ? <TaskView content={contentHtml} />
                                    : <span className="admin-preview-empty">Введите HTML-контент слева</span>
                                }
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main AdminPage ────────────────────────────────────────────

export default function AdminPage() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem("admin_api_key") ?? "");
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [authed, setAuthed] = useState(false);
    const [authError, setAuthError] = useState("");

    const [topics, setTopics] = useState<TopicAdmin[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<TopicAdmin | null>(null);
    const [tasks, setTasks] = useState<TaskAdmin[]>([]);

    const [editingTopic, setEditingTopic] = useState<TopicAdmin | "new" | null>(null);
    const [taskModal, setTaskModal] = useState<TaskAdmin | "new" | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [importSuccess, setImportSuccess] = useState<ImportVariantResult | null>(null);

    const [loading, setLoading] = useState(false);

    const loadTopics = useCallback(async (key: string) => {
        const data = await adminFetch<TopicAdmin[]>("/admin/topics", key);
        setTopics(data);
    }, []);

    const loadTasks = useCallback(async (topicId: number, key: string) => {
        const data = await adminFetch<TaskAdmin[]>(`/admin/tasks?topic_id=${topicId}`, key);
        setTasks(data);
    }, []);

    // Try to auth with stored key on mount
    useEffect(() => {
        if (apiKey) {
            adminFetch<TopicAdmin[]>("/admin/topics", apiKey)
                .then((data) => { setTopics(data); setAuthed(true); })
                .catch(() => { localStorage.removeItem("admin_api_key"); setApiKey(""); });
        }
    }, []);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setAuthError("");
        try {
            await adminFetch("/admin/topics", apiKeyInput);
            localStorage.setItem("admin_api_key", apiKeyInput);
            setApiKey(apiKeyInput);
            await loadTopics(apiKeyInput);
            setAuthed(true);
        } catch {
            setAuthError("Неверный API ключ");
        } finally {
            setLoading(false);
        }
    }

    async function handleSelectTopic(topic: TopicAdmin) {
        setSelectedTopic(topic);
        await loadTasks(topic.id, apiKey);
    }

    // Topics CRUD
    async function handleSaveTopic(data: TopicIn) {
        if (editingTopic === "new") {
            await adminFetch("/admin/topics", apiKey, { method: "POST", body: JSON.stringify(data) });
        } else if (editingTopic) {
            await adminFetch(`/admin/topics/${editingTopic.id}`, apiKey, { method: "PUT", body: JSON.stringify(data) });
            if (selectedTopic?.id === editingTopic.id) {
                setSelectedTopic({ ...selectedTopic, ...data });
            }
        }
        setEditingTopic(null);
        await loadTopics(apiKey);
    }

    async function handleDeleteTopic(topic: TopicAdmin) {
        if (!confirm(`Удалить тему "${topic.title}" и все её задачи?`)) return;
        await adminFetch(`/admin/topics/${topic.id}`, apiKey, { method: "DELETE" });
        if (selectedTopic?.id === topic.id) { setSelectedTopic(null); setTasks([]); }
        await loadTopics(apiKey);
    }

    // Tasks CRUD
    async function handleSaveTask(data: TaskAdminIn) {
        if (taskModal === "new") {
            await adminFetch("/admin/tasks", apiKey, { method: "POST", body: JSON.stringify(data) });
        } else if (taskModal) {
            await adminFetch(`/admin/tasks/${taskModal.id}`, apiKey, { method: "PUT", body: JSON.stringify(data) });
        }
        setTaskModal(null);
        if (selectedTopic) await loadTasks(selectedTopic.id, apiKey);
        await loadTopics(apiKey); // refresh task_count
    }

    async function handleImported(result: ImportVariantResult) {
        setShowImport(false);
        setImportSuccess(result);
        await loadTopics(apiKey);
        setTimeout(() => setImportSuccess(null), 5000);
    }

    async function handleDeleteTask(task: TaskAdmin) {
        if (!confirm(`Удалить задачу #${task.id}?`)) return;
        await adminFetch(`/admin/tasks/${task.id}`, apiKey, { method: "DELETE" });
        if (selectedTopic) await loadTasks(selectedTopic.id, apiKey);
        await loadTopics(apiKey);
    }

    // ── Auth screen ──────────────────────────────────────────

    if (!authed) {
        return (
            <div className="admin-auth-screen fade-in">
                <div className="card admin-auth-card">
                    <h1 className="admin-auth-title">Панель администратора</h1>
                    <form onSubmit={handleLogin} className="admin-auth-form">
                        <input
                            className="input"
                            type="password"
                            placeholder="Введите PARSER_API_KEY"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            autoFocus
                        />
                        {authError && <span className="admin-error">{authError}</span>}
                        <button className="btn btn-primary" type="submit" disabled={loading}>
                            {loading ? "Проверяю..." : "Войти"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Main panel ───────────────────────────────────────────

    return (
        <div className="admin-page fade-in">
            <header className="admin-header">
                <h1>Панель администратора</h1>
                <button className="btn btn-ghost" onClick={() => {
                    localStorage.removeItem("admin_api_key");
                    setApiKey("");
                    setAuthed(false);
                }}>
                    Выйти
                </button>
            </header>

            <div className="admin-panels">
                {/* ── Topics panel ─────────────────────────── */}
                <div className="admin-panel card">
                    <div className="admin-panel-header">
                        <h2>Темы</h2>
                        <div className="admin-header-actions">
                            <button className="btn btn-ghost" onClick={() => { setShowImport(true); setEditingTopic(null); }}>
                                ↓ Импорт
                            </button>
                            <button className="btn btn-primary" onClick={() => { setEditingTopic("new"); setShowImport(false); }}>
                                + Тема
                            </button>
                        </div>
                    </div>

                    {importSuccess && (
                        <div className="admin-import-success">
                            ✓ Импортировано: <strong>{importSuccess.topic_title}</strong> — {importSuccess.created_count} задач
                            {importSuccess.skipped_count > 0 && `, пропущено: ${importSuccess.skipped_count}`}
                        </div>
                    )}

                    {showImport && (
                        <ImportVariantForm
                            apiKey={apiKey}
                            onImported={handleImported}
                            onCancel={() => setShowImport(false)}
                        />
                    )}

                    {editingTopic === "new" && (
                        <TopicForm
                            onSave={handleSaveTopic}
                            onCancel={() => setEditingTopic(null)}
                        />
                    )}

                    <ul className="admin-list">
                        {topics.map((topic) => (
                            <li key={topic.id} className={`admin-list-item ${selectedTopic?.id === topic.id ? "active" : ""}`}>
                                {editingTopic !== "new" && editingTopic?.id === topic.id ? (
                                    <TopicForm
                                        initial={topic}
                                        onSave={handleSaveTopic}
                                        onCancel={() => setEditingTopic(null)}
                                    />
                                ) : (
                                    <div className="admin-list-row" onClick={() => handleSelectTopic(topic)}>
                                        <span className="admin-item-title">{topic.title}</span>
                                        <span className="admin-item-meta">{topic.task_count} задач</span>
                                        <div className="admin-item-actions" onClick={(e) => e.stopPropagation()}>
                                            <button className="btn btn-ghost admin-icon-btn" onClick={() => setEditingTopic(topic)}>✏️</button>
                                            <button className="btn btn-ghost admin-icon-btn admin-delete-btn" onClick={() => handleDeleteTopic(topic)}>🗑</button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                        {topics.length === 0 && (
                            <li className="admin-empty">Нет тем. Создайте первую.</li>
                        )}
                    </ul>
                </div>

                {/* ── Tasks panel ──────────────────────────── */}
                <div className="admin-panel card">
                    <div className="admin-panel-header">
                        <h2>{selectedTopic ? `Задачи: ${selectedTopic.title}` : "Задачи"}</h2>
                        {selectedTopic && (
                            <button className="btn btn-primary" onClick={() => setTaskModal("new")}>
                                + Задача
                            </button>
                        )}
                    </div>

                    {!selectedTopic ? (
                        <p className="admin-empty">Выберите тему слева</p>
                    ) : (
                        <ul className="admin-list">
                            {tasks.map((task) => (
                                <li key={task.id} className="admin-list-item">
                                    <div className="admin-list-row">
                                        <span className="admin-item-title">#{task.id}</span>
                                        {task.external_id && (
                                            <span className="admin-item-meta">{task.external_id}</span>
                                        )}
                                        <span className="admin-item-badge">{task.answer_type}</span>
                                        <div className="admin-item-actions">
                                            <button className="btn btn-ghost admin-icon-btn" onClick={() => setTaskModal(task)}>✏️</button>
                                            <button className="btn btn-ghost admin-icon-btn admin-delete-btn" onClick={() => handleDeleteTask(task)}>🗑</button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {tasks.length === 0 && (
                                <li className="admin-empty">Задач нет. Создайте первую.</li>
                            )}
                        </ul>
                    )}
                </div>
            </div>

            {/* Task modal */}
            {taskModal !== null && selectedTopic && (
                <TaskModal
                    initial={taskModal === "new" ? undefined : taskModal}
                    topicId={selectedTopic.id}
                    onSave={handleSaveTask}
                    onClose={() => setTaskModal(null)}
                />
            )}
        </div>
    );
}
