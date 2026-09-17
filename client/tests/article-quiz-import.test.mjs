import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseArticleQuiz } from '../src/lib/articleQuizImport.ts';

const example = readFileSync(new URL('./fixtures/image-quiz.txt', import.meta.url), 'utf8');

test('imports all ten supplied questions, detects their types and never invents answers', () => {
  const questions = parseArticleQuiz(example);
  assert.equal(questions.length, 10);
  assert.deepEqual(questions.map(question => question.type), ['single', 'single', 'boolean', 'single', 'single', 'multiple', 'boolean', 'single', 'single', 'single']);
  assert.deepEqual(questions.map(question => question.options.length), [4, 4, 2, 4, 4, 4, 2, 4, 4, 4]);
  assert.ok(questions.every(question => question.correct_answers.length === 0));
  assert.equal(questions[0].prompt, 'Почему, согласно статье, изображение вообще нужно кодировать?');
  assert.equal(questions[9].options[3], 'Как называется файл; кто сделал фотографию; когда она была создана');
  assert.deepEqual(questions[2].options, ['Верно', 'Неверно']);
});

test('imports explicit answers for the full example, including multiple and boolean answers', () => {
  const keys = ['B', 'C', 'Верно', 'A', 'D', 'B, C, D', 'Неверно', 'D', 'A', 'B'];
  const withKeys = example.replace(/(^\d+[.)] [\s\S]*?)(?=^\d+[.)] |$(?![\s\S]))/gm, (block) => `${block.trim()}\nОтвет: ${keys.shift()}\n\n`);
  assert.deepEqual(parseArticleQuiz(withKeys).map(question => question.correct_answers), [[1], [2], [0], [0], [3], [1, 2, 3], [1], [3], [0], [1]]);
});

test('supports CRLF, Cyrillic labels, parentheses and wrapped text', () => {
  const [question] = parseArticleQuiz('Название\r\n\r\n1) Первая строка\r\nвторая строка\r\nА) Первый\r\nпродолжение варианта\r\nБ) Второй\r\nПравильный ответ: Б');
  assert.equal(question.prompt, 'Первая строка\nвторая строка');
  assert.deepEqual(question.options, ['Первый\nпродолжение варианта', 'Второй']);
  assert.deepEqual(question.correct_answers, [1]);
});

test('several explicit answers select multiple choice even without a hint', () => {
  const [question] = parseArticleQuiz('1. Какие цвета?\nA. Красный\nB. Зелёный\nC. Круглый\nОтветы: a; b');
  assert.equal(question.type, 'multiple');
  assert.deepEqual(question.correct_answers, [0, 1]);
});

test('normalizes reversed boolean options while preserving the correct answer', () => {
  const [question] = parseArticleQuiz('1. Утверждение\nA. неверно\nB. верно\nОтвет: A');
  assert.equal(question.type, 'boolean');
  assert.deepEqual(question.options, ['Верно', 'Неверно']);
  assert.deepEqual(question.correct_answers, [1]);
});

test('rejects malformed blocks and unknown keys instead of importing a partial quiz', () => {
  for (const input of ['', 'Только заголовок', '1. Вопрос\nA. Один', '1. Вопрос\nA. Один\nB. Один', '1. Вопрос\nA. Один\nA. Два', '1. Вопрос\nA. Один\nB. Два\nОтвет: C', '1. Вопрос\nA. Один\nB. Два\nОтвет:', '1. Вопрос\nВерно\nНеверно\nОтвет: Верно, Неверно']) {
    assert.throws(() => parseArticleQuiz(input));
  }
  assert.throws(() => parseArticleQuiz('1. Хороший\nA. Один\nB. Два\n2. Неполный'), /Вопрос 2/);
  assert.throws(() => parseArticleQuiz('1. Вопрос\nA. Один\nB. Два\nОтвет: A\nОтвет: B'), /одну строку/);
  assert.throws(() => parseArticleQuiz('1. Вопрос\nA. Один\nОтвет: A\nB. Два'), /после всех вариантов/);
});

test('enforces server size limits before import', () => {
  assert.throws(() => parseArticleQuiz(Array.from({ length: 101 }, (_, i) => `${i + 1}. Вопрос\nA. Один\nB. Два`).join('\n')), /100/);
  assert.equal(parseArticleQuiz(Array.from({ length: 100 }, (_, i) => `${i + 1}. Вопрос\nA. Один\nB. Два`).join('\n')).length, 100);
  assert.throws(() => parseArticleQuiz(`1. ${'я'.repeat(2001)}\nA. Один\nB. Два`), /2000/);
  assert.throws(() => parseArticleQuiz(`1. Вопрос\nA. ${'я'.repeat(2001)}\nB. Два`), /2000/);
  assert.throws(() => parseArticleQuiz(`1. Вопрос\n${Array.from({ length: 11 }, (_, i) => `${String.fromCharCode(65 + i)}. Вариант ${i}`).join('\n')}`), /10 вариантов/);
});
