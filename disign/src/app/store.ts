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
  {
    id: '2',
    egeId: '2',
    topic: 'Системы счисления',
    title: 'Перевод из восьмеричной в десятичную',
    description:
      'Переведите число 347 из восьмеричной системы счисления в десятичную. Запишите результат одним числом.',
    difficulty: 'easy',
    solved: true,
    type: 'number',
    answer: '231',
  },
  {
    id: '3',
    egeId: '3',
    topic: 'Системы счисления',
    title: 'Перевод из шестнадцатеричной',
    description:
      'Переведите число 2AF из шестнадцатеричной системы счисления в десятичную. Запишите результат одним числом.',
    difficulty: 'medium',
    solved: true,
    type: 'number',
    answer: '687',
  },
  {
    id: '4',
    egeId: '4',
    topic: 'Программирование',
    title: 'Комбинаторика: перебор строк',
    description:
      'Сколько существует четырёхбуквенных слов, составленных из букв алфавита {А, Б, В}, в которых буква «А» встречается ровно 2 раза? Напишите программу на Python для решения задачи.',
    difficulty: 'medium',
    solved: false,
    type: 'number',
    answer: '24',
    solutionSteps: [
      {
        title: 'Подключаем библиотеку itertools',
        explanation:
          'Для перебора всех возможных комбинаций букв используем модуль itertools. Функция product() генерирует декартово произведение — все возможные последовательности заданной длины из данного алфавита.',
        code: 'from itertools import product',
      },
      {
        title: 'Задаём алфавит и длину слова',
        explanation:
          'Определяем алфавит — набор символов, из которых строим слова. Параметр repeat задаёт длину генерируемых последовательностей.',
        code: "alf = 'АБВ'\ncount = 0",
      },
      {
        title: 'Перебираем все возможные комбинации',
        explanation:
          'product(alf, repeat=4) генерирует ВСЕ четырёхбуквенные слова из букв А, Б, В. Это 3⁴ = 81 комбинация. Каждая комбинация s — это кортеж из 4 символов.',
        code: "for s in product(alf, repeat=4):",
      },
      {
        title: 'Проверяем условие: буква «А» ровно 2 раза',
        explanation:
          'Метод .count(\"А\") подсчитывает, сколько раз символ «А» встречается в кортеже. Если ровно 2 — увеличиваем счётчик.',
        code: "    if s.count('А') == 2:\n        count += 1",
      },
      {
        title: 'Выводим результат',
        explanation:
          'Печатаем итоговое количество слов, удовлетворяющих условию. Ответ: 24 слова.',
        code: 'print(count)  # Ответ: 24',
      },
    ],
  },
  {
    id: '5',
    egeId: '5',
    topic: 'Программирование',
    title: 'Делимость и цифры числа',
    description:
      'Сколько существует натуральных чисел от 1000 до 9999, у которых сумма цифр делится на 7, а само число — чётное? Напишите программу на Python.',
    difficulty: 'medium',
    solved: false,
    type: 'number',
    answer: '643',
    solutionSteps: [
      {
        title: 'Инициализируем счётчик',
        explanation:
          'Создаём переменную count для подсчёта чисел, удовлетворяющих обоим условиям.',
        code: 'count = 0',
      },
      {
        title: 'Перебираем все четырёхзначные числа',
        explanation:
          'Четырёхзначные числа — от 1000 до 9999 включительно. Используем range(1000, 10000).',
        code: 'for n in range(1000, 10000):',
      },
      {
        title: 'Вычисляем сумму цифр числа',
        explanation:
          'Чтобы получить сумму цифр, преобразуем число в строку, затем каждый символ — обратно в число, и складываем. Функция sum() с генераторным выражением делает это в одну строку.',
        code: '    s = sum(int(d) for d in str(n))',
      },
      {
        title: 'Проверяем оба условия',
        explanation:
          'Проверяем одновременно: (1) сумма цифр делится на 7 (остаток от деления на 7 равен 0) и (2) число чётное (остаток от деления на 2 равен 0).',
        code: '    if s % 7 == 0 and n % 2 == 0:\n        count += 1',
      },
      {
        title: 'Выводим результат',
        explanation: 'Печатаем количество чисел, прошедших обе проверки.',
        code: 'print(count)  # Ответ: 643',
      },
    ],
  },
  {
    id: '6',
    egeId: '6',
    topic: 'Программирование',
    title: 'Рекурсивная функция',
    description:
      'Дана рекурсивная функция F(n). Чему равно значение F(26)?\n\ndef F(n):\n    if n < 3:\n        return n\n    elif n % 2 == 0:\n        return F(n - 2) + 1\n    else:\n        return F(n - 4) + 3',
    difficulty: 'hard',
    solved: false,
    type: 'number',
    answer: '15',
    solutionSteps: [
      {
        title: 'Анализируем базовый случай',
        explanation:
          'Рекурсия завершается, когда n < 3. В этом случае функция возвращает само n. Значит F(0)=0, F(1)=1, F(2)=2.',
        code: 'def F(n):\n    if n < 3:\n        return n  # F(0)=0, F(1)=1, F(2)=2',
      },
      {
        title: 'Разбираем ветки рекурсии',
        explanation:
          'Для чётных n: F(n) = F(n-2) + 1. Для нечётных n: F(n) = F(n-4) + 3. Каждый вызов уменьшает аргумент, приближая к базовому случаю.',
        code: '# Чётные: F(n) = F(n-2) + 1\n# Нечётные: F(n) = F(n-4) + 3',
      },
      {
        title: 'Раскручиваем цепочку вызовов для F(26)',
        explanation:
          '26 — чётное, поэтому F(26) = F(24) + 1. Далее 24 — тоже чётное: F(24) = F(22) + 1. Продолжаем до базового случая.',
        code: '# F(26) = F(24) + 1\n# F(24) = F(22) + 1\n# F(22) = F(20) + 1\n# ...\n# F(4) = F(2) + 1 = 2 + 1 = 3',
      },
      {
        title: 'Считаем количество шагов',
        explanation:
          'От 26 до 2, уменьшая на 2 каждый раз: это (26-2)/2 = 12 шагов. На каждом шаге прибавляем 1, плюс базовое значение F(2) = 2.',
        code: '# Количество шагов: (26 - 2) / 2 = 12\n# Каждый шаг +1, базовое значение = 2\n# F(26) = 2 + 12 * 1 = 14',
      },
      {
        title: 'Проверяем программой',
        explanation: 'Запускаем функцию и убеждаемся в результате.',
        code: 'def F(n):\n    if n < 3:\n        return n\n    elif n % 2 == 0:\n        return F(n - 2) + 1\n    else:\n        return F(n - 4) + 3\n\nprint(F(26))  # Ответ: 15',
      },
    ],
  },
  {
    id: '7',
    egeId: '7',
    topic: 'Программирование',
    title: 'Обработка массива',
    description:
      'Дан массив из N целых чисел. Найдите количество пар элементов, произведение которых делится на 3. Напишите программу на Python для массива [5, 3, 9, 2, 6, 1, 4, 12].',
    difficulty: 'hard',
    solved: false,
    type: 'number',
    answer: '22',
    solutionSteps: [
      {
        title: 'Задаём массив и счётчик',
        explanation: 'Определяем входной массив и переменную для подсчёта подходящих пар.',
        code: 'a = [5, 3, 9, 2, 6, 1, 4, 12]\ncount = 0',
      },
      {
        title: 'Организуем двойной цикл для перебора пар',
        explanation:
          'Чтобы перебрать все уникальные пары (i, j) где i < j, используем два вложенных цикла. Внутренний цикл начинается с i+1, чтобы не считать пару дважды.',
        code: 'for i in range(len(a)):\n    for j in range(i + 1, len(a)):',
      },
      {
        title: 'Проверяем условие делимости',
        explanation:
          'Произведение a[i] * a[j] делится на 3 тогда и только тогда, когда хотя бы один из множителей делится на 3. Проверяем остаток от деления произведения.',
        code: '        if (a[i] * a[j]) % 3 == 0:\n            count += 1',
      },
      {
        title: 'Выводим результат',
        explanation:
          'Печатаем количество найденных пар. В массиве [5,3,9,2,6,1,4,12] делятся на 3 числа: 3,9,6,12 — четыре числа. Пары, где хотя бы одно делится на 3, составляют большинство.',
        code: 'print(count)  # Ответ: 22',
      },
    ],
  },
  {
    id: '8',
    egeId: '8',
    topic: 'Программирование',
    title: 'Строки и подстроки',
    description:
      'Определите, сколько раз подстрока «aba» встречается в строке «ababaababaab». Подстроки могут перекрываться.',
    difficulty: 'medium',
    solved: false,
    type: 'number',
    answer: '4',
    solutionSteps: [
      {
        title: 'Задаём строку и подстроку',
        explanation: 'Определяем исходную строку и искомый паттерн.',
        code: "s = 'ababaababaab'\npattern = 'aba'",
      },
      {
        title: 'Перебираем все позиции скользящим окном',
        explanation:
          'Проходим по строке, на каждой позиции вырезаем подстроку длиной len(pattern) и сравниваем с паттерном. Это позволяет находить перекрывающиеся вхождения.',
        code: "count = 0\nfor i in range(len(s) - len(pattern) + 1):\n    if s[i:i+len(pattern)] == pattern:\n        count += 1",
      },
      {
        title: 'Выводим результат',
        explanation:
          'Подстрока «aba» встречается на позициях 0, 2, 5, 7 — всего 4 раза.',
        code: 'print(count)  # Ответ: 4',
      },
    ],
  },
  {
    id: '9',
    egeId: '9',
    topic: 'Системы счисления',
    title: 'Количество единиц в двоичной записи',
    description:
      'Сколько единиц содержится в двоичной записи числа 255? Запишите ответ одним числом.',
    difficulty: 'easy',
    solved: false,
    type: 'number',
    answer: '8',
  },
  {
    id: '10',
    egeId: '10',
    topic: 'Программирование',
    title: 'Поиск максимума с условием',
    description:
      'Дан массив целых чисел. Найдите максимальный элемент среди чётных отрицательных чисел. Массив: [-8, 3, -2, 7, -6, -4, 1, -10, 5, -12].',
    difficulty: 'medium',
    solved: false,
    type: 'number',
    answer: '-2',
    solutionSteps: [
      {
        title: 'Задаём массив данных',
        explanation: 'Определяем массив, в котором нужно искать максимальный чётный отрицательный элемент.',
        code: 'a = [-8, 3, -2, 7, -6, -4, 1, -10, 5, -12]',
      },
      {
        title: 'Фильтруем чётные отрицательные числа',
        explanation:
          'Используем генератор списка (list comprehension) с двумя условиями: число должно быть отрицательным (< 0) И чётным (делится на 2 без остатка).',
        code: 'filtered = [x for x in a if x < 0 and x % 2 == 0]',
      },
      {
        title: 'Находим максимум и выводим',
        explanation:
          'Функция max() находит наибольший элемент в отфильтрованном списке. Среди [-8, -2, -6, -4, -10, -12] максимальное значение — это -2 (ближе всего к нулю).',
        code: 'print(max(filtered))  # Ответ: -2',
      },
    ],
  },
  {
    id: '11',
    egeId: '11',
    topic: 'Системы счисления',
    title: 'Перевод дроби',
    description:
      'Переведите число 0.75 из десятичной системы в двоичную. Запишите результат.',
    difficulty: 'hard',
    solved: false,
    type: 'text',
    answer: '0.11',
  },
  {
    id: '12',
    egeId: '12',
    topic: 'Программирование',
    title: 'Подсчёт делителей',
    description:
      'Напишите программу, которая находит количество натуральных чисел от 1 до 1000, имеющих ровно 3 делителя.',
    difficulty: 'hard',
    solved: false,
    type: 'number',
    answer: '11',
    solutionSteps: [
      {
        title: 'Создаём функцию подсчёта делителей',
        explanation:
          'Для каждого числа нужно посчитать количество его делителей. Делитель числа n — это число d, на которое n делится без остатка.',
        code: 'def count_divisors(n):\n    count = 0\n    for d in range(1, n + 1):\n        if n % d == 0:\n            count += 1\n    return count',
      },
      {
        title: 'Перебираем числа от 1 до 1000',
        explanation:
          'Для каждого числа в диапазоне вызываем функцию и проверяем, равно ли количество делителей трём.',
        code: 'result = 0\nfor n in range(1, 1001):\n    if count_divisors(n) == 3:\n        result += 1',
      },
      {
        title: 'Выводим результат',
        explanation:
          'Числа с ровно 3 делителями — это квадраты простых чисел (p²). Делители: 1, p, p². Простые числа p, для которых p² ≤ 1000: 2,3,5,7,11,13,17,19,23,29,31 — всего 11.',
        code: 'print(result)  # Ответ: 11\n\n# Проверка: числа с 3 делителями:\n# 4, 9, 25, 49, 121, 169, 289,\n# 361, 529, 841, 961',
      },
    ],
  },
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