import React, { useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
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
      Image.configure({ inline: false, allowBase64: true }),
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
