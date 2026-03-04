import React, { useState, useEffect } from 'react';
import { X, Save, Check, User as UserIcon, AtSign, Hash, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    firstNameReal: user?.first_name_real || '',
    lastNameReal: user?.last_name_real || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstNameReal: user.first_name_real || '',
        lastNameReal: user.last_name_real || '',
      });
    }
  }, [user]);

  const handleChange = (field: 'firstNameReal' | 'lastNameReal', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUser({
        first_name_real: form.firstNameReal,
        last_name_real: form.lastNameReal,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Ошибка при сохранении данных');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName =
    user?.first_name_real && user?.last_name_real
      ? `${user.first_name_real} ${user.last_name_real}`
      : user?.first_name || 'Пользователь';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 text-sm font-medium">Настройки профиля</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {/* Avatar card */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="relative shrink-0">
              {user?.photo_url ? (
                <img src={user.photo_url} alt={displayName} className="w-14 h-14 rounded-2xl object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3F8C62] to-[#2D6B4A] flex items-center justify-center text-white text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#4ADE80] rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-[#3F8C62] truncate">@{user?.username || 'id' + user?.tg_id}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">ID: {user?.tg_id}</p>
            </div>
          </div>

          {/* Telegram data (read-only) */}
          <div>
            <h3 className="text-[11px] text-gray-400 uppercase tracking-wide mb-2.5 font-bold">Данные Telegram</h3>
            <div className="space-y-2">
              <ReadonlyField icon={<Hash size={14} />} label="Telegram ID" value={String(user?.tg_id || '')} />
              <ReadonlyField icon={<AtSign size={14} />} label="Username" value={user?.username ? `@${user.username}` : '—'} />
              <ReadonlyField icon={<UserIcon size={14} />} label="Имя в Telegram" value={user?.first_name || '—'} />
            </div>
          </div>

          {/* Editable fields */}
          <div>
            <h3 className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5 font-bold">Личные данные</h3>
            <p className="text-xs text-gray-500 mb-3">
              Укажите настоящие имя и фамилию, чтобы учитель мог вас идентифицировать
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Имя</label>
                <div className="relative">
                  <Pencil size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.firstNameReal}
                    onChange={(e) => handleChange('firstNameReal', e.target.value)}
                    placeholder="Введите имя"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white placeholder:text-gray-300 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Фамилия</label>
                <div className="relative">
                  <Pencil size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.lastNameReal}
                    onChange={(e) => handleChange('lastNameReal', e.target.value)}
                    placeholder="Введите фамилию"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white placeholder:text-gray-300 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm',
              saved
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-[#3F8C62] hover:bg-[#357A54] text-white disabled:opacity-50'
            )}
          >
            {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : saved ? (
              <>
                <Check size={15} />
                Сохранено
              </>
            ) : (
              <>
                <Save size={15} />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadonlyField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-100">
      <div className="text-gray-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 leading-tight mb-0.5">{label}</p>
        <p className="text-sm text-gray-700 truncate font-medium">{value}</p>
      </div>
      <span className="text-[9px] font-bold text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded uppercase shrink-0">
        Telegram
      </span>
    </div>
  );
}
