import React, { useEffect, useState } from 'react';
import { AlertCircle, Bell, Check, CreditCard, Lock, Mail, Save, User as UserIcon, Users, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useChangePassword, usePaymentHistory } from '../hooks/useApi';

interface ProfileModalProps {
  onClose: () => void;
}

type ProfileForm = {
  firstNameReal: string;
  lastNameReal: string;
  email: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  repeatPassword: string;
};

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const { data: payments = [] } = usePaymentHistory();
  const changePassword = useChangePassword();
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstNameReal: '',
    lastNameReal: '',
    email: '',
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    repeatPassword: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      firstNameReal: user.first_name_real || '',
      lastNameReal: user.last_name_real || '',
      email: user.email || '',
    });
  }, [user]);

  const displayName =
    user?.first_name_real || user?.last_name_real
      ? `${user.first_name_real || ''} ${user.last_name_real || ''}`.trim()
      : user?.first_name || user?.login || 'Пользователь';
  const initials = displayName.slice(0, 1).toUpperCase();
  const canEditName = Boolean(user?.can_edit_real_name || (user?.group_ids?.length ?? 0) > 0);
  const hasPasswordAuth = Boolean(user?.login);

  const updateProfileField = (field: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    setProfileSaved(false);
    setError(null);
  };

  const updatePasswordField = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordSaved(false);
    setError(null);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setError(null);
    try {
      await updateUser({
        first_name_real: canEditName ? profileForm.firstNameReal.trim() : undefined,
        last_name_real: canEditName ? profileForm.lastNameReal.trim() : undefined,
        email: profileForm.email.trim(),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setError(null);
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.repeatPassword) {
      setError('Заполните все поля пароля');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError('Новый пароль должен быть не короче 6 символов');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.repeatPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }

    try {
      await changePassword.mutateAsync({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', repeatPassword: '' });
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить пароль');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07111D] text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Профиль</h2>
            <p className="mt-1 text-xs text-slate-500">Аккаунт, уведомления и история оплат</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-[260px,minmax(0,1fr)]">
            <aside className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt={displayName} className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-xl font-black text-white">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{displayName}</p>
                    <p className="mt-1 truncate text-xs text-emerald-300">{user?.login ? `Логин: ${user.login}` : 'Вход через Telegram'}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <InfoRow label="ID" value={String(user?.id ?? '')} />
                  <InfoRow label="Telegram" value={user?.username ? `@${user.username}` : user?.tg_id ? String(user.tg_id) : 'не привязан'} />
                  <InfoRow label="Курс" value={formatSubscription(user?.subscription_plan)} />
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Bell size={16} className="text-emerald-300" />
                  Уведомления
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Email можно подключить сейчас. Привязку Telegram добавим позже.
                </p>
              </section>
            </aside>

            <main className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <SectionTitle icon={<UserIcon size={16} />} title="Личные данные" />
                {!canEditName && (
                  <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    Имя и фамилию можно указать после добавления ученика в группу.
                  </p>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Имя"
                    value={profileForm.firstNameReal}
                    onChange={(value) => updateProfileField('firstNameReal', value)}
                    disabled={!canEditName}
                    placeholder="Введите имя"
                  />
                  <TextField
                    label="Фамилия"
                    value={profileForm.lastNameReal}
                    onChange={(value) => updateProfileField('lastNameReal', value)}
                    disabled={!canEditName}
                    placeholder="Введите фамилию"
                  />
                </div>
                <div className="mt-3">
                  <TextField
                    label="Email для уведомлений"
                    value={profileForm.email}
                    onChange={(value) => updateProfileField('email', value)}
                    placeholder="name@example.com"
                    icon={<Mail size={15} />}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className={clsx(
                    'mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition',
                    profileSaved ? 'bg-emerald-400/15 text-emerald-200' : 'bg-emerald-500 text-white hover:bg-emerald-400',
                    isSavingProfile && 'opacity-70',
                  )}
                >
                  {profileSaved ? <Check size={16} /> : <Save size={16} />}
                  {profileSaved ? 'Сохранено' : 'Сохранить профиль'}
                </button>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <SectionTitle icon={<Lock size={16} />} title="Пароль" />
                {hasPasswordAuth ? (
                  <>
                    <div className="mt-4 grid gap-3">
                      <TextField
                        label="Старый пароль"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(value) => updatePasswordField('currentPassword', value)}
                        placeholder="Введите старый пароль"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField
                          label="Новый пароль"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(value) => updatePasswordField('newPassword', value)}
                          placeholder="Новый пароль"
                        />
                        <TextField
                          label="Повторите новый пароль"
                          type="password"
                          value={passwordForm.repeatPassword}
                          onChange={(value) => updatePasswordField('repeatPassword', value)}
                          placeholder="Еще раз"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changePassword.isPending}
                      className={clsx(
                        'mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition',
                        passwordSaved ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white hover:bg-white/15',
                        changePassword.isPending && 'opacity-70',
                      )}
                    >
                      {passwordSaved ? <Check size={16} /> : <Lock size={16} />}
                      {passwordSaved ? 'Пароль изменен' : 'Изменить пароль'}
                    </button>
                  </>
                ) : (
                  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
                    Пароль не настроен, потому что аккаунт создан через Telegram.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <SectionTitle icon={<Users size={16} />} title="Группы" />
                <p className="mt-2 text-sm text-slate-400">
                  {user?.group_ids?.length ? `Вы состоите в ${user.group_ids.length} группе(ах).` : 'Пока вы не добавлены в группу.'}
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <SectionTitle icon={<CreditCard size={16} />} title="История оплат" />
                <div className="mt-4 space-y-2">
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <div key={payment.id} className="rounded-xl border border-white/10 bg-[#07111D] px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{formatPlan(payment.plan)}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatDate(payment.paid_at || payment.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-white">{Number(payment.amount_value).toLocaleString('ru-RU')} ₽</p>
                            <p className={clsx('mt-1 text-xs font-bold', payment.status === 'succeeded' ? 'text-emerald-300' : 'text-slate-500')}>
                              {formatPaymentStatus(payment.status)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                      Оплат пока нет.
                    </p>
                  )}
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-white">
      <span className="text-emerald-300">{icon}</span>
      {title}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-400">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'h-11 w-full rounded-xl border border-white/10 bg-[#07111D] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-400/10',
            icon && 'pl-9',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
      </div>
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="truncate font-semibold text-slate-200">{value}</span>
    </div>
  );
}

function formatSubscription(plan?: string) {
  if (plan === 'summer') return 'Летний курс';
  if (plan === 'year') return 'Годовой курс';
  return 'Нет оплаты';
}

function formatPlan(plan: string) {
  if (plan === 'summer') return 'Летний курс';
  if (plan === 'year') return 'Годовой курс';
  return plan;
}

function formatPaymentStatus(status: string) {
  if (status === 'succeeded') return 'Оплачено';
  if (status === 'pending') return 'Ожидает оплаты';
  if (status === 'canceled') return 'Отменено';
  return status;
}

function formatDate(value: string | null) {
  if (!value) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
