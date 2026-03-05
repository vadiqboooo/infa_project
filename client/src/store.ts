import { create } from 'zustand';
import { MOCK_EXAM_VARIANTS } from './data/examVariants';

// Types
export interface SolutionStep {
  title: string;
  explanation: string;
  code: string;
}

export interface Task {
  id: string;
  egeId: string;
  topic: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  solved: boolean;
  type: 'number' | 'text' | 'choice';
  answer?: string;
  solutionSteps?: SolutionStep[];
}

export interface Exam {
  id: string;
  title: string;
  timeLeft: number;
  questions: Task[];
}

export interface ExamVariant {
  id: string;
  number: number;
  title: string;
  year: number;
  totalQuestions: number;
  timeLimitMinutes: number;
  maxScore: number;
  score: number | null; // null if not solved
  questions: ExamQuestion[];
}

export interface ExamQuestion {
  id: string;
  egeNumber: number;
  topic: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answer: string;
}

interface AppState {
  user: { name: string; role: 'student' | 'admin' } | null;
  tasks: Task[];
  activeExam: Exam | null;
  examVariants: ExamVariant[];
  setUser: (user: { name: string; role: 'student' | 'admin' } | null) => void;
  toggleTaskSolved: (taskId: string) => void;
  setExamScore: (variantId: string, score: number) => void;
}

const MOCK_TASKS: Task[] = [
  {
    id: '1',
    egeId: '1',
    topic: 'Системы счисления',
    title: 'Перевод из двоичной в десятичную',
    description:
      'Переведите число 1011010 из двоичной системы счисления в десятичную. Запишите результат одним числом.',
    difficulty: 'easy',
    solved: false,
    type: 'number',
    answer: '90',
    solutionSteps: [
      {
        title: 'Записываем разряды числа',
        explanation:
          'Каждый разряд двоичного числа имеет вес — степень двойки, начиная с 0 справа. Выпишем разряды числа 1011010.',
        code: '# Число: 1 0 1 1 0 1 0\n# Разряд: 6 5 4 3 2 1 0',
      },
      {
        title: 'Умножаем каждый разряд на степень двойки',
        explanation:
          'Умножаем значение каждого разряда (0 или 1) на 2 в степени номера разряда.',
        code: '1 * 2**6 = 64\n0 * 2**5 = 0\n1 * 2**4 = 16\n1 * 2**3 = 8\n0 * 2**2 = 0\n1 * 2**1 = 2\n0 * 2**0 = 0',
      },
      {
        title: 'Суммируем результаты',
        explanation: 'Складываем все полученные значения, чтобы получить число в десятичной системе.',
        code: '64 + 0 + 16 + 8 + 0 + 2 + 0 = 90\n\n# Ответ: 90',
      },
    ],
  },
  // ... (keeping only a few mock tasks for brevity in this file, or full if needed)
];

export const useStore = create<AppState>((set) => ({
  user: { name: 'Владислав К.', role: 'admin' },
  tasks: MOCK_TASKS,
  activeExam: null,
  examVariants: MOCK_EXAM_VARIANTS,
  setUser: (user) => set({ user }),
  toggleTaskSolved: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, solved: !t.solved } : t
      ),
    })),
  setExamScore: (variantId, score) =>
    set((state) => ({
      examVariants: state.examVariants.map((v) =>
        v.id === variantId ? { ...v, score } : v
      ),
    })),
}));
