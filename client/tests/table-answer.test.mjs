import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';
import { parseTableString } from '../src/lib/tableAnswer.ts';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../src/components/AnswerInput.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
let effects = [];
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'react') return { ...React, useMemo: fn => fn(), useEffect: fn => effects.push(fn) };
    if (name === '../lib/tableAnswer') return { parseTableString };
    if (name.endsWith('.css')) return {};
    return require(name);
}, module, module.exports);
function inputsOf(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(inputsOf);
    return [...(node.type === 'input' ? [node.props] : []), ...inputsOf(node.props?.children)];
}
function render(props) {
    effects = [];
    return { inputs: inputsOf(module.exports.default({ onChange() {}, ...props })), runEffects: () => effects.forEach(fn => fn()) };
}
test('three-column table edits each cell independently', () => {
    let value = [[8, 22, 23]];
    const { inputs } = render({ type: 'table', egeNumber: 20, table: { cols: 3, rows: 1 }, value, onChange: next => { value = next; } });
    assert.deepEqual(inputs.map(input => input.value), ['8', '22', '23']);
    inputs[2].onChange({ target: { value: '24' } });
    assert.deepEqual(value, [[8, 22, 24]]);
});
test('old three-number draft is saved exactly as displayed', () => {
    let value = [[8, 22], [23, ''], ['', '']];
    const { inputs, runEffects } = render({ type: 'table', egeNumber: 20, table: { cols: 3, rows: 1 }, value, onChange: next => { value = next; } });
    assert.deepEqual(inputs.map(input => input.value), ['8', '22', '23']);
    runEffects();
    assert.deepEqual(value, [[8, 22, 23]]);
});
test('two-column tables retain their extra row without rewriting drafts', () => {
    for (const table of [undefined, { cols: 2, rows: 1 }]) {
        const { inputs, runEffects } = render({ type: 'table', value: [[1, 2]], table, onChange: () => assert.fail('legacy draft rewritten') });
        assert.deepEqual(inputs.map(input => input.value), ['1', '2', '', '']);
        runEffects();
    }
});
test('task 27 retains two sections of two cells', () => {
    const { inputs, runEffects } = render({ type: 'table', egeNumber: 27, value: [[1, 2], [3, 4]], table: { cols: 3, rows: 1 }, onChange: () => assert.fail('task 27 rewritten') });
    assert.deepEqual(inputs.map(input => input.value), ['1', '2', '3', '4']);
    runEffects();
});
test('single number, pair and text retain their values and payloads', () => {
    for (const [type, value, expected, changed] of [
        ['single_number', 8, ['8'], 9], ['pair', [8, 22], ['8', '22'], [9, 22]], ['text', 'hello', ['hello'], '9'],
    ]) {
        let next;
        const { inputs, runEffects } = render({ type, value, onChange: val => { next = val; } });
        assert.deepEqual(inputs.map(input => input.value), expected);
        runEffects();
        assert.equal(next, undefined);
        inputs[0].onChange({ target: { value: '9' } });
        assert.deepEqual(next, changed);
    }
});
test('one-column and multirow matrices use declared dimensions', () => {
    assert.deepEqual(parseTableString('', 20, { cols: 1, rows: 3 }), [[''], [''], ['']]);
    assert.deepEqual(parseTableString([[1, 2, 3], [4, 5, 6]], 20, { cols: 3, rows: 2 }), [[1, 2, 3], [4, 5, 6]]);
    assert.deepEqual(parseTableString('', 27), [['', ''], ['', '']]);
});

test('math lettered parts keep their flat answer format', () => {
    for (const number of [13, 19]) {
        let value = number === 13 ? ['1', '2'] : ['1', '2', '3'];
        const { inputs, runEffects } = render({ type: 'table', isMath: true, examType: 'ege', egeNumber: number,
            table: { cols: 3, rows: 1 }, value, onChange: next => { value = next; } });
        assert.deepEqual(inputs.map(input => input.value), value);
        runEffects();
        assert.equal(Array.isArray(value[0]), false);
        inputs[0].onChange({ target: { value: '9' } });
        assert.equal(value[0], '9');
    }
});
test('math proof and number keep their two-part payload', () => {
    for (const number of [14, 17]) {
        let value = ['Proof', 5];
        const { inputs, runEffects } = render({ type: 'table', isMath: true, examType: 'ege', egeNumber: number,
            table: { cols: 3, rows: 1 }, value, onChange: next => { value = next; } });
        assert.deepEqual(inputs.map(input => input.value), ['5']);
        runEffects();
        assert.deepEqual(value, ['Proof', 5]);
        inputs[0].onChange({ target: { value: '6' } });
        assert.deepEqual(value, ['Proof', 6]);
    }
});
test('disabled answers never rewrite saved values', () => {
    const { inputs, runEffects } = render({ type: 'table', egeNumber: 20, disabled: true,
        table: { cols: 3, rows: 1 }, value: [[8, 22], [23, '']], onChange: () => assert.fail('disabled value rewritten') });
    assert.equal(inputs.length, 3);
    assert.ok(inputs.every(input => input.disabled));
    runEffects();
});
test('file upload and mathematical expression inputs retain their payloads', () => {
    let uploaded;
    const file = { name: 'answer.py' };
    const upload = render({ type: 'file', value: '', onFileUpload: next => { uploaded = next; } });
    upload.runEffects();
    upload.inputs[0].onChange({ target: { files: [file], value: 'file' } });
    assert.equal(uploaded, file);
    let value;
    const expression = render({ type: 'math_expression', value: 'sqrt(2)', onChange: next => { value = next; } });
    assert.equal(expression.inputs[0].value, 'sqrt(2)');
    expression.inputs[0].onChange({ target: { value: 'sqrt(3)' } });
    assert.equal(value, 'sqrt(3)');
});

test('incomplete and overfilled old drafts do not lose entered cells', () => {
    assert.deepEqual(parseTableString([[8, 22], ['', '']], 20, { cols: 3, rows: 1 }), [[8, 22, '']]);
    assert.deepEqual(parseTableString([[8, 22], [23, 24]], 20, { cols: 3, rows: 1 }), [[8, 22, 23], [24, '', '']]);
});
