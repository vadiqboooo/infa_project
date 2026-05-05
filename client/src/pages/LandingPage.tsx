import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair, BookOpen, Bot, Zap,
  Route, Sparkles, BookMarked, MessageCircle, TrendingUp, GraduationCap,
  User,
} from 'lucide-react';
import { LoginModal } from '../components/LoginModal';
import './LandingPage.css';

const IC = { size: 26, color: 'rgba(255,255,255,0.85)', strokeWidth: 1.8 } as const;
const IC_SM = { size: 22, color: '#62aa78', strokeWidth: 1.8 } as const;

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
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

  return (
    <div className="lp">
      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="lp-nav-icon">И</div>
          Информатика ЕГЭ
        </div>
        <div className="lp-nav-links">
          <a href="#how"      onClick={e => { e.preventDefault(); scrollTo('how'); }}>Как работает</a>
          <a href="#features" onClick={e => { e.preventDefault(); scrollTo('features'); }}>Возможности</a>
          <a href="#ai"       onClick={e => { e.preventDefault(); scrollTo('ai'); }}>ИИ-ассистент</a>
        </div>
        <button className="lp-nav-cta" onClick={() => setShowModal(true)}>Войти</button>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <canvas ref={canvasRef} className="lp-canvas" />
        <div className="lp-hero-glow" />
        <div className="lp-hero-content" ref={heroContentRef}>
          <div className="lp-tag"><span className="lp-tag-dot" />Подготовка к ЕГЭ 2025</div>
          <h1 className="lp-h1">
            Сдай ЕГЭ по <em>информатике</em>
            <span className="lp-h1-line2">на 90+ баллов</span>
          </h1>
          <p className="lp-hero-sub">
            Персональный план обучения, ИИ-ассистент который разберёт каждую ошибку, и опытный преподаватель — всё в одном месте.
          </p>
          <div className="lp-hero-btns">
            <button className="lp-btn-primary" onClick={() => setShowModal(true)}>Войти в платформу →</button>
            <button className="lp-btn-secondary" onClick={() => scrollTo('how')}>Как это работает</button>
          </div>
        </div>

        <div className="lp-stats">
          <div className="lp-stat"><div className="lp-stat-num" data-count="2400">0</div><div className="lp-stat-lbl">учеников</div></div>
          <div className="lp-stat-div" />
          <div className="lp-stat"><div className="lp-stat-num" data-count="87">0</div><div className="lp-stat-lbl">средний балл</div></div>
          <div className="lp-stat-div" />
          <div className="lp-stat"><div className="lp-stat-num" data-count="27">0</div><div className="lp-stat-lbl">тем и заданий</div></div>
          <div className="lp-stat-div" />
          <div className="lp-stat"><div className="lp-stat-num" data-count="98">0</div><div className="lp-stat-lbl">% довольных</div></div>
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

      {/* HOW IT WORKS */}
      <section id="how" className="lp-section lp-how">
        <div className="lp-inner">
          <div className="lp-how-header lp-reveal">
            <div className="lp-section-tag">Как это работает</div>
            <h2 className="lp-section-h2">От нуля до результата<br/>за 4 простых шага</h2>
            <p className="lp-section-sub">Никакой воды — только чёткий путь к высокому баллу</p>
          </div>
          <div className="lp-steps">
            {[
              { icon: <Crosshair {...IC} />, title: 'Диагностика',               text: 'Проходишь входной тест, ИИ определяет слабые места и составляет персональный план',          delay: '0s' },
              { icon: <BookOpen   {...IC} />, title: 'Разбор с преподавателем',   text: 'Видеоразборы сложных задач от опытного педагога с объяснением каждого шага',                   delay: '0.12s' },
              { icon: <Bot        {...IC} />, title: 'Практика с ИИ',             text: 'Решаешь задачи, ИИ мгновенно находит ошибку и объясняет как её исправить',                      delay: '0.24s' },
              { icon: <Zap        {...IC} />, title: 'Результат',                  text: 'Отслеживаешь прогресс, получаешь мотивацию и сдаёшь ЕГЭ уверенно',                             delay: '0.36s' },
            ].map((s, i) => (
              <div key={i} className="lp-step" style={{ transitionDelay: s.delay }}>
                <div className="lp-step-circle">
                  {s.icon}
                  <div className="lp-step-num">{i + 1}</div>
                </div>
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-text">{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lp-section lp-features">
        <div className="lp-inner">
          <div className="lp-features-header lp-reveal">
            <div className="lp-section-tag">Возможности платформы</div>
            <h2 className="lp-section-h2">Всё что нужно<br/>для высокого балла</h2>
          </div>
          <div className="lp-grid">
            {[
              { icon: <Route          {...IC_SM} />, title: 'Персональный план обучения', text: 'ИИ анализирует твои ответы и строит маршрут: сначала слабые темы, потом сложные. Никакого лишнего материала.', delay: '0s' },
              { icon: <Sparkles      {...IC_SM} />, title: 'ИИ-ассистент 24/7',         text: 'Задай любой вопрос в любое время. ИИ разберёт ошибку, объяснит тему и покажет правильный путь решения.',    delay: '0.08s' },
              { icon: <BookMarked    {...IC_SM} />, title: 'Разборы преподавателя',      text: 'Видео и текстовые разборы каждой задачи от опытного педагога. Понимаешь не только ответ, но и логику.',       delay: '0.16s' },
              { icon: <MessageCircle {...IC_SM} />, title: 'Чат без ограничений',        text: 'Общайся с другими учениками и преподавателями. Нет глупых вопросов — есть только путь к знаниям.',           delay: '0.24s' },
              { icon: <TrendingUp    {...IC_SM} />, title: 'Статистика и мотивация',     text: 'Видишь прогресс по каждой теме. Стрики, достижения и напоминания помогают не бросить на полпути.',            delay: '0.32s' },
              { icon: <GraduationCap {...IC_SM} />, title: '27 тем — все задания ЕГЭ',  text: 'От IP-адресов до логических уравнений. Карточки с разборами и самостоятельными заданиями по каждой теме.',    delay: '0.40s' },
            ].map((f, i) => (
              <div key={i} className="lp-card" style={{ transitionDelay: f.delay }}>
                <div className="lp-card-icon">{f.icon}</div>
                <div className="lp-card-title">{f.title}</div>
                <div className="lp-card-text">{f.text}</div>
              </div>
            ))}
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

      {/* CTA */}
      <section className="lp-cta">
        <div className="lp-cta-inner lp-reveal">
          <h2 className="lp-cta-h2">Начни готовиться<br/>к ЕГЭ <em>прямо сейчас</em></h2>
          <p className="lp-cta-sub">Тысячи учеников уже на пути к высокому баллу.</p>
          <button className="lp-btn-primary" onClick={() => setShowModal(true)}>Войти / Зарегистрироваться →</button>
          <div className="lp-cta-note">Авторизация через Telegram · Безопасно и быстро</div>
        </div>
      </section>

      {showModal && <LoginModal onClose={() => setShowModal(false)} />}

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <div className="lp-nav-icon" style={{ width: 28, height: 28, fontSize: 13 }}>И</div>
          Информатика ЕГЭ
        </div>
        <div className="lp-footer-links">
          <a href="#">О платформе</a><a href="#">Условия</a><a href="#">Политика</a><a href="#">Контакты</a>
        </div>
        <div className="lp-footer-copy">© 2025 Информатика ЕГЭ</div>
      </footer>
    </div>
  );
}
