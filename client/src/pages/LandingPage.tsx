import React, { useEffect, useRef, useState } from 'react';
import {
  Bot, Sparkles,
  User, CheckCircle2, ShieldCheck,
  CalendarCheck, ClipboardCheck, BrainCircuit,
  Pencil, MousePointer2, Square, Type, Undo2, ThumbsUp, Users,
} from 'lucide-react';
import { LoginModal } from '../components/LoginModal';
import './LandingPage.css';

const SELF_EMPLOYED_NAME = import.meta.env.VITE_SELF_EMPLOYED_NAME?.trim();
const SELF_EMPLOYED_INN = import.meta.env.VITE_SELF_EMPLOYED_INN?.trim();

type SummerSubject = 'informatics' | 'math' | 'physics' | 'russian' | 'english' | 'social';
type AuthTab = 'login' | 'register';

const SUMMER_SUBJECTS: { value: SummerSubject; label: string }[] = [
  { value: 'informatics', label: 'Информатика' },
  { value: 'math', label: 'Математика' },
  { value: 'physics', label: 'Физика' },
  { value: 'russian', label: 'Русский язык' },
  { value: 'english', label: 'Английский' },
  { value: 'social', label: 'Обществознание' },
];

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [modalTab, setModalTab] = useState<AuthTab>('login');
  const [summerSubject, setSummerSubject] = useState<SummerSubject>('informatics');
  const [leadContact, setLeadContact] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [leadError, setLeadError] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [summerBannerOpen, setSummerBannerOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);

  // ── Starfield ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0;
    let mx = 0, my = 0;

    type Star = { x: number; y: number; r: number; a: number; da: number; speed: number };
    type Pt   = { x: number; y: number; vx: number; vy: number; r: number; a: number; green: boolean };
    const stars: Star[] = [];
    const pts: Pt[] = [];

    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 220; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, a: Math.random(), da: (Math.random() - 0.5) * 0.008, speed: Math.random() * 0.06 + 0.01 });
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() * 0.4 + 0.1; pts.push({ x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2 + 0.5, a: Math.random() * 0.5 + 0.1, green: Math.random() > 0.6 }); }

    const onMouse = (e: MouseEvent) => { mx = (e.clientX / window.innerWidth - 0.5) * 18; my = (e.clientY / window.innerHeight - 0.5) * 10; };
    window.addEventListener('mousemove', onMouse);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.a += s.da; if (s.a <= 0 || s.a >= 1) s.da *= -1;
        s.y -= s.speed; if (s.y < 0) { s.y = H; s.x = Math.random() * W; }
        ctx.beginPath(); ctx.arc(s.x + mx * 0.3, s.y + my * 0.2, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a * 0.85})`; ctx.fill();
      }
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x + mx * 0.5, p.y + my * 0.4, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.green ? `rgba(98,170,120,${p.a})` : `rgba(255,255,255,${p.a * 0.4})`; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  // ── Hero parallax ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = heroContentRef.current;
    if (!el) return;
    const fn = () => { const y = window.scrollY; el.style.transform = `translateY(${y * 0.18}px)`; el.style.opacity = String(Math.max(0, 1 - y / 600)); };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── Scroll reveal + counters ──────────────────────────────────────────────
  useEffect(() => {
    const animate = (el: HTMLElement, target: number) => {
      let t0 = 0;
      const step = (ts: number) => {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / 1800, 1);
        const v = Math.round((1 - Math.pow(1 - p, 3)) * target);
        const suffix = target >= 2000 ? '+' : target === 98 ? '%' : target === 87 ? '' : '+';
        el.textContent = v + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        const count = (e.target as HTMLElement).dataset.count;
        if (count) { animate(e.target as HTMLElement, +count); io.unobserve(e.target); }
      }
    }, { threshold: 0.15 });
    document.querySelectorAll('.lp-reveal,.lp-step,.lp-card,[data-count]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const openAuth = (tab: AuthTab = 'login') => {
    setModalTab(tab);
    setShowModal(true);
  };
  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leadContact.trim()) {
      setLeadError('Укажите email или Telegram');
      return;
    }
    setLeadLoading(true);
    setLeadError('');
    setLeadStatus('');
    try {
      const res = await fetch('/api/course-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: summerSubject,
          contact: leadContact.trim(),
          note: summerSubject === 'math' ? 'Уведомить о старте курса' : 'Заявка на новый предмет',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'Не удалось отправить заявку');
      setLeadStatus(data?.message || 'Заявка принята');
      setLeadContact('');
    } catch (err: any) {
      setLeadError(err.message || 'Не удалось отправить заявку');
    } finally {
      setLeadLoading(false);
    }
  };
  const selectedSubjectLabel = SUMMER_SUBJECTS.find(item => item.value === summerSubject)?.label ?? 'предмет';

  return (
    <div className="lp">
      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="lp-nav-icon">И</div>
          Информатика ЕГЭ
        </div>
        <div className="lp-nav-links">
          <a href="#platform" onClick={e => { e.preventDefault(); scrollTo('platform'); }}>Возможности</a>
          <a href="#ai"       onClick={e => { e.preventDefault(); scrollTo('ai'); }}>ИИ-ассистент</a>
          <a href="#subscription" onClick={e => { e.preventDefault(); scrollTo('subscription'); }}>Подписка</a>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-nav-login" onClick={() => openAuth('login')}>Войти</button>
          <button className="lp-nav-cta" onClick={() => setSummerBannerOpen(true)}>Летний курс</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <canvas ref={canvasRef} className="lp-canvas" />
        <div className="lp-hero-glow" />
        <div className="lp-planet lp-planet-earth" aria-hidden="true" />
        <div className="lp-planet lp-planet-galaxy" aria-hidden="true" />
        <div className="lp-hero-shell" ref={heroContentRef}>
          <div className="lp-hero-content">
            <div className="lp-tag"><span className="lp-tag-dot" />Подготовка к ЕГЭ 2026-2027</div>
            <h1 className="lp-h1">
              Актуальные задания
              <em>по информатике и математике</em>
              <span className="lp-h1-line2">в одной платформе</span>
            </h1>
            <p className="lp-hero-sub">
              Только актуальные задания ЕГЭ, ИИ-разбор ошибок и персональный план подготовки
            </p>
            <div className="lp-hero-benefits" aria-label="Преимущества платформы">
              <div className="lp-hero-benefit">
                <span><CalendarCheck size={20} /></span>
                <p>Только актуальные задания ЕГЭ</p>
              </div>
              <div className="lp-hero-benefit">
                <span><ClipboardCheck size={20} /></span>
                <p>ИИ-разбор ошибок и подсказки</p>
              </div>
              <div className="lp-hero-benefit">
                <span><BrainCircuit size={20} /></span>
                <p>Персональный план под твой уровень</p>
              </div>
            </div>
            <div className="lp-hero-btns">
              <button className="lp-btn-primary" onClick={() => openAuth('register')}>Начать подготовку →</button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('platform')}>Посмотреть возможности</button>
            </div>
          </div>

          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-visual-aura" />
            <div className="lp-orbit-line" />
            <div className="lp-depth-card" />
            <div className="lp-task-window">
              <div className="lp-window-dots"><span /><span /><span /></div>
              <div className="lp-task-kicker">ЕГЭ информатика</div>
              <h2>Задание 12</h2>
              <div className="lp-task-lines">
                <i className="is-wide" />
                <i />
                <i className="is-short" />
                <i className="is-medium" />
              </div>
              <div className="lp-task-progress">
                <span />
              </div>
              <div className="lp-solution-chip">
                <Sparkles size={16} />
                <div>
                  <strong>Решение</strong>
                  <span>+1 балл</span>
                </div>
              </div>
            </div>
            <div className="lp-ai-window">
              <div className="lp-ai-window-title">
                <Bot size={19} />
                <strong>ИИ-ассистент</strong>
                <span><Sparkles size={17} /></span>
              </div>
              <p>Объяснение:</p>
              <div className="lp-ai-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="lp-ai-footer">
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="lp-stats">
            <div className="lp-stat"><div className="lp-stat-num" data-count="2400">0</div><div className="lp-stat-lbl">учеников</div></div>
            <div className="lp-stat-div" />
            <div className="lp-stat"><div className="lp-stat-num" data-count="87">0</div><div className="lp-stat-lbl">средний балл</div></div>
            <div className="lp-stat-div" />
            <div className="lp-stat"><div className="lp-stat-num" data-count="27">0</div><div className="lp-stat-lbl">тем и разделов</div></div>
            <div className="lp-stat-div" />
            <div className="lp-stat"><div className="lp-stat-num" data-count="98">0</div><div className="lp-stat-lbl">довольных учеников</div></div>
          </div>
        </div>

        <div className="lp-scroll-hint">
          <span>Прокрути вниз</span>
          <div className="lp-bounce">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </div>
        </div>
      </section>

      {summerBannerOpen ? (
        <aside className="lp-summer-banner" aria-label="Летний курс">
          <button
            type="button"
            className="lp-summer-close"
            onClick={() => setSummerBannerOpen(false)}
            aria-label="Скрыть баннер летнего курса"
          >
            ×
          </button>
          <div className="lp-summer-copy">
            <div className="lp-summer-kicker">Летний курс</div>
            <h2>Начни подготовку заранее</h2>
            <p>Выбери предмет, а мы подскажем следующий шаг.</p>
          </div>

          <div className="lp-summer-form">
            <label className="lp-summer-label" htmlFor="summer-subject">Предмет</label>
            <select
              id="summer-subject"
              value={summerSubject}
              onChange={(event) => {
                setSummerSubject(event.target.value as SummerSubject);
                setLeadStatus('');
                setLeadError('');
              }}
            >
              {SUMMER_SUBJECTS.map(subject => (
                <option key={subject.value} value={subject.value}>{subject.label}</option>
              ))}
            </select>

            {summerSubject === 'informatics' ? (
              <div className="lp-summer-actions">
                <button type="button" className="lp-summer-primary" onClick={() => openAuth('register')}>
                  Зарегистрироваться
                </button>
                <button type="button" className="lp-summer-secondary" onClick={() => openAuth('login')}>
                  Войти
                </button>
              </div>
            ) : (
              <form className="lp-summer-lead" onSubmit={submitLead}>
                <input
                  value={leadContact}
                  onChange={(event) => setLeadContact(event.target.value)}
                  placeholder={summerSubject === 'math' ? 'Email или Telegram' : `Контакт для заявки на ${selectedSubjectLabel.toLowerCase()}`}
                />
                <button type="submit" disabled={leadLoading}>
                  {leadLoading ? 'Отправляем...' : summerSubject === 'math' ? 'Уведомить' : 'Оставить заявку'}
                </button>
              </form>
            )}

            {leadStatus && <div className="lp-summer-status is-success">{leadStatus}</div>}
            {leadError && <div className="lp-summer-status is-error">{leadError}</div>}
          </div>
        </aside>
      ) : null}

      {/* PLATFORM DEMO */}
      <section id="platform" className="lp-section lp-platform-demo">
        <div className="lp-inner">
          <div className="lp-product-header lp-reveal">
            <div className="lp-product-kicker">Как выглядит обучение</div>
            <h2 className="lp-product-title">
              Сомневаешься, <span>начать сейчас?</span>
            </h2>
            <p className="lp-product-sub">
              Рассказываю про уникальные возможности платформы и покажу,<br />
              как они помогут тебе достичь результатов быстрее.
            </p>
          </div>

          <div className="lp-product-demo lp-reveal">
            <div className="lp-board-panel">
              <div className="lp-task-strip">
                <div>
                  <div className="lp-task-strip-top">
                    <span>Задание 13</span>
                    <b>Черновик</b>
                  </div>
                  <p>IP-адрес узла 192.168.10.5, маска 255.255.255.0. Найдите адрес сети.</p>
                </div>
              </div>

              <div className="lp-whiteboard">
                <div className="lp-board-toolbar" aria-hidden="true">
                  <button className="is-active"><Pencil size={18} /></button>
                  <button><MousePointer2 size={17} /></button>
                  <button><Square size={16} /></button>
                  <button><Type size={17} /></button>
                  <button><Undo2 size={17} /></button>
                </div>

                <div className="lp-hand-notes" aria-hidden="true">
                  <div className="lp-note-ip">192.168.10.5</div>
                  <div className="lp-note-and">AND 255.255.255.0</div>
                  <div className="lp-note-arrow is-a">↓</div>
                  <div className="lp-note-arrow is-b">↓</div>
                  <div className="lp-note-arrow is-c">↓</div>
                  <div className="lp-note-binary is-one">11000000.10101000.00001010.00000101</div>
                  <div className="lp-note-binary is-two">11111111.11111111.11111111.<span>00000000</span></div>
                  <div className="lp-note-binary is-three">11000000.10101000.00001010.00000000</div>
                  <div className="lp-note-answer">192.168.10.0</div>
                  <div className="lp-board-glow-dot" />
                </div>
              </div>
            </div>

            <aside className="lp-assistant-card">
              <div className="lp-assistant-head">
                <div className="lp-assistant-icon"><Bot size={18} /></div>
                <h3>ИИ-ассистент</h3>
                <span><Sparkles size={18} /></span>
              </div>
              <div className="lp-assistant-body">
                <p className="lp-assistant-label">Объяснение:</p>
                <p>Маска 255.255.255.0 означает, что первые 24 бита — это сеть, а последние 8 бит — часть узла.</p>
                <p>При побитовом И (AND) оставляем биты сети, а биты узла обнуляем.</p>
                <div className="lp-answer-block">Ответ: <strong>192.168.10.0</strong></div>
                <div className="lp-feedback"><ThumbsUp size={15} />Это объяснение помогло?</div>
              </div>
            </aside>
          </div>

          <div className="lp-feature-row lp-reveal">
            <article className="lp-feature-card">
              <div className="lp-feature-index">01</div>
              <div className="lp-feature-icon"><Pencil size={34} /></div>
              <h3>Пиши решение</h3>
              <p>Задача и доска для хода решения, формул и цветных пометок.</p>
            </article>
            <article className="lp-feature-card">
              <div className="lp-feature-index">02</div>
              <div className="lp-feature-icon"><Bot size={34} /></div>
              <h3>Спроси ИИ</h3>
              <p>Ассистент видит контекст и объясняет следующий шаг.</p>
            </article>
            <article className="lp-feature-card">
              <div className="lp-feature-index">03</div>
              <div className="lp-feature-icon"><Users size={34} /></div>
              <h3>Подключи преподавателя</h3>
              <p>Учитель отвечает в чате и делает пометки на доске.</p>
            </article>
          </div>
        </div>
      </section>

      {/* AI BLOCK */}
      <section id="ai" className="lp-section lp-ai">
        <div className="lp-ai-inner">
          <div className="lp-reveal">
            <div className="lp-section-tag">ИИ-ассистент</div>
            <h2 className="lp-section-h2">Никогда не останешься<br/>один с задачей</h2>
            <p className="lp-section-sub" style={{ marginBottom: 32 }}>
              Застрял на задаче в 23:00? ИИ разберёт шаг за шагом, найдёт ошибку в твоём решении и объяснит почему именно так — без осуждения, сколько угодно раз.
            </p>
            <ul className="lp-checklist">
              {['Объяснит любую тему простым языком', 'Найдёт ошибку в коде или вычислениях', 'Проверит решение и даст обратную связь', 'Подберёт похожие задачи для закрепления'].map((t, i) => (
                <li key={i} className="lp-check"><span className="lp-check-ico">✓</span>{t}</li>
              ))}
            </ul>
          </div>

          <div className="lp-reveal" style={{ transitionDelay: '0.15s' }}>
            <div className="lp-chat">
              <div className="lp-chat-head">
                <div className="lp-chat-dot" />
                <div className="lp-chat-title">ИИ-ассистент</div>
                <div className="lp-chat-online">онлайн</div>
              </div>
              <div className="lp-msg is-user">
                <div className="lp-av is-user"><User size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} /></div>
                <div className="lp-bubble is-user">Не понимаю задание 13. IP-адрес 192.168.10.5, маска 255.255.255.0. Как найти адрес сети?</div>
              </div>
              <div className="lp-msg">
                <div className="lp-av is-bot"><Bot size={14} color="#62aa78" strokeWidth={2} /></div>
                <div className="lp-bubble is-bot">
                  Отлично, разберём! Маска <code>255.255.255.0</code> означает, что первые 3 октета — это сеть, последний — хост.<br/><br/>
                  Применяем AND побитово:<br/>
                  <code>192.168.10.5 AND 255.255.255.0 = 192.168.10.0</code><br/><br/>
                  Адрес сети: <strong>192.168.10.0</strong>
                </div>
              </div>
              <div className="lp-msg is-user">
                <div className="lp-av is-user"><User size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} /></div>
                <div className="lp-bubble is-user">А если маска /26?</div>
              </div>
              <div className="lp-msg">
                <div className="lp-av is-bot"><Bot size={14} color="#62aa78" strokeWidth={2} /></div>
                <div className="lp-typing"><div className="lp-dot"/><div className="lp-dot"/><div className="lp-dot"/></div>
              </div>
              <div className="lp-chat-input">
                <div className="lp-input-ph">Задай вопрос ассистенту...</div>
                <div className="lp-send-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUBSCRIPTION */}
      <section id="subscription" className="lp-section lp-subscription">
        <div className="lp-inner">
          <div className="lp-subscription-layout">
            <div className="lp-pricing-grid">
              <div className="lp-price-card lp-price-card-featured lp-card">
                <div className="lp-price-top">
                  <div>
                    <div className="lp-price-kicker">Подписка</div>
                    <h3>Lite Access</h3>
                  </div>
                  <span className="lp-price-badge is-featured">-84%</span>
                </div>
                <p className="lp-price-desc">Полный доступ к платформе: практика, разборы, ИИ-помощник и личный прогресс в одном кабинете.</p>
                <div className="lp-price-row">
                  <span className="lp-price">990 ₽</span>
                  <span className="lp-price-period">за доступ</span>
                </div>
                <div className="lp-price-old">Обычная стоимость аналогичной подготовки выше</div>
                <ul className="lp-price-list">
                  {['Все задания ЕГЭ', 'ИИ-ассистент 24/7', 'Персональный план подготовки', 'Разборы, теория и варианты', 'Сохранение решений и прогресса', 'Чат и поддержка в обучении'].map(item => (
                    <li key={item}><CheckCircle2 size={17} />{item}</li>
                  ))}
                </ul>
                <button className="lp-price-action is-featured" onClick={() => openAuth('register')}>Получить Lite</button>
              </div>
            </div>

            <div className="lp-subscription-header lp-reveal">
              <div className="lp-section-tag">Подписка</div>
              <h2 className="lp-section-h2">Открой полный доступ<br/>к подготовке</h2>
              <p className="lp-section-sub">
                Lite включает задания, разборы, ИИ-помощника, сохранение решений и персональный план подготовки.
              </p>
            </div>
          </div>

          <div className="lp-subscription-note lp-reveal">
            <ShieldCheck size={18} />
            <span>Доступ активируется после оплаты в личном кабинете. Первые пробные задания доступны без подписки.</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="lp-cta-inner lp-reveal">
          <h2 className="lp-cta-h2">Начни готовиться<br/>к ЕГЭ <em>прямо сейчас</em></h2>
          <p className="lp-cta-sub">Тысячи учеников уже на пути к высокому баллу.</p>
          <button className="lp-btn-primary" onClick={() => openAuth('register')}>Войти / Зарегистрироваться →</button>
        </div>
      </section>

      {showModal && <LoginModal initialTab={modalTab} onClose={() => setShowModal(false)} />}

      {showContacts && (
        <div className="lp-contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={() => setShowContacts(false)}>
          <div className="lp-contact-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lp-contact-close"
              onClick={() => setShowContacts(false)}
              aria-label="Закрыть контакты"
            >
              ×
            </button>
            <div className="lp-contact-kicker">Контакты</div>
            <h2 id="contact-title">Божко Вадим Дмитриевич</h2>
            <p className="lp-contact-lead">
              Создатель проекта и преподаватель по информатике и математике.
            </p>

            <div className="lp-contact-list">
              <div className="lp-contact-row">
                <span>Почта для контакта</span>
                <a href="mailto:vadiqbozhko@gmail.com">vadiqbozhko@gmail.com</a>
              </div>
              <div className="lp-contact-row">
                <span>Telegram</span>
                <a href="https://t.me/rancheasy" target="_blank" rel="noreferrer">@rancheasy</a>
              </div>
              <div className="lp-contact-row">
                <span>Статус для приема платежей</span>
                <strong>самозанятый</strong>
              </div>
              {SELF_EMPLOYED_INN ? (
                <div className="lp-contact-row">
                  <span>ИНН</span>
                  <strong>{SELF_EMPLOYED_INN}</strong>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-legal">
          <div className="lp-footer-copy">Copyright © 2025-2026</div>
          <div className="lp-footer-details">
            {SELF_EMPLOYED_NAME ? (
              <div>{SELF_EMPLOYED_NAME}</div>
            ) : null}
            {SELF_EMPLOYED_INN ? (
              <div>ИНН {SELF_EMPLOYED_INN}</div>
            ) : null}
            <div>Статус: самозанятый</div>
          </div>
        </div>
        <div className="lp-footer-links">
          <a href="#">О платформе</a>
          <a href="/podgotovka-ege-informatika.html">ЕГЭ информатика</a>
          <a href="/podgotovka-ege-matematika.html">ЕГЭ математика</a>
          <a href="/podgotovka-ege-irkutsk.html">ЕГЭ Иркутск</a>
          <a href="/terms">Условия</a><a href="/privacy">Политика</a>
          <button type="button" onClick={() => setShowContacts(true)}>Контакты</button>
        </div>
      </footer>
    </div>
  );
}
