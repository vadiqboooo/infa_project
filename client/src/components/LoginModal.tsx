import React, { useEffect, useRef, useState } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
}

type Tab = 'login' | 'register';

export function LoginModal({ onClose }: Props) {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('login');

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) { setError('Введите логин и пароль'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Неверный логин или пароль');
      }
      const { access_token } = await res.json();
      auth.login(access_token);
      // ProtectedRoute автоматически покажет приложение после login()
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = [
    'w-full rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/30 outline-none transition-all',
    'bg-white/[0.06] border border-white/10 focus:border-[#4e8c5a]',
  ].join(' ');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[420px] mx-4 rounded-3xl"
        style={{
          background: '#0d1318',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(78,140,90,0.1)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-all"
        >
          <X size={16} />
        </button>

        <div className="p-9">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-7">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-base"
              style={{ background: '#4e8c5a' }}
            >
              И
            </div>
            <div>
              <div className="text-[14px] font-extrabold text-white">Информатика ЕГЭ</div>
              <div className="text-[11px] text-white/40">Подготовка к экзамену</div>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-7"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all"
                style={{
                  background: tab === t ? '#4e8c5a' : 'transparent',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              >
                {t === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          {/* ── Login form ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold tracking-widest uppercase text-white/40 mb-2">
                  Логин
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={login}
                  onChange={e => setLogin(e.target.value)}
                  placeholder="Ваш логин"
                  autoComplete="username"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-widest uppercase text-white/40 mb-2">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={inputCls + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-[13px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-60 hover:brightness-110"
                style={{
                  background: '#4e8c5a',
                  boxShadow: '0 0 24px rgba(78,140,90,0.35)',
                }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Входим...</span>
                  : 'Войти в платформу →'
                }
              </button>

              <p className="text-center text-[12px] text-white/35">
                Нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-[#62aa78] font-semibold hover:underline"
                >
                  Зарегистрироваться
                </button>
              </p>
            </form>
          )}

          {/* ── Register stub ── */}
          {tab === 'register' && (
            <div className="text-center py-4 space-y-5">
              <div
                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: 'rgba(78,140,90,0.15)', border: '1px solid rgba(78,140,90,0.25)' }}
              >
                🔜
              </div>
              <div>
                <div className="text-white font-bold text-lg mb-2">Регистрация скоро</div>
                <p className="text-[14px] text-white/50 leading-relaxed">
                  Самостоятельная регистрация будет доступна позже.<br />
                  Для получения доступа обратитесь к преподавателю — он выдаст логин и пароль.
                </p>
              </div>
              <button
                onClick={() => setTab('login')}
                className="w-full rounded-xl py-3 text-[14px] font-bold text-white/80 transition-all hover:bg-white/10"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                ← Войти с логином и паролем
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
