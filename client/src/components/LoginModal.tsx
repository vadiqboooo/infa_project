import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Tab = 'login' | 'register';

interface Props {
  onClose: () => void;
  initialTab?: Tab;
}

export function LoginModal({ onClose, initialTab = 'login' }: Props) {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLogin = login.trim();
    if (cleanLogin.length < 3) { setError('Логин должен быть не короче 3 символов'); return; }
    if (password.length < 6) { setError('Пароль должен быть не короче 6 символов'); return; }
    if (password !== passwordConfirm) { setError('Пароли не совпадают'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: cleanLogin, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Не удалось зарегистрироваться');
      }
      const { access_token } = await res.json();
      auth.login(access_token);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    setError('');
    setPassword('');
    setPasswordConfirm('');
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
        className="relative mx-4 w-full max-w-[420px] rounded-3xl"
        style={{
          background: '#0d1318',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(78,140,90,0.1)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-all hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="p-9">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4e8c5a] text-base font-extrabold text-white">
              И
            </div>
            <div>
              <div className="text-[14px] font-extrabold text-white">Информатика ЕГЭ</div>
              <div className="text-[11px] text-white/40">Подготовка к экзамену</div>
            </div>
          </div>

          <div className="mb-7 flex gap-1 rounded-xl bg-white/[0.05] p-1">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className="flex-1 rounded-lg py-2.5 text-[13px] font-bold transition-all"
                style={{
                  background: tab === t ? '#4e8c5a' : 'transparent',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              >
                {t === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <LoginField
                ref={firstInputRef}
                label="Логин"
                value={login}
                onChange={setLogin}
                placeholder="Ваш логин"
                autoComplete="username"
                inputCls={inputCls}
              />

              <PasswordField
                label="Пароль"
                value={password}
                onChange={setPassword}
                show={showPw}
                onToggle={() => setShowPw(v => !v)}
                autoComplete="current-password"
                placeholder="Пароль"
                inputCls={inputCls}
              />

              <FormError error={error} />

              <SubmitButton loading={loading} loadingText="Входим...">
                Войти в платформу →
              </SubmitButton>

              <p className="text-center text-[12px] text-white/35">
                Нет аккаунта?{' '}
                <button type="button" onClick={() => switchTab('register')} className="font-semibold text-[#62aa78] hover:underline">
                  Зарегистрироваться
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <LoginField
                ref={firstInputRef}
                label="Логин"
                value={login}
                onChange={setLogin}
                placeholder="Придумайте логин"
                autoComplete="username"
                inputCls={inputCls}
              />

              <PasswordField
                label="Пароль"
                value={password}
                onChange={setPassword}
                show={showPw}
                onToggle={() => setShowPw(v => !v)}
                autoComplete="new-password"
                placeholder="Минимум 6 символов"
                inputCls={inputCls}
              />

              <LoginField
                label="Подтверждение пароля"
                type={showPw ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                placeholder="Повторите пароль"
                autoComplete="new-password"
                inputCls={inputCls}
              />

              <FormError error={error} />

              <SubmitButton loading={loading} loadingText="Регистрируем...">
                Зарегистрироваться →
              </SubmitButton>

              <p className="text-center text-[12px] text-white/35">
                Уже есть аккаунт?{' '}
                <button type="button" onClick={() => switchTab('login')} className="font-semibold text-[#62aa78] hover:underline">
                  Войти
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const LoginField = React.forwardRef<HTMLInputElement, {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  inputCls: string;
  type?: string;
}>(({ label, value, onChange, placeholder, autoComplete, inputCls, type = 'text' }, ref) => (
  <div>
    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/40">
      {label}
    </label>
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={inputCls}
    />
  </div>
));

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  placeholder,
  inputCls,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  placeholder: string;
  inputCls: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${inputCls} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/70"
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[13px] font-medium text-red-400">
      {error}
    </div>
  );
}

function SubmitButton({ children, loading, loadingText }: { children: React.ReactNode; loading: boolean; loadingText: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all hover:brightness-110 disabled:opacity-60"
      style={{
        background: '#4e8c5a',
        boxShadow: '0 0 24px rgba(78,140,90,0.35)',
      }}
    >
      {loading
        ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> {loadingText}</span>
        : children
      }
    </button>
  );
}
