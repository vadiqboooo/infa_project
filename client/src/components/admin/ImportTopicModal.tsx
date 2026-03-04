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

interface ImportTopicModalProps {
  onClose: () => void;
  onImportVariant: (title: string, variantId: number) => Promise<void>;
}

export function ImportTopicModal({ onClose, onImportVariant }: ImportTopicModalProps) {
  const [variantId, setVariantId] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    if (!variantId) {
      setError('Введите номер варианта');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onImportVariant(topicTitle, parseInt(variantId));
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
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
                  Просто введите ID варианта с kompege.ru. Система автоматически скачает все задачи, 
                  ответы и файлы, а также создаст экзамен.
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
                  Импортировать
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
