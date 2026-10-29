import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/pages/TasksPage.tsx', import.meta.url), 'utf8');
const file = ts.createSourceFile('TasksPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

test('composite subtask conditions and independent inputs are in the live render branch', () => {
    let section;
    function visit(node) {
        if (ts.isJsxExpression(node) && node.expression?.getText(file).startsWith('task.sub_tasks && task.sub_tasks.length > 0 && (')) section = node;
        ts.forEachChild(node, visit);
    }
    visit(file);
    assert.ok(section, 'composite section exists');
    for (let parent = section.parent; parent; parent = parent.parent) {
        if (ts.isJsxExpression(parent)) assert.ok(!parent.expression?.getText(file).startsWith('false &&'), 'subtasks must not be hidden by false &&');
    }
    const compiled = ts.transpileModule(`return (${section.expression.getText(file)});`, {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const inputs = [];
    let saved = { '42:0': 15, '42:1': 24, '99:0': 100 };
    const render = new Function('require', 'exports', 'task', 'TaskView', 'AnswerInput', 'canAnnotateTask', 'annotationRefreshKey', 'openRecognizedDrawingSolution', 'subResults', 'savedSubAnswers', 'setSavedSubAnswers', 'setCheckResult', 'setSubResults', 'isMathTask', 'taskExamType', 'check', 'viewingFinishedExam', 'handleCheck', 'clsx', compiled);
    const html = renderToStaticMarkup(render(require, {}, {
        id: 42, sub_tasks: [
            { number: 20, content_html: 'Condition 20', answer_type: 'single_number' },
            { number: 21, content_html: 'Condition 21', answer_type: 'single_number' },
        ],
    }, ({ content }) => content, props => { inputs.push(props); return null; }, false, 0, undefined,
    null, saved, update => { saved = update(saved); }, () => {}, () => {}, false, 'ege', { isPending: false }, false, () => {}, () => ''));
    assert.match(html, /Condition 20/);
    assert.match(html, /Condition 21/);
    assert.deepEqual(inputs.map(input => input.value), [15, 24]);
    inputs[0].onChange(16);
    assert.deepEqual(saved, { '42:0': 16, '42:1': 24, '99:0': 100 });
    inputs[1].onChange(25);
    assert.deepEqual(saved, { '42:0': 16, '42:1': 25, '99:0': 100 });
});
