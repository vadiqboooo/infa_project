import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const CODE_LENGTH = 8;

/** Entry screen of the exam domain: surname + name, then the 8-digit variant number. */
export default function ExamEntryPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<"name" | "code">("name");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleName = (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Укажите фамилию и имя");
      return;
    }
    setError(null);
    setStep("code");
  };

  const handleCode = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (code.length !== CODE_LENGTH) {
      setError(`Номер варианта состоит из ${CODE_LENGTH} цифр`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ access_token: string }>("/auth/guest", {
        method: "POST",
        body: JSON.stringify({ token: code, first_name: firstName, last_name: lastName }),
      });
      login(res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#3F8C62] focus:ring-2 focus:ring-[#3F8C62]/15 dark:border-white/10 dark:bg-white/[0.05] dark:text-white";
  const labelClass = "mb-1.5 block text-xs font-bold text-gray-500 dark:text-gray-400";
  const buttonClass =
    "mt-6 w-full rounded-xl bg-[#3F8C62] px-4 py-3 text-sm font-black text-white hover:opacity-90 disabled:opacity-60";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f5f4] px-4 dark:bg-[#151515]">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#1d1f1e]">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">Пробный вариант ЕГЭ</h1>
        {step === "name" ? (
          <form onSubmit={handleName}>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Регистрация не нужна. Введите фамилию и имя.</p>
            <label className="mt-6 block">
              <span className={labelClass}>Фамилия</span>
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
              <span className={labelClass}>Имя</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                maxLength={60}
                className={inputClass}
              />
            </label>
            {error && <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p>}
            <button type="submit" className={buttonClass}>Далее</button>
          </form>
        ) : (
          <form onSubmit={handleCode}>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {lastName.trim()} {firstName.trim()}, введите номер варианта — {CODE_LENGTH} цифр.
            </p>
            <label className="mt-6 block">
              <span className={labelClass}>Номер варианта</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="00000000"
                className={`${inputClass} text-center font-mono text-2xl tracking-[0.25em]`}
              />
            </label>
            {error && <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p>}
            <button type="submit" disabled={submitting || code.length !== CODE_LENGTH} className={buttonClass}>
              {submitting ? "Входим…" : "Начать вариант"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("name");
              }}
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            >
              Изменить имя
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
