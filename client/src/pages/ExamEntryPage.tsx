import { useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Code,
  GraduationCap,
  Moon,
  Save,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "./ExamEntryPage.css";

const CODE_LENGTH = 8;
// Time the "3 · 2 · 1 · Время пошло" overlay needs before the exam opens.
const COUNTDOWN_MS = 3700;

type Step = "name" | "code" | "rules";

interface VariantInfo {
  topic_id: number;
  title: string;
  task_count: number;
  time_limit_minutes: number;
}

const THEME_VARS: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    "--bg": "#151515", "--card": "#202020", "--border": "#FFFFFF1A",
    "--text": "#DBE5F1", "--strong": "#F8FAFC", "--muted": "#90A1B9",
    "--soft": "#FFFFFF0F", "--track": "#FFFFFF14", "--inset": "#FFFFFF08",
    "--em-bg": "rgba(0,206,147,0.10)", "--em-border": "rgba(95,235,180,0.24)", "--em-text": "#A4F4CF",
    "--bad-bg": "rgba(255,98,98,0.10)", "--bad-border": "rgba(255,160,160,0.26)", "--bad-text": "#FFB4B4",
    "--glow-a": "rgba(16,185,129,0.34)", "--glow-b": "rgba(16,185,129,0.38)",
    "--glow-c": "rgba(56,189,248,0.22)", "--glow-d": "rgba(139,92,246,0.24)",
    "--dot": "rgba(255,255,255,0.12)", "--orbit": "rgba(255,255,255,0.10)",
    "--hl-a": "#6EE7B7", "--hl-b": "#67E8F9",
  },
  light: {
    "--bg": "#F4FAF6", "--card": "#FFFFFF", "--border": "rgba(57,79,66,0.14)",
    "--text": "#2D3E34", "--strong": "#13231B", "--muted": "#607064",
    "--soft": "rgba(35,71,49,0.07)", "--track": "#E2E8E4", "--inset": "#F6F9F7",
    "--em-bg": "rgba(0,206,147,0.10)", "--em-border": "rgba(16,185,129,0.30)", "--em-text": "#137A4B",
    "--bad-bg": "rgba(255,98,98,0.10)", "--bad-border": "rgba(220,80,80,0.30)", "--bad-text": "#B83B3B",
    "--glow-a": "rgba(16,185,129,0.30)", "--glow-b": "rgba(16,185,129,0.30)",
    "--glow-c": "rgba(56,189,248,0.22)", "--glow-d": "rgba(139,92,246,0.16)",
    "--dot": "rgba(20,60,40,0.16)", "--orbit": "rgba(20,80,50,0.16)",
    "--hl-a": "#059669", "--hl-b": "#0891B2",
  },
};

const STEPS: { key: Step; label: string }[] = [
  { key: "name", label: "Имя" },
  { key: "code", label: "Вариант" },
  { key: "rules", label: "Старт" },
];

const durationText = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} ч${m ? ` ${m} мин` : ""}` : `${m} мин`;
};

const clockText = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

// Tasks 26 and later are worth 2 primary points (same rule as the exam page).
const primaryPoints = (tasks: number) => tasks + Math.max(0, tasks - 25);

/** Entry of the exam domain: name → 8-digit variant number → rules and start. */
export default function ExamEntryPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState<Step>("name");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const cellRefs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");
  const [info, setInfo] = useState<VariantInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [agree, setAgree] = useState(false);
  const [go, setGo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = lastName.trim();
  const first = firstName.trim();
  const fullName = `${first} ${last}`.trim() || "Гость";

  // Look the variant up as soon as all digits are in, so the student sees it before continuing.
  useEffect(() => {
    if (code.length !== CODE_LENGTH) {
      setInfo(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    api<VariantInfo>(`/auth/guest-link/${encodeURIComponent(code)}`)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setInfo(null);
        setError(err.message);
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const focusCell = (index: number) => {
    const el = cellRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const changeDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((d, i) => (i === index ? digit : d)));
    setError(null);
    if (digit && index < CODE_LENGTH - 1) focusCell(index + 1);
  };

  const keyDigit = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigits((prev) => prev.map((d, i) => (i === index - 1 ? "" : d)));
      focusCell(index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusCell(index - 1);
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  // Pasting the whole number spreads the digits over the cells.
  const pasteDigits = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted.charAt(i)));
    setError(null);
    focusCell(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  const handleName = (event: FormEvent) => {
    event.preventDefault();
    if (!first || !last) {
      setError("Укажите и фамилию, и имя — так мы найдём вашу работу");
      return;
    }
    setError(null);
    setStep("code");
  };

  const handleCode = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError("В номере варианта 8 цифр — проверьте, всё ли вписано");
      return;
    }
    if (!info) return;
    setError(null);
    setStep("rules");
  };

  const start = async () => {
    if (!agree || go || !info) return;
    setGo(true);
    setError(null);
    const countdown = new Promise((resolve) => setTimeout(resolve, COUNTDOWN_MS));
    try {
      const [res] = await Promise.all([
        api<{ access_token: string }>("/auth/guest", {
          method: "POST",
          body: JSON.stringify({ token: code, first_name: firstName, last_name: lastName }),
        }),
        countdown,
      ]);
      login(res.access_token);
    } catch (err) {
      setGo(false);
      setError(err instanceof Error ? err.message : "Не удалось начать вариант");
    }
  };

  const themeStyle = THEME_VARS[theme === "light" ? "light" : "dark"] as CSSProperties;
  const errorBlock = error && <div role="alert" className="ee-err">{error}</div>;

  return (
    <div className="ee-root" style={themeStyle}>
      <div className="ee-bg" aria-hidden="true">
        <div className="ee-blob ee-b1" />
        <div className="ee-blob ee-b2" />
        <div className="ee-blob ee-b3" />
        <div className="ee-dots" />
        <div className="ee-orbit ee-orbit-1" />
        <div className="ee-orbit ee-orbit-2" />
      </div>

      <header className="ee-bar">
        <span className="ee-brand">
          <span className="ee-logo"><GraduationCap size={22} aria-hidden="true" /></span>
          <span className="ee-brand-text">
            <b>Информатика</b>
            <span>Пробный экзамен для всех</span>
          </span>
        </span>
        <button type="button" className="ee-theme" onClick={toggleTheme} aria-label="Сменить тему">
          {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
        </button>
      </header>

      <main className="ee-wrap">
        <div className="ee-spacer" />

        <ol className="ee-steps" aria-label="Шаги">
          {STEPS.map((s, i) => {
            const current = STEPS.findIndex((x) => x.key === step);
            const state = i < current ? "done" : i === current ? "on" : "";
            return (
              <li key={s.key}>
                <span className={`ee-pill ${state}`} aria-current={state === "on" ? "step" : undefined}>
                  <span className="ee-pill-dot">{state === "done" ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
                  <span>{s.label}</span>
                </span>
                {i < STEPS.length - 1 && <span className={`ee-line ${i < current ? "done" : ""}`} />}
              </li>
            );
          })}
        </ol>

        {step === "name" && (
          <form className="ee-glass ee-card" onSubmit={handleName}>
            <div className="ee-stack">
              <span className="ee-badge"><Sparkles size={14} aria-hidden="true" />Без регистрации</span>
              <h1 className="ee-h1 ee-h1-name ee-hl">Проверьте себя как на настоящем ЕГЭ</h1>
              <p className="ee-lead">
                Решайте вариант в формате экзамена — с таймером и без подсказок. Назовите себя, чтобы преподаватель нашёл вашу работу.
              </p>
            </div>
            <div className="ee-fields">
              <label className="ee-label">
                Фамилия
                <input
                  className="ee-inp"
                  type="text"
                  autoComplete="family-name"
                  maxLength={60}
                  autoFocus
                  placeholder="Иванова"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="ee-label">
                Имя
                <input
                  className="ee-inp"
                  type="text"
                  autoComplete="given-name"
                  maxLength={60}
                  placeholder="Анна"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
            </div>
            {errorBlock}
            <button type="submit" className="ee-cta">
              Продолжить<ArrowRight size={20} aria-hidden="true" />
            </button>
          </form>
        )}

        {step === "code" && (
          <form className="ee-glass ee-card" onSubmit={handleCode}>
            <div className="ee-stack" style={{ gap: 12 }}>
              <span className="ee-user">
                <span className="ee-user-dot"><User size={14} aria-hidden="true" /></span>
                {fullName}
              </span>
              <h1 className="ee-h1 ee-hl">{first || "Здравствуйте"}, введите номер варианта</h1>
              <p className="ee-lead">Восемь цифр — они указаны в задании от преподавателя.</p>
            </div>
            <div className="ee-field">
              <span className="ee-label-text">Номер варианта</span>
              <div role="group" aria-label="Номер варианта, 8 цифр" className="ee-digits">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      cellRefs.current[i] = el;
                    }}
                    className={`ee-inp ee-dg${i === 4 ? " gap" : ""}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus={i === 0}
                    maxLength={1}
                    placeholder="·"
                    aria-label={`Цифра ${i + 1} из ${CODE_LENGTH}`}
                    value={digit}
                    onChange={(e) => changeDigit(i, e.target.value)}
                    onKeyDown={(e) => keyDigit(i, e)}
                    onPaste={pasteDigits}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>
              <span className="ee-hint">Можно вставить номер целиком — цифры разойдутся по клеткам.</span>
            </div>
            {info && (
              <div role="status" className="ee-found">
                <span className="ee-found-ico"><Check size={18} strokeWidth={2.6} aria-hidden="true" /></span>
                <span className="ee-found-text">
                  <b>Вариант найден: {info.title}</b>
                  <span>{info.task_count} заданий · {durationText(info.time_limit_minutes)}</span>
                </span>
              </div>
            )}
            {errorBlock}
            <div className="ee-actions">
              <button type="submit" className="ee-cta" disabled={!info || checking}>
                {checking ? "Ищем вариант…" : "Открыть вариант"}
                {!checking && <ArrowRight size={20} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="ee-ghost"
                onClick={() => {
                  setError(null);
                  setStep("name");
                }}
              >
                <ArrowLeft size={18} aria-hidden="true" />Изменить имя
              </button>
            </div>
          </form>
        )}

        {step === "rules" && info && (
          <section className="ee-glass ee-card-wide">
            <div className="ee-two">
              <div className="ee-left">
                <span className="ee-badge"><Check size={14} strokeWidth={2.6} aria-hidden="true" />Вариант найден</span>
                <div className="ee-title-box">
                  <h1 className="ee-h1 ee-h1-rules ee-hl">{info.title}</h1>
                  <span>{fullName} · №&nbsp;{code}</span>
                </div>
                <div className="ee-ring">
                  <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
                    <defs>
                      <linearGradient id="ee-rg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#34D399" />
                        <stop offset="1" stopColor="#22D3EE" />
                      </linearGradient>
                    </defs>
                    <circle cx="100" cy="100" r="94" fill="none" stroke="var(--track)" strokeWidth="2" strokeDasharray="1.5 7.2" />
                    <g className="ee-ring-spin">
                      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--orbit)" strokeWidth="1" strokeDasharray="3 6" />
                    </g>
                    <circle
                      className="ee-ring-arc"
                      cx="100" cy="100" r="90" fill="none" stroke="url(#ee-rg)" strokeWidth="6"
                      strokeLinecap="round" strokeDasharray="565" strokeDashoffset="60" transform="rotate(-90 100 100)"
                    />
                  </svg>
                  <div className="ee-ring-text">
                    <b>{clockText(info.time_limit_minutes)}</b>
                    <span>на весь вариант</span>
                  </div>
                </div>
                <div className="ee-stats">
                  <div className="ee-stat"><b>{info.task_count}</b><span>заданий</span></div>
                  <div className="ee-stat"><b>{info.time_limit_minutes}</b><span>минут</span></div>
                  <div className="ee-stat"><b>{primaryPoints(info.task_count)}</b><span>баллов</span></div>
                </div>
              </div>

              <div className="ee-right">
                <div className="ee-right-head">
                  <h2>Правила экзамена</h2>
                  <span>Прочитайте до старта — после него таймер уже не остановить.</span>
                </div>
                <div className="ee-rules">
                  <div className="ee-rule">
                    <span className="ee-rule-ico" style={{ background: "linear-gradient(135deg, rgba(16,185,129,.25), rgba(16,185,129,.08))", color: "#10B981" }}>
                      <Save size={22} aria-hidden="true" />
                    </span>
                    <span className="ee-rule-text">
                      <b>Ответы сохраняем</b>
                      <span>Каждый ответ записывается сразу. К любому заданию можно вернуться и поправить, пока идёт время.</span>
                    </span>
                  </div>
                  <div className="ee-rule">
                    <span className="ee-rule-ico" style={{ background: "linear-gradient(135deg, rgba(56,189,248,.25), rgba(56,189,248,.08))", color: "#38BDF8" }}>
                      <Code size={22} aria-hidden="true" />
                    </span>
                    <span className="ee-rule-text">
                      <b>Прикрепляйте решения</b>
                      <span>К заданиям, где нужен ход решения, добавьте программу — вставьте код текстом или загрузите файл.</span>
                    </span>
                  </div>
                  <div className="ee-rule">
                    <span className="ee-rule-ico" style={{ background: "linear-gradient(135deg, rgba(251,191,36,.25), rgba(251,191,36,.08))", color: "#FBBF24" }}>
                      <Clock size={22} aria-hidden="true" />
                    </span>
                    <span className="ee-rule-text">
                      <b>Время идёт без пауз</b>
                      <span>Работа сдаётся сама, когда таймер дойдёт до нуля. Закончили раньше — нажмите «Завершить».</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={agree}
                  className={`ee-agree ${agree ? "on" : ""}`}
                  onClick={() => setAgree((value) => !value)}
                >
                  <span className="ee-box">{agree && <Check size={16} strokeWidth={3} aria-hidden="true" />}</span>
                  Я прочитал(а) правила и готов(а) начать
                </button>
                {errorBlock}
                <div className="ee-start-row">
                  <button
                    type="button"
                    className={`ee-cta ee-cta-lg ${agree ? "ready" : ""}`}
                    aria-disabled={!agree}
                    onClick={start}
                  >
                    Начать вариант<ArrowRight size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="ee-back"
                    onClick={() => {
                      setError(null);
                      setStep("code");
                    }}
                  >
                    Назад
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="ee-spacer" />
      </main>

      {go && (
        <div role="alert" aria-label="Старт" className="ee-count">
          <span className="ee-cdn n3">3</span>
          <span className="ee-cdn n2">2</span>
          <span className="ee-cdn n1">1</span>
          <span className="ee-cdgo ee-hl">Время пошло. Удачи!</span>
        </div>
      )}
    </div>
  );
}
