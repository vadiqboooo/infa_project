import { useEffect, useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    Download,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Pencil,
    Plus,
    Search,
    Trash2,
    Users,
    X,
} from "lucide-react";
import type { TopicAdmin } from "../../api/types";
import "./TopicsPanel.css";

type ExamType = "ege" | "oge";
type SubjectId = "informatics" | "math";
type CatKey = "tutorial" | "homework" | "control" | "variants";

const VIEW_KEY = "admin_topics_view";

const SUBJECTS: { id: SubjectId; label: string; letter: string; color: string; max: Record<ExamType, number> }[] = [
    { id: "informatics", label: "Информатика", letter: "И", color: "#21B66F", max: { ege: 27, oge: 15 } },
    { id: "math", label: "Математика", letter: "М", color: "#3B82C4", max: { ege: 19, oge: 25 } },
];

const CATS: { key: CatKey; label: string; dot: string }[] = [
    { key: "tutorial", label: "Разбор", dot: "#34D399" },
    { key: "homework", label: "Домашние задания", dot: "#38BDF8" },
    { key: "control", label: "Контрольные", dot: "#F3CE67" },
    { key: "variants", label: "Варианты", dot: "#90A1B9" },
];

const CAT_HINT: Record<CatKey, string> = {
    tutorial: "Теория и разобранные примеры",
    homework: "Задачи для самостоятельной работы",
    control: "Проверка знаний по номеру",
    variants: "Полный набор задач экзамена",
};

const CAT_NAME: Record<CatKey, string> = {
    tutorial: "Разбор",
    homework: "Домашнее задание",
    control: "Контрольная",
    variants: "Вариант",
};

const TAG_LABEL: Record<CatKey, string> = {
    tutorial: "Разбор",
    homework: "ДЗ",
    control: "Контрольная",
    variants: "Вариант",
};

const TONE: Record<CatKey, string> = { tutorial: "em", homework: "sky", control: "am", variants: "plain" };

const COURSE: Record<string, string> = { year: "Годовой", summer: "Летний", common: "Общий" };

export type NewTopicParams = {
    title: string;
    subject: SubjectId;
    exam: ExamType;
    cat: CatKey;
    /** Для вариантов: пробный (строго по времени) или тренировочный. */
    trial: boolean;
    egeNumber: number | null;
};

export type KompegeImportParams = NewTopicParams & { variantId: number };

type Props = {
    topics: TopicAdmin[];
    loading: boolean;
    onOpen: (id: number) => void;
    onStats: (id: number) => void;
    onToggleTasks: (topic: TopicAdmin) => Promise<void> | void;
    onToggleGroups: (topic: TopicAdmin) => Promise<void> | void;
    onDelete: (id: number) => Promise<void> | void;
    onCreate: (params: NewTopicParams) => Promise<void>;
    onImportKompege: (params: KompegeImportParams) => Promise<void>;
    onImportFile: () => void;
};

const subjectOf = (t: TopicAdmin): SubjectId => (t.subject === "math" || String(t.category) === "math" ? "math" : "informatics");
const examOf = (t: TopicAdmin): ExamType => (t.exam_type === "oge" ? "oge" : "ege");
const catOf = (t: TopicAdmin): CatKey => {
    const c = String(t.category);
    if (c === "mock" || c === "variants") return "variants";
    if (c === "homework" || c === "control") return c;
    return "tutorial";
};
const isTrial = (t: TopicAdmin) => String(t.category) === "mock" || t.is_mock;
const numRange = (t: TopicAdmin): [number, number] | null =>
    t.ege_number == null ? null : [t.ege_number, Math.max(t.ege_number, t.ege_number_end ?? t.ege_number)];
const numLabel = (t: TopicAdmin) => {
    const r = numRange(t);
    if (!r) return "—";
    return r[1] > r[0] ? `${r[0]}–${r[1]}` : String(r[0]);
};
const plural = (n: number) => {
    const m = n % 10;
    const h = n % 100;
    return `${n} ${m === 1 && h !== 11 ? "задача" : m >= 2 && m <= 4 && (h < 12 || h > 14) ? "задачи" : "задач"}`;
};

function readView(): { subject?: SubjectId; exam?: ExamType; cat?: string; num?: number } {
    try {
        return JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}");
    } catch {
        return {};
    }
}

export function TopicsPanel(props: Props) {
    const { topics, loading } = props;
    const saved = useMemo(readView, []);
    const [subject, setSubject] = useState<SubjectId>(saved.subject ?? "informatics");
    const [exam, setExam] = useState<ExamType>(saved.exam ?? "ege");
    const [cat, setCat] = useState<"all" | CatKey>((saved.cat as "all" | CatKey) ?? "all");
    const [num, setNum] = useState<number>(saved.num ?? 0);
    const [query, setQuery] = useState("");
    const [subjOpen, setSubjOpen] = useState(false);
    const [askDel, setAskDel] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [wizard, setWizard] = useState<Partial<WizardState> | null>(null);

    useEffect(() => {
        try {
            sessionStorage.setItem(VIEW_KEY, JSON.stringify({ subject, exam, cat, num }));
        } catch { /* sessionStorage недоступен */ }
    }, [subject, exam, cat, num]);

    const subj = SUBJECTS.find((s) => s.id === subject)!;
    const base = useMemo(() => topics.filter((t) => subjectOf(t) === subject && examOf(t) === exam), [topics, subject, exam]);
    const maxN = useMemo(() => {
        const fromData = base.reduce((m, t) => Math.max(m, numRange(t)?.[1] ?? 0), 0);
        return Math.max(subj.max[exam], fromData);
    }, [base, subj, exam]);

    const q = query.trim().toLowerCase();
    const byQ = (t: TopicAdmin) => !q || t.title.toLowerCase().includes(q) || numLabel(t).toLowerCase().includes(q);
    const byNum = (t: TopicAdmin, n: number) => {
        if (!n) return true;
        const r = numRange(t);
        return !!r && n >= r[0] && n <= r[1];
    };
    const byCat = (t: TopicAdmin, c: "all" | CatKey) => c === "all" || catOf(t) === c;

    const catCounts = CATS.map((c) => ({ ...c, count: base.filter((t) => byCat(t, c.key) && byNum(t, num) && byQ(t)).length }));
    const allCount = base.filter((t) => byNum(t, num) && byQ(t)).length;
    const numCells = Array.from({ length: maxN }, (_, i) => i + 1).map((n) => ({
        n,
        count: base.filter((t) => byCat(t, cat) && byNum(t, n) && byQ(t)).length,
    }));

    const list = base.filter((t) => byCat(t, cat) && byNum(t, num) && byQ(t));
    const sorter = (a: TopicAdmin, b: TopicAdmin) =>
        (numRange(a)?.[0] ?? 0) - (numRange(b)?.[0] ?? 0) ||
        CATS.findIndex((c) => c.key === catOf(a)) - CATS.findIndex((c) => c.key === catOf(b)) ||
        a.order_index - b.order_index ||
        a.id - b.id;
    const groups =
        cat === "all"
            ? CATS.map((c) => ({ ...c, showHead: true, rows: list.filter((t) => catOf(t) === c.key).sort(sorter) })).filter((g) => g.rows.length)
            : list.length
              ? [{ key: cat, label: "", dot: "transparent", showHead: false, rows: list.slice().sort(sorter) }]
              : [];

    const cover = num
        ? (["tutorial", "homework", "control"] as CatKey[]).map((k) => {
              const items = base.filter((t) => catOf(t) === k && byNum(t, num));
              return { key: k, items, tasks: items.reduce((s, t) => s + t.task_count, 0) };
          })
        : [];

    const guard = async (fn: () => Promise<void> | void) => {
        try {
            setError("");
            await fn();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось выполнить действие");
        }
    };

    const openWizard = (patch: Partial<WizardState> = {}) =>
        setWizard({
            cat: cat === "all" ? "tutorial" : cat,
            subject,
            exam,
            egeNumber: num || 1,
            ...patch,
        });

    const emptyTitle = q
        ? "Ничего не найдено"
        : base.length === 0
          ? `${subj.label} · ${exam === "ege" ? "ЕГЭ" : "ОГЭ"}: топиков пока нет`
          : num
            ? `По заданию ${num} здесь пока пусто`
            : "В этом разделе пока нет топиков";

    const crumbs = [subj.label, exam === "ege" ? "ЕГЭ" : "ОГЭ", cat === "all" ? "Все разделы" : CATS.find((c) => c.key === cat)!.label];
    if (num) crumbs.push(`Задание ${num}`);

    return (
        <div className="tp">
            <div className="tp-body">
                <aside className="tp-nav" aria-label="Навигация по топикам">
                    <div className="tp-block">
                        <div className="tp-subj-wrap">
                            <button type="button" className="tp-subj" aria-haspopup="listbox" aria-expanded={subjOpen} onClick={() => setSubjOpen((v) => !v)}>
                                <span className="tp-subj-badge" style={{ background: subj.color }}>{subj.letter}</span>
                                <span className="tp-subj-text">
                                    <b style={{ fontSize: 15 }}>{subj.label}</b>
                                    <small>{topics.filter((t) => subjectOf(t) === subject).length} топиков</small>
                                </span>
                                <ChevronDown size={18} aria-hidden />
                            </button>
                            {subjOpen && (
                                <>
                                    <button type="button" className="tp-pop-scrim" aria-label="Закрыть список предметов" onClick={() => setSubjOpen(false)} />
                                    <div className="tp-pop" role="listbox" aria-label="Предмет">
                                        {SUBJECTS.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                role="option"
                                                aria-selected={s.id === subject}
                                                className="tp-pop-opt"
                                                onClick={() => { setSubject(s.id); setCat("all"); setNum(0); setSubjOpen(false); }}
                                            >
                                                <span className="tp-subj-badge" style={{ background: s.color }}>{s.letter}</span>
                                                <span style={{ flex: 1 }}>{s.label}</span>
                                                <span className="tp-cat-count">{topics.filter((t) => subjectOf(t) === s.id).length}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="tp-seg">
                            {(["ege", "oge"] as ExamType[]).map((e) => (
                                <button key={e} type="button" aria-pressed={exam === e} onClick={() => { setExam(e); setNum(0); }}>
                                    {e === "ege" ? "ЕГЭ" : "ОГЭ"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="tp-block">
                        <span className="tp-label">Раздел</span>
                        <div className="tp-cats tp-strip">
                            <button type="button" className="tp-cat" aria-pressed={cat === "all"} data-zero={allCount === 0} onClick={() => setCat("all")}>
                                <span className="tp-cat-dot" style={{ background: "var(--tp-muted)" }} />
                                <span className="tp-cat-name">Все топики</span>
                                <span className="tp-cat-count">{allCount}</span>
                            </button>
                            {catCounts.map((c) => (
                                <button key={c.key} type="button" className="tp-cat" aria-pressed={cat === c.key} data-zero={c.count === 0} onClick={() => setCat(c.key)}>
                                    <span className="tp-cat-dot" style={{ background: c.dot }} />
                                    <span className="tp-cat-name">{c.label}</span>
                                    <span className="tp-cat-count">{c.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="tp-block">
                        <div className="tp-block-head">
                            <span className="tp-label">Номер задания</span>
                            {num > 0 && <button type="button" className="tp-link" onClick={() => setNum(0)}>Все номера</button>}
                        </div>
                        <div className="tp-nums tp-strip">
                            {numCells.map(({ n, count }) => (
                                <button
                                    key={n}
                                    type="button"
                                    className="tp-num"
                                    aria-pressed={num === n}
                                    data-zero={count === 0}
                                    aria-label={`Задание ${n}, топиков: ${count}`}
                                    onClick={() => setNum(num === n ? 0 : n)}
                                >
                                    <b>{n}</b>
                                    <span>{count}</span>
                                </button>
                            ))}
                        </div>
                        <span className="tp-hint">Цифра под номером — сколько топиков в выбранном разделе</span>
                    </div>
                </aside>

                <section className="tp-main">
                    <div className="tp-toolbar">
                        <label className="tp-search">
                            <Search size={16} aria-hidden />
                            <input type="text" autoComplete="off" placeholder="Поиск по названию или номеру" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </label>
                        <nav className="tp-crumbs" aria-label="Путь">
                            {crumbs.map((c, i) => (
                                <span key={c} className={i >= 2 ? "is-cur" : undefined}>
                                    {c}
                                    {i < crumbs.length - 1 && <ChevronRight size={14} aria-hidden />}
                                </span>
                            ))}
                        </nav>
                        <button type="button" className="tp-btn-primary tp-toolbar-create" onClick={() => openWizard()}>
                            <Plus size={16} strokeWidth={2.4} aria-hidden />
                            Новый топик
                        </button>
                    </div>

                    {error && (
                        <div role="alert" className="tp-notice">
                            <span>{error}</span>
                            <button type="button" aria-label="Закрыть" onClick={() => setError("")}><X size={18} /></button>
                        </div>
                    )}

                    {cover.length > 0 && (
                        <div className="tp-cover">
                            {cover.map((c) => {
                                const empty = c.items.length === 0;
                                const tone = TONE[c.key];
                                return (
                                    <div
                                        key={c.key}
                                        className="tp-cover-card"
                                        data-empty={empty}
                                        data-on={cat === c.key}
                                        style={empty ? undefined : { background: `var(--tp-${tone}-bg)`, borderColor: cat === c.key ? undefined : `var(--tp-${tone}-border)`, color: `var(--tp-${tone}-text)` }}
                                    >
                                        <button type="button" className="tp-cover-pick" onClick={() => setCat(cat === c.key ? "all" : c.key)}>
                                            <small>{CAT_NAME[c.key]}</small>
                                            <b>{empty ? "Нет топика" : c.items.length === 1 ? "1 топик" : `${c.items.length} топика`}</b>
                                            <span>{empty ? "По этому номеру ничего нет" : `${c.tasks} задач в сумме`}</span>
                                        </button>
                                        {empty && (
                                            <button type="button" className="tp-cover-create" onClick={() => openWizard({ cat: c.key, egeNumber: num, method: "manual", step: "params" })}>
                                                <Plus size={14} strokeWidth={2.4} aria-hidden />
                                                Создать
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {loading ? (
                        [1, 2, 3].map((i) => <div key={i} className="tp-skel" />)
                    ) : (
                        groups.map((g) => (
                            <section key={g.key} className="tp-group">
                                {g.showHead && (
                                    <div className="tp-group-head">
                                        <span className="tp-cat-dot" style={{ background: g.dot }} />
                                        <b>{g.label}</b>
                                        <span>{g.rows.length}</span>
                                    </div>
                                )}
                                {g.rows.map((t) => {
                                    const ck = catOf(t);
                                    const trial = ck === "variants" && isTrial(t);
                                    const hidden = t.show_in_tasks === false;
                                    return (
                                        <div key={t.id} className="tp-row">
                                            <div className="tp-row-n">
                                                <span className="tp-n" data-empty={t.ege_number == null}>{numLabel(t)}</span>
                                            </div>
                                            <div className="tp-row-body">
                                                <div className="tp-row-ico"><FolderOpen size={20} aria-hidden /></div>
                                                <div className="tp-row-text">
                                                    <button type="button" className="tp-row-title" onClick={() => props.onOpen(t.id)}>{t.title}</button>
                                                    <div className="tp-tags">
                                                        <span className="tp-tag" data-tone={trial ? "bad" : TONE[ck]}>
                                                            {ck === "variants" ? (trial ? "Пробный вариант" : "Тренировочный вариант") : TAG_LABEL[ck]}
                                                        </span>
                                                        {t.open_to_groups && <span className="tp-tag" data-tone="sky">Для групп</span>}
                                                        {hidden && <span className="tp-tag">Скрыт</span>}
                                                        <small>{plural(t.task_count)} · {COURSE[t.course_type ?? "year"] ?? "Годовой"}</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="tp-act">
                                                {askDel === t.id ? (
                                                    <>
                                                        <span className="tp-ask">Удалить вместе с задачами?</span>
                                                        <button type="button" className="tp-yes" onClick={() => guard(async () => { await props.onDelete(t.id); setAskDel(null); })}>Да</button>
                                                        <button type="button" className="tp-no" onClick={() => setAskDel(null)}>Отмена</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" className="tp-ico-btn" title="Редактировать задачи" aria-label="Открыть топик и редактировать задачи" onClick={() => props.onOpen(t.id)}>
                                                            <Pencil size={17} aria-hidden />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="tp-ico-btn"
                                                            data-on={!hidden}
                                                            data-tone="em"
                                                            title={hidden ? "Показать в разделе «Задания»" : "Скрыть из раздела «Задания»"}
                                                            aria-label={hidden ? "Показать в разделе «Задания»" : "Скрыть из раздела «Задания»"}
                                                            onClick={() => guard(() => props.onToggleTasks(t))}
                                                        >
                                                            {hidden ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="tp-ico-btn"
                                                            data-on={t.open_to_groups}
                                                            data-tone="sky"
                                                            title={t.open_to_groups ? "Открыть для всех учеников" : "Открыть только группам"}
                                                            aria-label={t.open_to_groups ? "Открыть для всех учеников" : "Открыть только группам"}
                                                            onClick={() => guard(() => props.onToggleGroups(t))}
                                                        >
                                                            <Users size={17} aria-hidden />
                                                        </button>
                                                        <button type="button" className="tp-ico-btn" title="Статистика" aria-label="Статистика" onClick={() => props.onStats(t.id)}>
                                                            <Download size={17} aria-hidden />
                                                        </button>
                                                        <button type="button" className="tp-ico-btn" data-quiet="true" title="Удалить" aria-label="Удалить" onClick={() => setAskDel(t.id)}>
                                                            <Trash2 size={17} aria-hidden />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>
                        ))
                    )}

                    {!loading && groups.length === 0 && (
                        <div className="tp-empty">
                            <b>{emptyTitle}</b>
                            <span>{q ? "Попробуйте другое название или сбросьте номер и раздел" : "Создайте топик, и он появится здесь"}</span>
                            <button type="button" className="tp-btn-primary" style={{ minHeight: 44, padding: "0 22px" }} onClick={() => openWizard()}>
                                Создать топик
                            </button>
                        </div>
                    )}
                </section>
            </div>

            {wizard && (
                <CreateWizard
                    initial={wizard}
                    onClose={() => setWizard(null)}
                    onCreate={props.onCreate}
                    onImportKompege={props.onImportKompege}
                    onImportFile={props.onImportFile}
                />
            )}
        </div>
    );
}

/* ── Мастер создания топика ─────────────────────────── */

type WizardState = {
    step: "method" | "source" | "params";
    method: "" | "import" | "manual";
    src: "kompege" | "file";
    kid: string;
    subject: SubjectId;
    exam: ExamType;
    cat: CatKey;
    trial: boolean;
    egeNumber: number | null;
    title: string;
};

function defaultTitle(w: WizardState, subjectLabel: string) {
    if (w.cat === "variants") return w.trial ? "Пробный вариант" : "Тренировочный вариант";
    if (w.egeNumber == null) return `${subjectLabel} · подборка заданий`;
    return `${subjectLabel} · задание ${w.egeNumber}`;
}

function CreateWizard({
    initial,
    onClose,
    onCreate,
    onImportKompege,
    onImportFile,
}: {
    initial: Partial<WizardState>;
    onClose: () => void;
    onCreate: Props["onCreate"];
    onImportKompege: Props["onImportKompege"];
    onImportFile: () => void;
}) {
    const [w, setW] = useState<WizardState>({
        step: "method",
        method: "",
        src: "kompege",
        kid: "",
        subject: "informatics",
        exam: "ege",
        cat: "tutorial",
        trial: false,
        egeNumber: 1,
        title: "",
        ...initial,
    });
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [subjOpen, setSubjOpen] = useState(false);

    const set = (p: Partial<WizardState>) => setW((o) => ({ ...o, ...p }));
    const subj = SUBJECTS.find((s) => s.id === w.subject)!;
    const maxNum = subj.max[w.exam];
    const flow: WizardState["step"][] = w.method === "import" ? ["method", "source", "params"] : ["method", "params"];
    const at = Math.max(0, flow.indexOf(w.step));
    const STEP_LABEL = { method: "Способ", source: "Источник", params: "Параметры" } as const;
    const tlim = w.exam === "ege" ? "3 ч 55 мин" : "2 ч 30 мин";
    const needsNum = w.cat !== "variants";
    const fileImport = w.method === "import" && w.src === "file";

    const params = (): NewTopicParams => ({
        title: w.title.trim() || defaultTitle(w, subj.label),
        subject: w.subject,
        exam: w.exam,
        cat: w.cat,
        trial: w.trial,
        egeNumber: needsNum && w.egeNumber != null ? Math.min(w.egeNumber, maxNum) : null,
    });

    const next = async () => {
        setErr("");
        if (w.step === "source") {
            if (w.src === "kompege" && !/^\d{5,}$/.test(w.kid.trim())) {
                setErr("Введите номер варианта с kompege.ru: только цифры, от 5 знаков");
                return;
            }
            if (w.src === "file") {
                onImportFile();
                return;
            }
            set({ step: "params" });
            return;
        }
        try {
            setBusy(true);
            if (w.method === "import") await onImportKompege({ ...params(), variantId: Number(w.kid.trim()) });
            else await onCreate(params());
            onClose();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Не удалось создать топик");
        } finally {
            setBusy(false);
        }
    };

    const back = () => {
        setErr("");
        set({ step: flow[Math.max(0, at - 1)] });
    };

    const nextLabel =
        w.step === "params"
            ? busy ? "Создаём…" : w.method === "import" ? "Импортировать и создать" : "Создать топик"
            : fileImport ? "Открыть импорт из файла" : "Далее";

    return (
        <div className="tp-overlay">
            <button type="button" className="tp-scrim" aria-label="Закрыть" onClick={() => !busy && onClose()} />
            <div className="tp-wiz" role="dialog" aria-modal="true" aria-label="Новый топик">
                <div className="tp-wiz-head">
                    <div className="tp-wiz-head-row">
                        <b>Новый топик</b>
                        <button type="button" className="tp-wiz-x" aria-label="Закрыть" onClick={onClose} disabled={busy}><X size={18} /></button>
                    </div>
                    <div className="tp-steps tp-strip">
                        {flow.map((k, i) => (
                            <span key={k} className="tp-step" data-cur={i === at} data-done={i < at}>
                                <i>{i < at ? "✓" : i + 1}</i>
                                {STEP_LABEL[k]}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="tp-wiz-body">
                    {w.step === "method" && (
                        <>
                            <span className="tp-muted">Как хотите создать топик?</span>
                            <div className="tp-g2">
                                <button type="button" className="tp-method" data-accent="true" onClick={() => set({ method: "import", step: "source" })}>
                                    <span className="tp-m-ico"><Download size={22} aria-hidden /></span>
                                    <b>Быстрый импорт</b>
                                    <span>Задачи подтянутся сами: с Kompege по номеру варианта или из файла в особом оформлении</span>
                                </button>
                                <button type="button" className="tp-method" onClick={() => set({ method: "manual", step: "params" })}>
                                    <span className="tp-m-ico"><Plus size={22} aria-hidden /></span>
                                    <b>Новый топик</b>
                                    <span>Пустой топик с нуля. Задачи добавите вручную в редакторе</span>
                                </button>
                            </div>
                        </>
                    )}

                    {w.step === "source" && (
                        <>
                            <div className="tp-seg" style={{ alignSelf: "flex-start" }}>
                                {([["kompege", "Kompege"], ["file", "Из файла"]] as const).map(([k, l]) => (
                                    <button key={k} type="button" aria-pressed={w.src === k} style={{ padding: "0 18px", minHeight: 36 }} onClick={() => { set({ src: k }); setErr(""); }}>{l}</button>
                                ))}
                            </div>
                            {w.src === "kompege" ? (
                                <>
                                    <label className="tp-field">
                                        <span className="tp-label" style={{ fontSize: 12 }}>Номер варианта</span>
                                        <input type="text" inputMode="numeric" autoComplete="off" placeholder="Например, 25159856" value={w.kid} onChange={(e) => set({ kid: e.target.value })} />
                                    </label>
                                    <span className="tp-muted">Номер варианта на kompege.ru. Задания подтянутся вместе с ответами, перед публикацией их можно отредактировать</span>
                                </>
                            ) : (
                                <div className="tp-card-note">
                                    <b><FileText size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />Нужен текстовый документ в особом стиле оформления</b>
                                    <span>Как сейчас в импорте PDF / LaTeX: задания, ответы и разбор размечены по шаблону. Файл выбирается на следующем экране</span>
                                </div>
                            )}
                        </>
                    )}

                    {w.step === "params" && (
                        <>
                            <div className="tp-block">
                                <span className="tp-label">1. Экзамен</span>
                                <div className="tp-chips">
                                    {(["ege", "oge"] as ExamType[]).map((e) => (
                                        <button key={e} type="button" className="tp-chip is-wide" aria-pressed={w.exam === e} onClick={() => set({ exam: e, egeNumber: w.egeNumber == null ? null : Math.min(w.egeNumber, subj.max[e]) })}>
                                            {e === "ege" ? "ЕГЭ" : "ОГЭ"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tp-block">
                                <span className="tp-label">2. Предмет</span>
                                <div className="tp-subj-wrap" style={{ maxWidth: 420 }}>
                                    <button type="button" className="tp-subj" aria-haspopup="listbox" aria-expanded={subjOpen} onClick={() => setSubjOpen((v) => !v)}>
                                        <span className="tp-subj-badge" style={{ background: subj.color }}>{subj.letter}</span>
                                        <b style={{ flex: 1 }}>{subj.label}</b>
                                        <ChevronDown size={18} aria-hidden />
                                    </button>
                                    {subjOpen && (
                                        <>
                                            <button type="button" className="tp-pop-scrim" style={{ zIndex: 64 }} aria-label="Закрыть список" onClick={() => setSubjOpen(false)} />
                                            <div className="tp-pop" style={{ zIndex: 65 }} role="listbox" aria-label="Предмет">
                                                {SUBJECTS.map((s) => (
                                                    <button key={s.id} type="button" role="option" aria-selected={s.id === w.subject} className="tp-pop-opt" onClick={() => { set({ subject: s.id, egeNumber: w.egeNumber == null ? null : Math.min(w.egeNumber, s.max[w.exam]) }); setSubjOpen(false); }}>
                                                        <span className="tp-subj-badge" style={{ background: s.color }}>{s.letter}</span>
                                                        {s.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="tp-hint" style={{ fontSize: 13 }}>Список предметов берётся из «Настройки предметов»</span>
                            </div>

                            <div className="tp-block">
                                <span className="tp-label">3. Тип топика</span>
                                <div className="tp-g4">
                                    {CATS.map((c) => (
                                        <button key={c.key} type="button" className="tp-opt" aria-pressed={w.cat === c.key} onClick={() => set({ cat: c.key })}>
                                            <b>{CAT_NAME[c.key]}</b>
                                            <span>{CAT_HINT[c.key]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {w.cat === "variants" && (
                                <div className="tp-block">
                                    <span className="tp-label">Вид варианта</span>
                                    <div className="tp-g2">
                                        <button type="button" className="tp-opt" style={{ padding: "16px 18px", borderRadius: 16 }} aria-pressed={!w.trial} onClick={() => set({ trial: false })}>
                                            <b style={{ fontSize: 16 }}>Тренировочный</b>
                                            <span style={{ fontSize: 14 }}>Ученик сам выбирает режим при запуске: тренировка без времени или пробник по времени</span>
                                        </button>
                                        <button type="button" className="tp-opt" style={{ padding: "16px 18px", borderRadius: 16 }} aria-pressed={w.trial} onClick={() => set({ trial: true })}>
                                            <b style={{ fontSize: 16 }}>Пробный</b>
                                            <span style={{ fontSize: 14 }}>Строго по времени ({tlim}). Результат появится после проверки преподавателем</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {needsNum && (
                                <div className="tp-block">
                                    <span className="tp-label">Номер задания</span>
                                    <div className="tp-chips">
                                        <button
                                            type="button"
                                            className="tp-chip is-wide"
                                            aria-pressed={w.egeNumber == null}
                                            onClick={() => set({ egeNumber: null })}
                                        >
                                            Без номера
                                        </button>
                                        {Array.from({ length: maxNum }, (_, i) => i + 1).map((n) => (
                                            <button key={n} type="button" className="tp-chip" aria-pressed={w.egeNumber === n} onClick={() => set({ egeNumber: n })}>{n}</button>
                                        ))}
                                    </div>
                                    <span className="tp-hint">«Без номера» — для подборки заданий из любых номеров.</span>
                                </div>
                            )}

                            <label className="tp-field">
                                <span className="tp-label" style={{ fontSize: 12 }}>Название</span>
                                <input type="text" autoComplete="off" value={w.title} placeholder={defaultTitle(w, subj.label)} onChange={(e) => set({ title: e.target.value })} />
                            </label>
                        </>
                    )}

                    {err && <span role="alert" className="tp-err">{err}</span>}
                </div>

                {w.step !== "method" && (
                    <div className="tp-wiz-foot">
                        <button type="button" className="tp-btn-ghost tp-back" onClick={back} disabled={busy}>Назад</button>
                        <button type="button" className="tp-cancel" onClick={onClose} disabled={busy}>Отмена</button>
                        <button type="button" className="tp-btn-primary" style={{ minHeight: 44, padding: "0 24px" }} onClick={next} disabled={busy}>{nextLabel}</button>
                    </div>
                )}
                {w.step === "method" && (
                    <div className="tp-wiz-foot">
                        <button type="button" className="tp-cancel" onClick={onClose}>Отмена</button>
                    </div>
                )}
            </div>
        </div>
    );
}
