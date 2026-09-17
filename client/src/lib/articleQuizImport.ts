import type { AdminArticleQuestion } from '../api/articles';

const QUESTION = /^(\d+)[.)]\s+(.+)$/u;
const OPTION = /^([A-Za-zА-Яа-яЁё])[.)]\s+(.+)$/u;
const ANSWER = /^(?:правильны[йе]\s+ответ[ы]?|ответ[ы]?)\s*:\s*(.*)$/iu;
const MULTIPLE = /(?:выбер(?:и|ите)|отметь(?:те)?)\s+все|несколько\s+(?:правильных|верных|ответов|вариантов)/iu;

/** Parse pasted quiz text without guessing any correct answers. */
export function parseArticleQuiz(text: string): AdminArticleQuestion[] {
  const blocks: { number: string; lines: string[] }[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const question = line.match(QUESTION);
    if (question) blocks.push({ number: question[1], lines: [question[2]] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
    // An optional heading before the first question is not part of the quiz.
  }
  if (!blocks.length) throw new Error('Не найдены вопросы. Начинайте каждый вопрос с номера: 1. Текст вопроса');
  if (blocks.length > 100) throw new Error('В тесте может быть не больше 100 вопросов.');

  return blocks.map(({ number, lines }) => {
    const fail = (message: string): never => { throw new Error(`Вопрос ${number}: ${message}`); };
    const prompt = [lines[0]];
    const options: string[] = [];
    const labels: string[] = [];
    let answer: string | undefined;
    for (const line of lines.slice(1)) {
      const key = line.match(ANSWER);
      const option = line.match(OPTION);
      if (key) {
        if (answer !== undefined) fail('оставьте одну строку «Ответ: …».');
        answer = key[1];
      } else if (answer !== undefined) {
        fail('строка «Ответ: …» должна находиться после всех вариантов.');
      } else if (option) {
        const label = option[1].toLocaleUpperCase('ru');
        if (labels.includes(label)) fail(`буква ${label} используется для нескольких вариантов.`);
        labels.push(label);
        options.push(option[2]);
      } else if (/^(?:верно|неверно)$/iu.test(line)) {
        labels.push(line.toLocaleUpperCase('ru'));
        options.push(line);
      } else if (options.length) {
        options[options.length - 1] += `\n${line}`;
      } else {
        prompt.push(line);
      }
    }
    if (options.length < 2 || options.length > 10) fail('нужно от 2 до 10 вариантов с буквами A., B. и т. д. или строки «Верно» и «Неверно».');
    if (new Set(options).size !== options.length) fail('варианты ответа должны различаться.');
    const questionText = prompt.join('\n');
    if (questionText.length > 2000 || options.some(option => option.length > 2000)) fail('текст вопроса и каждого варианта должен быть не длиннее 2000 символов.');

    const boolean = options.length === 2 && options.some(option => /^верно$/iu.test(option)) && options.some(option => /^неверно$/iu.test(option));
    const correct: number[] = [];
    if (answer !== undefined) {
      const tokens = answer.split(/[,;\s]+/u).filter(Boolean);
      if (!tokens.length) fail('после «Ответ:» укажите букву правильного варианта.');
      for (const token of tokens) {
        const label = token.replace(/[.)]$/u, '').toLocaleUpperCase('ru');
        let index = labels.indexOf(label);
        if (index < 0 && boolean) index = options.findIndex(option => option.toLocaleUpperCase('ru') === label);
        if (index < 0) fail(`ответ «${token}» не совпадает с обозначением варианта.`);
        if (!correct.includes(index)) correct.push(index);
      }
    }
    if (boolean && correct.length > 1) fail('для «Верно / Неверно» укажите один правильный ответ.');
    return {
      prompt: questionText,
      type: boolean ? 'boolean' : correct.length > 1 || MULTIPLE.test(questionText) ? 'multiple' : 'single',
      options: boolean ? ['Верно', 'Неверно'] : options,
      correct_answers: boolean ? correct.map(index => /^верно$/iu.test(options[index]) ? 0 : 1) : correct,
      explanation: '',
    };
  });
}
