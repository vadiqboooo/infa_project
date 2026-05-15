import React, { useCallback, useRef, useState } from 'react';
import { mergeAttributes } from '@tiptap/core';
import { useEditor, EditorContent, Editor, NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import { clsx } from 'clsx';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  List,
  ListOrdered,
  Image as ImageIcon,
  FileCode2,
  Link as LinkIcon,
  Table as TableIcon,
  RemoveFormatting,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  apiKey?: string;
  taskId?: number;
}

// ── Toolbar button ──────────────────────────────────────────────────────────
function ToolBtn({
  active,
  title,
  onClick,
  children,
  disabled,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        active
          ? 'bg-[#3F8C62]/15 text-[#3F8C62]'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

// ── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

function parsePixelValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i);
  return match ? Number(match[1]) : null;
}

function readStyleDimension(style: string | null, property: 'width' | 'height' | 'max-width') {
  if (!style) return null;
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match ? parsePixelValue(match[1]) : null;
}

function imageStyle(style: string | null, width: unknown, height: unknown) {
  const preserved = (style || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(width|height|max-width)\s*:/i.test(part));

  const nextWidth = parsePixelValue(width) ?? readStyleDimension(style, 'width') ?? readStyleDimension(style, 'max-width');
  const nextHeight = parsePixelValue(height) ?? readStyleDimension(style, 'height');

  if (!preserved.some((part) => /^display\s*:/i.test(part))) preserved.push('display:block');
  if (!preserved.some((part) => /^margin\s*:/i.test(part))) preserved.push('margin:12px auto');
  preserved.push('max-width:100%');
  if (nextWidth) preserved.push(`width:${Math.round(nextWidth)}px`);
  preserved.push(nextHeight ? `height:${Math.round(nextHeight)}px` : 'height:auto');

  return preserved.join(';');
}

function decodeSvgDataUrl(src: string | null | undefined) {
  if (!src?.startsWith('data:image/svg+xml')) return null;
  const commaIndex = src.indexOf(',');
  if (commaIndex < 0) return null;

  const meta = src.slice(0, commaIndex);
  const payload = src.slice(commaIndex + 1);

  try {
    return meta.includes(';base64')
      ? window.atob(payload)
      : decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function encodeSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function adaptSvgForDarkBackground(svg: string) {
  return svg
    .replaceAll('fill="#ffffff"', 'fill="none"')
    .replaceAll("fill='#ffffff'", "fill='none'")
    .replaceAll('fill="#fff"', 'fill="none"')
    .replaceAll("fill='#fff'", "fill='none'")
    .replace(/(stroke)=["'](?:#000000|#000|black|#111827|#1f2937|#374151|#4b5563)["']/gi, '$1="#e5e7eb"')
    .replace(/(fill)=["'](?:#000000|#000|black|#111827|#1f2937|#374151|#4b5563)["']/gi, '$1="#e5e7eb"')
    .replace(/(stroke)=["'](?:#64748b|#6b7280|#94a3b8)["']/gi, '$1="#cbd5e1"')
    .replace(/(fill)=["'](?:#64748b|#6b7280|#94a3b8)["']/gi, '$1="#cbd5e1"')
    .replace(/stroke=["'](?:#e5e7eb|#eef2f7)["'] stroke-width=["']1["']/gi, 'stroke="#475569" stroke-opacity="0.32" stroke-width="1"')
    .replace(/stroke=["'](?:#e5e7eb|#eef2f7)["'] strokeWidth=["']1["']/gi, 'stroke="#475569" strokeOpacity="0.32" strokeWidth="1"');
}

function setSvgGridOpacity(svg: string, opacity: string) {
  return svg.replace(/<line\b[^>]*>/gi, (line) => {
    const isThinLine = /stroke-width=["']?1(?:\.0)?["']?/i.test(line) || /strokeWidth=["']?1(?:\.0)?["']?/i.test(line);
    const hasGridColor = /stroke=["'](?:#e5e7eb|#eef2f7|#cbd5e1|#94a3b8|#64748b|#475569|#334155)["']/i.test(line);
    if (!isThinLine || !hasGridColor) return line;

    if (/stroke-opacity=/i.test(line)) {
      return line.replace(/stroke-opacity=["'][^"']*["']/i, `stroke-opacity="${opacity}"`);
    }

    if (/strokeOpacity=/i.test(line)) {
      return line.replace(/strokeOpacity=["'][^"']*["']/i, `strokeOpacity="${opacity}"`);
    }

    return line.replace(/\/?>$/, (ending) => ` stroke-opacity="${opacity}"${ending}`);
  });
}

function ResizableImageView({ node, selected, updateAttributes }: NodeViewProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const attrs = node.attrs as { src: string; alt?: string | null; title?: string | null; width?: string | number | null; height?: string | number | null; style?: string | null };
  const displayWidth = parsePixelValue(attrs.width) ?? readStyleDimension(attrs.style || null, 'width') ?? readStyleDimension(attrs.style || null, 'max-width');

  const startResize = (event: React.PointerEvent<HTMLButtonElement>, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = wrapper.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = rect.width;
    const aspectRatio = rect.height > 0 ? startWidth / rect.height : 1;
    const horizontalSign = corner.endsWith('e') ? 1 : -1;
    const verticalSign = corner.startsWith('s') ? 1 : -1;

    const onMove = (moveEvent: PointerEvent) => {
      const widthFromX = startWidth + (moveEvent.clientX - startX) * horizontalSign;
      const widthFromY = startWidth + (moveEvent.clientY - startY) * verticalSign * aspectRatio;
      const nextWidth = Math.max(120, Math.min(900, Math.round(Math.abs(widthFromX - startWidth) > Math.abs(widthFromY - startWidth) ? widthFromX : widthFromY)));

      updateAttributes({
        width: String(nextWidth),
        height: null,
        style: imageStyle(attrs.style || null, nextWidth, null),
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      data-drag-handle
      className="rich-editor-image-node"
      draggable="true"
      style={{ width: displayWidth ? `${displayWidth}px` : undefined }}
    >
      <img
        src={attrs.src}
        alt={attrs.alt || ''}
        title={attrs.title || undefined}
        draggable={false}
      />
      {selected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              aria-label="Изменить размер изображения"
              className={`rich-editor-image-resize-handle rich-editor-image-resize-handle-${corner}`}
              onPointerDown={(event) => startResize(event, corner)}
            />
          ))}
        </>
      )}
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('width') ||
          readStyleDimension(element.getAttribute('style'), 'width') ||
          readStyleDimension(element.getAttribute('style'), 'max-width'),
      },
      height: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('height') ||
          readStyleDimension(element.getAttribute('style'), 'height'),
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
      },
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { style, width, height, ...rest } = HTMLAttributes;

    return ['img', mergeAttributes(rest, { style: imageStyle(style || null, width, height) })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

// ── Paragraph / Heading selector ─────────────────────────────────────────────
function BlockSelector({ editor }: { editor: Editor }) {
  const getLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Заголовок 1';
    if (editor.isActive('heading', { level: 2 })) return 'Заголовок 2';
    if (editor.isActive('heading', { level: 3 })) return 'Заголовок 3';
    return 'Параграф';
  };

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-1 px-2 h-7 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="w-20 text-left truncate">{getLabel()}</span>
        <ChevronDown size={10} />
      </button>
      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 hidden group-focus-within:block group-hover:block min-w-[140px]">
        {[
          { label: 'Параграф', action: () => editor.chain().focus().setParagraph().run() },
          { label: 'Заголовок 1', action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
          { label: 'Заголовок 2', action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
          { label: 'Заголовок 3', action: () => editor.chain().focus().setHeading({ level: 3 }).run() },
        ].map(({ label, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main editor ─────────────────────────────────────────────────────────────
export default function RichTextEditor({ value, onChange, apiKey, taskId }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [svgDraft, setSvgDraft] = useState('');
  const [svgEditorOpen, setSvgEditorOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // we don't want code blocks here
      }),
      Underline,
      Superscript,
      Subscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    onSelectionUpdate() {
      setSelectionVersion((version) => version + 1);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[220px] px-4 py-3 focus:outline-none text-gray-800 text-sm leading-relaxed',
      },
    },
  });

  // Sync value from outside (e.g. when task changes)
  const prevValueRef = useRef(value);
  if (editor && value !== prevValueRef.current) {
    prevValueRef.current = value;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', false);
    }
  }

  const insertMath = useCallback(() => {
    if (!editor) return;
    const formula = window.prompt('Введите формулу (LaTeX):', 'x^2 + y^2');
    if (formula) {
      editor.chain().focus().insertContent(`<code>$${formula}$</code>`).run();
    }
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('URL ссылки:', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const selectedImageAttrs = editor?.getAttributes('image') as { src?: string } | undefined;
  const selectedSvgSource = decodeSvgDataUrl(selectedImageAttrs?.src);
  const canEditSelectedSvg = Boolean(selectionVersion >= 0 && selectedSvgSource);

  const openSelectedSvgEditor = useCallback(() => {
    if (!selectedSvgSource) return;
    setSvgDraft(selectedSvgSource);
    setSvgEditorOpen(true);
  }, [selectedSvgSource]);

  const saveSelectedSvg = useCallback(() => {
    if (!editor) return;
    const trimmed = svgDraft.trim();
    if (!/^<svg[\s>]/i.test(trimmed)) {
      alert('SVG должен начинаться с <svg ...>');
      return;
    }

    editor.chain().focus().updateAttributes('image', { src: encodeSvgDataUrl(trimmed) }).run();
    setSvgEditorOpen(false);
  }, [editor, svgDraft]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      // If we have a task ID + apiKey, upload to server
      if (taskId && apiKey) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/admin/import-pdf/upload-image', {
            method: 'POST',
            headers: { 'x-api-key': apiKey },
            body: fd,
          });
          if (!res.ok) throw new Error('Upload failed');
          const data = await res.json();
          editor.chain().focus().setImage({ src: data.url }).run();
        } catch (e) {
          alert('Ошибка загрузки изображения');
        }
      } else {
        // Fallback: base64
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          if (src) editor.chain().focus().setImage({ src }).run();
        };
        reader.readAsDataURL(file);
      }
    },
    [editor, taskId, apiKey]
  );

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <BlockSelector editor={editor} />
        <Divider />

        <ToolBtn
          title="Жирный (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn
          title="Курсив (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn
          title="Подчёркнутый (Ctrl+U)"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={13} />
        </ToolBtn>

        <Divider />

        <ToolBtn
          title="Надстрочный (x²)"
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <SuperscriptIcon size={13} />
        </ToolBtn>
        <ToolBtn
          title="Подстрочный (x₂)"
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <SubscriptIcon size={13} />
        </ToolBtn>
        <ToolBtn
          title="Убрать форматирование"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting size={13} />
        </ToolBtn>

        <Divider />

        <ToolBtn
          title="Нумерованный список"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={13} />
        </ToolBtn>
        <ToolBtn
          title="Маркированный список"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={13} />
        </ToolBtn>

        <Divider />

        <ToolBtn
          title="По левому краю"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={13} />
        </ToolBtn>
        <ToolBtn
          title="По центру"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={13} />
        </ToolBtn>
        <ToolBtn
          title="По правому краю"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={13} />
        </ToolBtn>

        <Divider />

        <ToolBtn title="Изображение" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={13} />
        </ToolBtn>
        <ToolBtn title="Редактировать выбранный SVG" onClick={openSelectedSvgEditor} disabled={!canEditSelectedSvg}>
          <FileCode2 size={13} />
        </ToolBtn>
        <ToolBtn title="Ссылка" active={editor.isActive('link')} onClick={insertLink}>
          <LinkIcon size={13} />
        </ToolBtn>
        <ToolBtn title="Таблица" active={editor.isActive('table')} onClick={insertTable}>
          <TableIcon size={13} />
        </ToolBtn>

        <Divider />

        {/* Math formula — inserts inline $formula$ */}
        <ToolBtn title="Формула (LaTeX)" onClick={insertMath}>
          <span className="font-serif italic text-sm leading-none">f<sub className="text-[9px]">x</sub></span>
        </ToolBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Hidden file input for images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = '';
        }}
      />

      {svgEditorOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-base font-black text-gray-900">Редактирование SVG</h3>
                <p className="text-xs text-gray-500">Измените исходный SVG и сохраните. Например, можно заменить fill="#ffffff" на fill="none".</p>
              </div>
              <button
                type="button"
                onClick={() => setSvgEditorOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-5 lg:grid-cols-[1fr_320px]">
              <textarea
                value={svgDraft}
                onChange={(event) => setSvgDraft(event.target.value)}
                spellCheck={false}
                className="min-h-[420px] resize-none rounded-xl border border-gray-200 bg-gray-950 p-4 font-mono text-xs leading-relaxed text-gray-100 outline-none focus:border-[#3F8C62]"
              />
              <div className="flex min-h-0 flex-col gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Предпросмотр</div>
                  <div
                    className="flex min-h-52 items-center justify-center rounded-lg bg-slate-900 p-3"
                    dangerouslySetInnerHTML={{ __html: svgDraft }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSvgDraft((current) => current.replaceAll('fill="#ffffff"', 'fill="none"').replaceAll("fill='#ffffff'", "fill='none'"))}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  Убрать белый фон
                </button>
                <button
                  type="button"
                  onClick={() => setSvgDraft((current) => adaptSvgForDarkBackground(current))}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100"
                >
                  Под тёмный фон
                </button>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">
                    Прозрачность сетки
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    defaultValue="0.28"
                    onChange={(event) => setSvgDraft((current) => setSvgGridOpacity(current, event.target.value))}
                    className="w-full"
                  />
                  <div className="mt-2 flex justify-between text-[11px] font-bold text-gray-400">
                    <span>тускло</span>
                    <span>ярко</span>
                  </div>
                </div>
                <div className="mt-auto flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSvgEditorOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={saveSelectedSvg}
                    className="rounded-xl bg-[#3F8C62] px-4 py-2 text-sm font-bold text-white hover:bg-[#357A54]"
                  >
                    Сохранить SVG
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table context toolbar (shown when inside table) */}
      {editor.isActive('table') && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-t border-gray-200 bg-blue-50 text-[11px] text-blue-700">
          <span className="font-medium mr-2">Таблица:</span>
          <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-0.5 rounded hover:bg-blue-100">+ столбец слева</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-0.5 rounded hover:bg-blue-100">+ столбец справа</button>
          <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-0.5 rounded hover:bg-blue-100">+ строку сверху</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-0.5 rounded hover:bg-blue-100">+ строку снизу</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-0.5 rounded hover:bg-red-100 text-red-600 ml-2">удалить таблицу</button>
        </div>
      )}
    </div>
  );
}
