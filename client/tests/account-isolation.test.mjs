import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readUserStorage, writeUserStorage } from '../src/lib/userStorage.ts';
import { api, authFetch, setToken, clearToken } from '../src/api/client.ts';

let entries;
let redirects;
beforeEach(() => {
    entries = new Map();
    redirects = [];
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key) => entries.get(key) ?? null,
            setItem: (key, value) => entries.set(key, value),
            removeItem: (key) => entries.delete(key),
        },
    });
    globalThis.window = { location: { pathname: '/tasks/1', replace: (url) => redirects.push(url) } };
});

for (const name of ['edu_task_answers', 'edu_task_sub_answers', 'task-annotations:task-42']) {
    test(`${name}: A → B → A preserves each student's own draft`, () => {
        const alice = { 42: 'Alice answer' };
        const bob = { 42: 'Bob answer' };
        writeUserStorage(1, name, alice);
        assert.deepEqual(readUserStorage(2, name, {}), {});
        writeUserStorage(2, name, bob);
        assert.deepEqual(readUserStorage(1, name, {}), alice);
        assert.deepEqual(readUserStorage(2, name, {}), bob);
    });
}

test('shared legacy drafts are not assigned to the next person to log in', () => {
    entries.set('edu_task_answers', JSON.stringify({ 42: 'Unknown owner' }));
    assert.deepEqual(readUserStorage(1, 'edu_task_answers', {}), {});
    assert.deepEqual(readUserStorage(2, 'edu_task_answers', {}), {});
    assert.ok(entries.has('edu_task_answers')); // No destructive migration.
});

test('no answers can be read or written before identity is known', () => {
    writeUserStorage(null, 'edu_task_answers', { 42: 'answer' });
    assert.equal(entries.size, 0);
    assert.deepEqual(readUserStorage(undefined, 'edu_task_answers', {}), {});
});

test('invalid or unavailable local storage does not stop task solving', () => {
    entries.set('user:1:edu_task_answers', '{broken');
    assert.deepEqual(readUserStorage(1, 'edu_task_answers', {}), {});
    globalThis.localStorage.getItem = () => { throw new Error('unavailable'); };
    globalThis.localStorage.setItem = () => { throw new Error('quota'); };
    assert.deepEqual(readUserStorage(1, 'edu_task_answers', {}), {});
    assert.doesNotThrow(() => writeUserStorage(1, 'edu_task_answers', { 42: 5 }));
});

for (const request of [() => api('/tasks/42'), () => authFetch('/api/tasks/42/solution')]) {
    test('a late response from A cannot supply B with data or log B out', async () => {
        for (const status of [200, 401]) {
            setToken('alice');
            let respond;
            globalThis.fetch = () => new Promise((resolve) => { respond = resolve; });
            const pending = request();
            setToken('bob');
            respond(new Response(JSON.stringify({ answer: 'Alice' }), { status }));
            await assert.rejects(pending, /Аккаунт изменился/);
            assert.equal(localStorage.getItem('jwt_token'), 'bob');
            assert.deepEqual(redirects, []);
        }
    });
}

test('session expiry handling works again after logging in as another student', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    for (const token of ['alice', 'bob']) {
        setToken(token);
        await assert.rejects(api('/tasks/42'), /Сессия истекла/);
        assert.equal(localStorage.getItem('jwt_token'), null);
    }
    assert.equal(redirects.length, 2);
});

test('an in-flight request cannot restore data after logout', async () => {
    setToken('alice');
    let respond;
    globalThis.fetch = () => new Promise((resolve) => { respond = resolve; });
    const pending = api('/navigation');
    clearToken();
    respond(new Response('[]'));
    await assert.rejects(pending, /Аккаунт изменился/);
});
