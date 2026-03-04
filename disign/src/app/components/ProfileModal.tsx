import React, { useState } from 'react';
import { X, Save, Check, User, AtSign, Hash, Pencil } from 'lucide-react';
import { clsx } from 'clsx';

interface ProfileModalProps {
  onClose: () => void;
}

const initialData = {
  telegramId: 482917365,
  telegramUsername: '@vlad_dev',
  telegramName: 'Владислав К.',
  realFirstName: '',
  realLastName: '',
};

export function ProfileModal({ onClose }: ProfileModalProps) {
  const [form, setForm] = useState(initialData);
  const [saved, setSaved] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const displayName =
    form.realFirstName && form.realLastName
      ? `${form.realFirstName} ${form.realLastName}`
      : form.telegramName;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 text-sm">Настройки профиля</h2>
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3F8C62] to-[#2D6B4A] flex items-center justify-center text-white text-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#4ADE80] rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-[#3F8C62] truncate">{form.telegramUsername}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">ID: {form.telegramId}</p>
            </div>
          </div>

          {/* Telegram data (read-only) */}
          <div>
            <h3 className="text-[11px] text-gray-400 uppercase tracking-wide mb-2.5">Данные Telegram</h3>
            <div className="space-y-2">
              <ReadonlyField icon={<Hash size={14} />} label="Telegram ID" value={String(form.telegramId)} />
              <ReadonlyField icon={<AtSign size={14} />} label="Username" value={form.telegramUsername} />
              <ReadonlyField icon={<User size={14} />} label="Имя в Telegram" value={form.telegramName} />
            </div>
          </div>

          {/* Editable fields */}
          <div>
            <h3 className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">Личные данные</h3>
            <p className="text-xs text-gray-500 mb-3">
              Укажите настоящие имя и фамилию, чтобы учитель мог вас идентифицировать
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Имя</label>
                <div className="relative">
                  <Pencil size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.realFirstName}
                    onChange={(e) => handleChange('realFirstName', e.target.value)}
                    placeholder="Владислав"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white placeholder:text-gray-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Фамилия</label>
                <div className="relative">
                  <Pencil size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.realLastName}
                    onChange={(e) => handleChange('realLastName', e.target.value)}
                    placeholder="Кузнецов"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white placeholder:text-gray-300"
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
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all',
              saved
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-[#3F8C62] hover:bg-[#357A54] text-white'
            )}
          >
            {saved ? (
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
        <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
        <p className="text-sm text-gray-700 truncate">{value}</p>
      </div>
      <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">
        Telegram
      </span>
    </div>
  );
}
