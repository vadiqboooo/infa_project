import { ExamVariant } from '../store';

// Helper to generate question id
const qid = (v: number, q: number) => `v${v}q${q}`;

export const MOCK_EXAM_VARIANTS: ExamVariant[] = [
  {
    id: 'v1',
    number: 1,
    title: 'Тренировочный вариант',
    year: 2026,
    totalQuestions: 27,
    timeLimitMinutes: 235,
    maxScore: 29,
    score: 24,
    questions: [
      { id: qid(1,1), egeNumber: 1, topic: 'Системы счисления', title: 'Перевод чисел', description: 'Переведите число 110101 из двоичной системы счисления в десятичную. Запишите результат.', difficulty: 'easy', answer: '53' },
    ],
  },
];
