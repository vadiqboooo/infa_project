import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './LoginModal.css';

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

  const inputCls = 'login-modal-input';

  return (
    <div
      className="login-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="login-modal-card"
      >
        <button
          onClick={onClose}
          className="login-modal-close"
        >
          <X size={16} />
        </button>

        <div className="login-modal-content">
          <div className="login-modal-brand">
            <div className="login-modal-logo">
              И
            </div>
            <div>
              <div className="login-modal-title">Информатика ЕГЭ</div>
              <div className="login-modal-subtitle">Подготовка к экзамену</div>
            </div>
          </div>

          <div className="login-modal-tabs">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`login-modal-tab ${tab === t ? 'is-active' : ''}`}
              >
                {t === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="login-modal-form">
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

              <p className="login-modal-switch">
                Нет аккаунта?{' '}
                <button type="button" onClick={() => switchTab('register')}>
                  Зарегистрироваться
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="login-modal-form">
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

              <p className="login-modal-switch">
                Уже есть аккаунт?{' '}
                <button type="button" onClick={() => switchTab('login')}>
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
    <label className="login-modal-label">
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
      <label className="login-modal-label">
        {label}
      </label>
      <div className="login-modal-password">
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
          className="login-modal-eye"
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
    <div className="login-modal-error">
      {error}
    </div>
  );
}

function SubmitButton({ children, loading, loadingText }: { children: React.ReactNode; loading: boolean; loadingText: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="login-modal-submit"
    >
      {loading
        ? <span className="login-modal-loading"><Loader2 size={16} className="animate-spin" /> {loadingText}</span>
        : children
      }
    </button>
  );
}
