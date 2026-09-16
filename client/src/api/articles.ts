import { authFetch } from './client';

export interface ArticleQuestion {
  prompt: string;
  type: 'single' | 'multiple' | 'boolean';
  options: string[];
}
export interface AdminArticleQuestion extends ArticleQuestion {
  correct_answers: number[];
  explanation: string;
}
export interface ArticleDraft {
  title: string;
  content: string;
  content_format: 'markdown' | 'html';
  published: boolean;
  questions: AdminArticleQuestion[];
}
export interface AdminArticle extends ArticleDraft { id: number; revision: number }
export interface ArticleSummary { id: number; title: string; published: boolean; question_count: number }
export interface ArticleProgress {
  read: boolean;
  best_score: number;
  total: number;
  attempts: number;
  completed: boolean;
}
export interface StudentArticle {
  id: number;
  revision: number;
  title: string;
  content: string;
  content_format: 'markdown' | 'html';
  questions: ArticleQuestion[];
  progress: ArticleProgress;
}
export interface QuizResult {
  score: number;
  total: number;
  progress: ArticleProgress;
}

export async function articleRequest<T>(path: string, options: RequestInit = {}, apiKey?: string): Promise<T> {
  const response = await authFetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    throw new Error(Array.isArray(detail) ? detail.map((item: { msg: string }) => item.msg.replace(/^Value error, /, '')).join('. ')
      : typeof detail === 'string' ? detail : 'Не удалось выполнить запрос');
  }
  return body;
}
