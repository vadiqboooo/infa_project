import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileJson,
  Globe,
  FileSpreadsheet,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  File,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { TopicData, TopicTask } from './TopicDetail';

type ImportSource = 'json' | 'csv' | 'url' | 'paste';

interface ImportTopicModalProps {
  onClose: () => void;
  onImport: (topic: TopicData) => void;
}

interface ParsedPreview {
  name: string;
  tasksCount: number;
  tasks: { title: string; egeNumber: string; difficulty: string }[];
}

const IMPORT_SOURCES: { key: ImportSource; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'json', label: 'JSON файл', icon: <FileJson size={20} />, desc: 'Загрузите .json файл с задачами' },
  { key: 'csv', label: 'CSV / Excel', icon: <FileSpreadsheet size={20} />, desc: 'Импорт из таблицы .csv' },
  { key: 'url', label: 'По ссылке', icon: <Globe size={20} />, desc: 'Укажите URL источника данных' },
  { key: 'paste', label: 'Вставить текст', icon: <Copy size={20} />, desc: 'Вставьте данные вручную' },
];

// Mock parsed data for demo
const MOCK_PARSED: ParsedPreview = {
  name: 'Графы и деревья',
  tasksCount: 5,
  tasks: [
    { title: 'Обход графа в ширину', egeNumber: '22', difficulty: 'medium' },
    { title: 'Кратчайший путь в графе', egeNumber: '22', difficulty: 'hard' },
    { title: 'Остовное дерево', egeNumber: '23', difficulty: 'hard' },
    { title: 'Подсчёт компонент связности', egeNumber: '22', difficulty: 'medium' },
    { title: 'Эйлеров путь', egeNumber: '23', difficulty: 'hard' },
  ],
};

function generateImportedTopic(
  preview: ParsedPreview,
  category: TopicData['category'],
  egeNumbers: string,
  description: string
): TopicData {
  return {
    id: `import-${Date.now()}`,
    name: preview.name,
    category,
    egeNumbers,
    description,
    tasks: preview.tasks.map((t, i) => ({
      id: `imp-task-${Date.now()}-${i}`,
      egeNumber: t.egeNumber,
      title: t.title,
      description: `Задача по теме «${t.title}». Импортировано автоматически.`,
      difficulty: t.difficulty as TopicTask['difficulty'],
      type: 'number' as const,
      answer: '',
    })),
  };
}

export function ImportTopicModal({ onClose, onImport }: ImportTopicModalProps) {
  const [step, setStep] = useState<'source' | 'upload' | 'settings' | 'preview'>('source');
  const [source, setSource] = useState<ImportSource>('json');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [fileName, setFileName] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState('');
  const [pasteValue, setPasteValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [topicName, setTopicName] = useState('');
  const [category, setCategory] = useState<TopicData['category']>('разбор');
  const [egeNumbers, setEgeNumbers] = useState('');
  const [description, setDescription] = useState('');
  const [mergeMode, setMergeMode] = useState<'new' | 'append'>('new');

  // Preview state
  const [preview, setPreview] = useState<ParsedPreview | null>(null);

  const handleSelectSource = (src: ImportSource) => {
    setSource(src);
    setError(null);
    setFileName(null);
    setUrlValue('');
    setPasteValue('');
    setStep('upload');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setError(null);
    }
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (source === 'json' && ext !== 'json') {
        setError('Пожалуйста, загрузите файл в формате .json');
        return;
      }
      if (source === 'csv' && ext !== 'csv') {
        setError('Пожалуйста, загрузите файл в формате .csv');
        return;
      }
      setFileName(file.name);
      setError(null);
    }
  };

  const canProceedFromUpload = () => {
    if (source === 'json' || source === 'csv') return !!fileName;
    if (source === 'url') return urlValue.trim().length > 5;
    if (source === 'paste') return pasteValue.trim().length > 10;
    return false;
  };

  const handleParseData = () => {
    setLoading(true);
    setError(null);

    // Simulate parsing delay
    setTimeout(() => {
      setLoading(false);
      setPreview(MOCK_PARSED);
      setTopicName(MOCK_PARSED.name);
      setEgeNumbers(
        [...new Set(MOCK_PARSED.tasks.map((t) => t.egeNumber))].join(', ')
      );
      setDescription(`Импорт из ${source === 'json' ? 'JSON' : source === 'csv' ? 'CSV' : source === 'url' ? 'URL' : 'текста'}: ${fileName || urlValue || 'вставка'}`);
      setStep('settings');
    }, 1200);
  };

  const handleGoToPreview = () => {
    setStep('preview');
  };

  const handleImport = () => {
    if (!preview) return;
    const topic = generateImportedTopic(preview, category, egeNumbers, description);
    topic.name = topicName || preview.name;
    onImport(topic);
  };

  const difficultyLabel = (d: string) =>
    d === 'easy' ? 'Базовый' : d === 'medium' ? 'Повышенный' : 'Высокий';
  const difficultyColor = (d: string) =>
    d === 'easy' ? 'bg-emerald-100 text-emerald-700' : d === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const stepLabels = ['Источник', 'Загрузка', 'Настройки', 'Предпросмотр'];
  const stepKeys: typeof step[] = ['source', 'upload', 'settings', 'preview'];
  const currentStepIdx = stepKeys.indexOf(step);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center">
              <Upload size={17} className="text-[#3F8C62]" />
            </div>
            <div>
              <h2 className="text-gray-900 text-sm">Импорт топика</h2>
              <p className="text-xs text-gray-400">Шаг {currentStepIdx + 1} из 4</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors',
                      i <= currentStepIdx
                        ? 'bg-[#3F8C62] text-white'
                        : 'bg-gray-100 text-gray-400'
                    )}
                  >
                    {i < currentStepIdx ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={clsx(
                      'text-xs hidden sm:inline',
                      i <= currentStepIdx ? 'text-gray-700' : 'text-gray-400'
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    className={clsx(
                      'flex-1 h-px',
                      i < currentStepIdx ? 'bg-[#3F8C62]' : 'bg-gray-200'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: Source selection */}
          {step === 'source' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">Выберите источник, из которого хотите импортировать задачи:</p>
              <div className="grid grid-cols-2 gap-3">
                {IMPORT_SOURCES.map((src) => (
                  <button
                    key={src.key}
                    onClick={() => handleSelectSource(src.key)}
                    className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-[#3F8C62] hover:bg-[#3F8C62]/5 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-[#3F8C62]/10 flex items-center justify-center text-gray-500 group-hover:text-[#3F8C62] transition-colors shrink-0">
                      {src.icon}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{src.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{src.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload / input */}
          {step === 'upload' && (
            <div>
              <button
                onClick={() => setStep('source')}
                className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-flex items-center gap-1 transition-colors"
              >
                &larr; Назад к выбору источника
              </button>

              {(source === 'json' || source === 'csv') && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Загрузите {source === 'json' ? 'JSON' : 'CSV'} файл с задачами
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={source === 'json' ? '.json' : '.csv'}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropFile}
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                      fileName
                        ? 'border-[#3F8C62] bg-[#3F8C62]/5'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    )}
                  >
                    {fileName ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-[#3F8C62]/10 flex items-center justify-center">
                          <File size={22} className="text-[#3F8C62]" />
                        </div>
                        <p className="text-sm text-gray-900">{fileName}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileName(null);
                          }}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Удалить
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Upload size={22} className="text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600">
                          Перетащите файл сюда или <span className="text-[#3F8C62]">выберите</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Поддерживается {source === 'json' ? '.json' : '.csv'}, до 5 МБ
                        </p>
                      </div>
                    )}
                  </div>

                  {source === 'json' && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Ожидаемый формат JSON:</p>
                      <pre className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-gray-100 overflow-x-auto">
{`{
  "name": "Название топика",
  "tasks": [
    {
      "title": "Название задачи",
      "egeNumber": "22",
      "difficulty": "medium",
      "description": "Текст задачи...",
      "answer": "42"
    }
  ]
}`}
                      </pre>
                    </div>
                  )}

                  {source === 'csv' && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Ожидаемые колонки CSV:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {['title', 'egeNumber', 'difficulty', 'description', 'answer', 'type'].map((col) => (
                          <span key={col} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {source === 'url' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Укажите URL источника данных</p>
                  <input
                    type="url"
                    value={urlValue}
                    onChange={(e) => {
                      setUrlValue(e.target.value);
                      setError(null);
                    }}
                    placeholder="https://api.example.com/tasks.json"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white"
                  />
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Поддерживаемые источники:</p>
                    <ul className="space-y-1.5">
                      {[
                        { label: 'REST API', desc: 'JSON-ответ с массивом задач' },
                        { label: 'Google Sheets', desc: 'Публичная ссылка на таблицу' },
                        { label: 'Notion', desc: 'Публичная страница с таблицей' },
                      ].map((item) => (
                        <li key={item.label} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#3F8C62]" />
                          <span className="text-gray-700">{item.label}</span>
                          <span className="text-gray-400">— {item.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {source === 'paste' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Вставьте данные в формате JSON или разделённые табуляцией</p>
                  <textarea
                    value={pasteValue}
                    onChange={(e) => {
                      setPasteValue(e.target.value);
                      setError(null);
                    }}
                    rows={10}
                    placeholder={`{\n  "name": "Название топика",\n  "tasks": [\n    { "title": "Задача 1", "egeNumber": "22", "difficulty": "medium", "answer": "42" }\n  ]\n}`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white resize-none font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Поддерживается JSON и TSV (данные через табуляцию)
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-600 text-xs">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Settings */}
          {step === 'settings' && preview && (
            <div>
              <button
                onClick={() => setStep('upload')}
                className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-flex items-center gap-1 transition-colors"
              >
                &larr; Назад к загрузке
              </button>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-5 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm text-emerald-800">Данные успешно распознаны</p>
                  <p className="text-xs text-emerald-600">
                    Найдено {preview.tasksCount} задач в топике «{preview.name}»
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">Название топика</label>
                  <input
                    type="text"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">Категория</label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as TopicData['category'])}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white appearance-none"
                      >
                        <option value="разбор">Разбор</option>
                        <option value="домашняя работа">Домашняя работа</option>
                        <option value="вариант">Вариант</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">Номера заданий ЕГЭ</label>
                    <input
                      type="text"
                      value={egeNumbers}
                      onChange={(e) => setEgeNumbers(e.target.value)}
                      placeholder="22, 23"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">Описание</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">Режим импорта</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMergeMode('new')}
                      className={clsx(
                        'flex-1 px-4 py-2.5 rounded-xl text-sm border transition-colors',
                        mergeMode === 'new'
                          ? 'border-[#3F8C62] bg-[#3F8C62]/5 text-[#3F8C62]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      Создать новый топик
                    </button>
                    <button
                      onClick={() => setMergeMode('append')}
                      className={clsx(
                        'flex-1 px-4 py-2.5 rounded-xl text-sm border transition-colors',
                        mergeMode === 'append'
                          ? 'border-[#3F8C62] bg-[#3F8C62]/5 text-[#3F8C62]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      Добавить к существующему
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 'preview' && preview && (
            <div>
              <button
                onClick={() => setStep('settings')}
                className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-flex items-center gap-1 transition-colors"
              >
                &larr; Назад к настройкам
              </button>

              <div className="mb-5">
                <h3 className="text-sm text-gray-900 mb-1">{topicName || preview.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full',
                      category === 'разбор' && 'bg-blue-100 text-blue-700',
                      category === 'домашняя работа' && 'bg-violet-100 text-violet-700',
                      category === 'вариант' && 'bg-orange-100 text-orange-700'
                    )}
                  >
                    {category}
                  </span>
                  <span>ЕГЭ: {egeNumbers || '—'}</span>
                  <span>{preview.tasksCount} задач</span>
                </div>
                {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 uppercase border-b border-gray-100">
                  Задачи для импорта
                </div>
                <div className="divide-y divide-gray-50">
                  {preview.tasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-600 shrink-0">
                        {task.egeNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{task.title}</p>
                      </div>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs shrink-0', difficultyColor(task.difficulty))}>
                        {difficultyLabel(task.difficulty)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Отмена
          </button>
          <div className="flex gap-2">
            {step === 'upload' && (
              <button
                onClick={handleParseData}
                disabled={!canProceedFromUpload() || loading}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-colors',
                  canProceedFromUpload() && !loading
                    ? 'bg-[#3F8C62] hover:bg-[#357A54] text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Обработка...
                  </>
                ) : (
                  'Далее'
                )}
              </button>
            )}
            {step === 'settings' && (
              <button
                onClick={handleGoToPreview}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm transition-colors"
              >
                Предпросмотр
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#3F8C62] hover:bg-[#357A54] text-white rounded-xl text-sm transition-colors"
              >
                <Upload size={14} />
                Импортировать
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
