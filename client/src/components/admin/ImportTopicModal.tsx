import React, { useState } from 'react';
import {
  X,
  Upload,
  Globe,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';

type CategoryValue = 'tutorial' | 'homework' | 'control' | 'variants' | 'mock';

interface ImportOptions {
  category: CategoryValue;
  ege_number: number | null;
  ege_number_end: number | null;
}

interface ImportTopicModalProps {
  onClose: () => void;
  onImportVariant: (title: string, variantId: number, options: ImportOptions) => Promise<void>;
}

const CATEGORIES: { value: CategoryValue; label: string }[] = [
  { value: 'variants', label: 'Вариант ЕГЭ' },
  { value: 'tutorial', label: 'Разбор заданий' },
  { value: 'homework', label: 'Домашняя работа' },
  { value: 'control', label: 'Контрольная работа' },
  { value: 'mock', label: 'Пробник' },
];

export function ImportTopicModal({ onClose, onImportVariant }: ImportTopicModalProps) {
  const [variantId, setVariantId] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [category, setCategory] = useState<CategoryValue>('variants');
  const [egeValue, setEgeValue] = useState<string>(''); // '', '1'..'27', or '19-21'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const needsEgeNumber = category === 'tutorial' || category === 'homework';

  const handleImport = async () => {
    if (!variantId) {
      setError('Введите номер варианта');
      return;
    }
    if (needsEgeNumber && !egeValue) {
      setError('Выберите номер задания');
      return;
    }
    let ege_number: number | null = null;
    let ege_number_end: number | null = null;
    if (needsEgeNumber && egeValue) {
      if (egeValue.includes('-')) {
        const [a, b] = egeValue.split('-').map(n => parseInt(n));
        ege_number = a;
        ege_number_end = b;
      } else {
        ege_number = parseInt(egeValue);
      }
    }
    setLoading(true);
    setError(null);
    try {
      await onImportVariant(topicTitle, parseInt(variantId), {
        category,
        ege_number,
        ege_number_end,
      });
      // Modal will be closed by parent after navigation
    } catch (err: any) {
      setError(err.message || 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center">
              <Globe size={18} className="text-[#3F8C62]" />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-sm">Импорт с Kompege</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">v1.0 variant parser</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center py-8 text-center animate-in zoom-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Успешно!</h3>
              <p className="text-sm text-gray-500 mt-1">Вариант импортирован в систему</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Введите ID варианта с kompege.ru. Откроется редактор где можно отредактировать задания
                  (тему, номер, подзадания) перед сохранением.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Номер варианта</label>
                  <input
                    type="number"
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    placeholder="Напр. 25159856"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Название топика</label>
                  <input
                    type="text"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="Напр. Пробник №12 (опционально)"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Тип топика</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const v = e.target.value as CategoryValue;
                      setCategory(v);
                      if (v !== 'tutorial' && v !== 'homework') setEgeValue('');
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {needsEgeNumber && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 ml-1">Номер задания</label>
                    <select
                      value={egeValue}
                      onChange={(e) => setEgeValue(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                    >
                      <option value="">— выберите —</option>
                      {Array.from({ length: 18 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>№{i + 1}</option>
                      ))}
                      <option value="19-21">№19-21 (теория игр)</option>
                      {[22, 23, 24, 25, 26, 27].map(n => (
                        <option key={n} value={String(n)}>№{n}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs animate-in slide-in-from-top-2">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !variantId}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-3 bg-[#3F8C62] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#3F8C62]/20 hover:bg-[#357A54] transition-all disabled:opacity-50 disabled:shadow-none",
                loading && "cursor-wait"
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Открыть в редакторе
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
