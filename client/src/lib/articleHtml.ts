import readingStyles from '../styles/articleReading.css?inline';

export const ARTICLE_CONTENT_LIMIT = 200_000;

export async function importArticleHtml(file: File) {
  if (!/\.html?$/i.test(file.name)) throw new Error('Выберите файл .html или .htm');
  if (file.size > 2_000_000) throw new Error('HTML-файл слишком большой. Максимум — 200 000 символов.');
  const bytes = await file.arrayBuffer();
  // Old exported articles can declare Windows-1251 instead of UTF-8.
  const header = new TextDecoder('windows-1252').decode(bytes.slice(0, 4096));
  const charset = header.match(/<meta\b[^>]*charset\s*=\s*["']?\s*([\w-]+)/i)?.[1];
  let content: string;
  try { content = new TextDecoder(charset || 'utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Не удалось прочитать кодировку. Сохраните HTML-файл в UTF-8 и загрузите снова.'); }
  if (!content.trim()) throw new Error('HTML-файл пуст');
  if ([...content].length > ARTICLE_CONTENT_LIMIT) throw new Error('HTML-файл слишком большой. Максимум — 200 000 символов.');
  const document = new DOMParser().parseFromString(content, 'text/html');
  const title = (document.querySelector('h1')?.textContent || document.title || file.name.replace(/\.html?$/i, '')).trim().slice(0, 200);
  const localResources = Array.from(document.querySelectorAll('[src], link[href]')).some(element => {
    const url = element.getAttribute('src') || element.getAttribute('href') || '';
    return url && !/^(https?:|data:|\/\/|#)/i.test(url);
  });
  return { content, title, localResources };
}

/** Preserve document styles inside a script-disabled frame, never the app DOM. */
export function articleHtmlDocument(content: string, theme: 'light' | 'dark' = 'light') {
  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('script, base, meta[http-equiv], iframe, frame, frameset, object, embed').forEach(element => element.remove());
  document.querySelectorAll('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || ['srcdoc', 'autofocus', 'ping'].includes(attribute.name)) element.removeAttribute(attribute.name);
    }
  });
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: http:; img-src https: http: data:; font-src https: http: data:; media-src https: http: data:; form-action 'none'; base-uri 'none'";
  document.head.prepend(policy);
  const referrer = document.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  document.head.prepend(referrer);
  // Fallback typography for fragments; the imported document can override it.
  const defaults = document.createElement('style');
  defaults.textContent = 'html { color-scheme: light; } body { display: flow-root; margin: 0; padding: 0; background: #fff; color: #172033; font: 17px/1.8 system-ui, sans-serif; overflow-wrap: anywhere; } img, svg, video { max-width: 100%; } pre { overflow-x: auto; }';
  document.head.insertBefore(defaults, policy.nextSibling);
  const sizing = document.createElement('style');
  sizing.textContent = 'html { color-scheme: normal !important; background: transparent !important; } html, body { height: auto !important; min-height: 0 !important; }';
  document.head.append(sizing);
  document.body.classList.add('article-reading', 'article-reading--html');
  document.body.dataset.readingTheme = theme;
  const typography = document.createElement('style');
  typography.textContent = readingStyles;
  document.body.append(typography);
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}
