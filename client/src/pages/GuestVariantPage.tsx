import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface GuestLinkInfo {
  topic_id: number;
  title: string;
  task_count: number;
  time_limit_minutes: number;
}

/** Public entry for a variant link: name + surname, then straight into the exam page (which shows the instructions). */
export default function GuestVariantPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading, login, logout } = useAuth();
  const [info, setInfo] = useState<GuestLinkInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GuestLinkInfo>(`/auth/guest-link/${encodeURIComponent(token)}`)
      .then((data) => !cancelled && setInfo(data))
      .catch((err: Error) => !cancelled && setLinkError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // A returning guest (same browser) resumes the same attempt.
  const isReturningGuest = Boolean(info && user?.role === "guest" && user.guest_topic_id === info.topic_id);
  useEffect(() => {
    if (info && isReturningGuest) navigate(`/exams/${info.topic_id}`, { replace: true });
  }, [info, isReturningGuest, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Укажите фамилию и имя");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api<{ access_token: string }>("/auth/guest", {
        method: "POST",
        body: JSON.stringify({ token, first_name: firstName, last_name: lastName }),
      });
      login(res.access_token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Не удалось войти");
      setSubmitting(false);
    }
  };

  const cardClass = "w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#1d1f1e]";
  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#3F8C62] focus:ring-2 focus:ring-[#3F8C62]/15 dark:border-white/10 dark:bg-white/[0.05] dark:text-white";

  let body;
  if (linkError) {
    body = (
      <div role="alert">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">Ссылка не работает</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{linkError}. Попросите у преподавателя новую ссылку.</p>
      </div>
    );
  } else if (!info || loading || isReturningGuest) {
    body = <div role="status" className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</div>;
  } else if (user && user.role !== "guest") {
    const name = [user.first_name_real, user.last_name_real].filter(Boolean).join(" ") || user.first_name || "ваш аккаунт";
    body = (
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">{info.title}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Вы уже вошли как {name}.</p>
        <button
          type="button"
          onClick={() => navigate(`/exams/${info.topic_id}`)}
          className="mt-6 w-full rounded-xl bg-[#3F8C62] px-4 py-3 text-sm font-black text-white hover:opacity-90"
        >
          Продолжить как {name}
        </button>
        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
        >
          Я другой ученик
        </button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={handleSubmit}>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">{info.title}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {info.task_count} заданий · {info.time_limit_minutes} мин. Регистрация не нужна — введите фамилию и имя.
        </p>
        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">Фамилия</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            maxLength={60}
            autoFocus
            className={inputClass}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400">Имя</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            maxLength={60}
            className={inputClass}
          />
        </label>
        {formError && (
          <p role="alert" className="mt-3 text-sm font-bold text-red-600">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-[#3F8C62] px-4 py-3 text-sm font-black text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Входим…" : "Продолжить"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f5f4] px-4 dark:bg-[#151515]">
      <div className={cardClass}>{body}</div>
    </div>
  );
}
