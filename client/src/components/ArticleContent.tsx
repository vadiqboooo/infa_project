import { useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { articleHtmlDocument } from '../lib/articleHtml';
import { useTheme } from '../context/ThemeContext';
import '../pages/ArticlePage.css';
import '../styles/articleReading.css';

export function ArticleContent({ content, format = 'markdown' }: { content: string; format?: 'markdown' | 'html' }) {
  if (format === 'html') return <HtmlArticle content={content} />;
  return <div className="article-prose article-reading"><ReactMarkdown>{content}</ReactMarkdown></div>;
}

function HtmlArticle({ content }: { content: string }) {
  const { theme } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const cleanup = useRef<() => void>(() => {});
  const source = useMemo(() => articleHtmlDocument(content, theme), [content, theme]);
  useEffect(() => () => cleanup.current(), []);

  const onLoad = () => {
    cleanup.current();
    const element = frame.current;
    const document = element?.contentDocument;
    if (!element || !document?.body) return;
    const resize = () => {
      const style = getComputedStyle(document.body);
      const height = Math.ceil(document.body.getBoundingClientRect().height + parseFloat(style.marginTop || '0') + parseFloat(style.marginBottom || '0'));
      element.style.height = `${Math.max(160, height)}px`;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(document.body);
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.('a[href]');
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#')) {
        try { document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView(); } catch { /* malformed anchor */ }
      } else if (/^https?:\/\//i.test(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };
    document.addEventListener('click', onClick);
    resize();
    cleanup.current = () => { observer.disconnect(); document.removeEventListener('click', onClick); };
  };
  // Never add allow-scripts: allow-same-origin exists only to measure the content.
  return <iframe ref={frame} className="article-html-frame" title="Текст HTML-статьи" sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={source} onLoad={onLoad} />;
}
