import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Tab } from '../src/browser-api.ts';
import { browser } from './browser.ts';

void test('ignores malformed creation events', async () => {
  const b = await browser();
  b.api.tabs.onCreated.emit({ windowId: 10, active: false });
  b.api.tabs.onCreated.emit({ id: Number.NaN, windowId: 10, active: false });
  b.api.tabs.onCreated.emit({ id: 2, windowId: Number.NaN, active: false });
  await b.idle();
  assert.equal(b.moves.length, 0);
  assert.equal(b.errors.length, 0);
});

void test('rechecks a manual move that happens during the sibling query', async () => {
  const b = await browser();
  const originalQuery = b.api.tabs.query;
  b.api.tabs.query = async (query): Promise<Tab[]> => {
    const result = await originalQuery(query);
    b.tab(2).windowId = 99;
    return result;
  };
  b.add(2);
  await b.idle();
  assert.equal(b.moves.length, 0);
});

void test('a failing error badge does not poison the event queue', async () => {
  const b = await browser();
  b.api.action.setBadgeText = (): Promise<void> =>
    Promise.reject(new Error('Badge unavailable'));
  b.fail(new Error('Move unavailable'));
  b.add(2);
  await b.idle();
  assert.equal(b.errors.length, 2);
  b.add(3);
  await b.idle();
  assert.equal(b.move().tabId, 3);
});

void test('lifecycle events do not sweep existing tabs', async () => {
  const b = await browser({ enabled: false });
  b.add(2);
  await b.idle();
  b.saved.enabled = true;
  b.api.runtime.onInstalled.emit();
  b.api.runtime.onStartup.emit();
  await b.idle();
  assert.equal(b.badge.text, 'ON');
  assert.equal(b.moves.length, 0);
});

void test('moves a background tab by identity without requesting focus or reopening its URL', async () => {
  const b = await browser();
  const tab = b.add(2);
  const original = tab;
  await b.idle();
  assert.deepEqual(b.moves, [
    { tabId: 2, type: 'normal', incognito: false, focused: false },
  ]);
  assert.equal(b.tab(2), original);
  assert.equal(b.tab(1).windowId, 10);
});

void test('an active new tab in a focused normal window requests foreground focus', async () => {
  const b = await browser();
  b.add(2, { active: true });
  await b.idle();
  assert.equal(b.move().focused, true);
});

void test('an unfocused source or a tab that lost activation does not request focus', async () => {
  for (const focused of [false, true]) {
    const b = await browser({ focused });
    const tab = b.add(2, { active: true });
    if (focused) tab.active = false;
    await b.idle();
    assert.equal(b.move().focused, false);
  }
});

void test('leaves the only tab in a newly created window alone', async () => {
  const b = await browser();
  b.windows.set(11, {
    id: 11,
    type: 'normal',
    incognito: false,
    focused: true,
  });
  b.add(2, { windowId: 11, active: true });
  await b.idle();
  assert.equal(b.moves.length, 0);
});

void test('excludes popup, app, and devtools windows', async () => {
  for (const type of ['popup', 'app', 'devtools'] as const) {
    const b = await browser({ type });
    b.add(2);
    await b.idle();
    assert.equal(b.moves.length, 0);
  }
});

void test('serializes a burst of new tabs without emptying the source', async () => {
  const b = await browser();
  for (let id = 2; id <= 12; id++) b.add(id);
  await b.idle();
  assert.equal(b.moves.length, 11);
  assert.equal(
    new Set([...b.tabs.values()].map((tab) => tab.windowId)).size,
    12,
  );
  assert.equal(b.tab(1).windowId, 10);
});

void test('preserves private status for detached incognito tabs', async () => {
  const b = await browser({ incognito: true });
  b.add(2);
  await b.idle();
  assert.equal(b.move().incognito, true);
});

void test('pause/resume persists and does not sweep existing tabs', async () => {
  const b = await browser();
  assert.equal(b.badge.text, 'ON');
  b.api.action.onClicked.emit();
  await b.idle();
  assert.equal(b.saved.enabled, false);
  assert.equal(b.badge.text, 'OFF');
  b.add(2);
  await b.idle();
  assert.equal(b.moves.length, 0);
  b.api.action.onClicked.emit();
  await b.idle();
  assert.equal(b.saved.enabled, true);
  assert.equal(b.badge.text, 'ON');
  assert.equal(b.moves.length, 0);
  b.add(3);
  await b.idle();
  assert.equal(b.move().tabId, 3);
  const restarted = await browser({ enabled: false });
  restarted.api.runtime.onStartup.emit();
  restarted.add(2);
  await restarted.idle();
  assert.equal(restarted.badge.text, 'OFF');
  assert.equal(restarted.moves.length, 0);
});

void test('ignores tabs closed or manually moved while queued', async () => {
  const b = await browser();
  b.add(2);
  b.tabs.delete(2);
  b.add(3).windowId = 99;
  await b.idle();
  assert.equal(b.moves.length, 0);
  assert.equal(b.errors.length, 0);
});

void test('API move failure preserves tabs, reports it, and allows later events', async () => {
  const b = await browser();
  b.fail(
    new Error('Tabs cannot be edited right now (user may be dragging a tab).'),
  );
  b.add(2);
  await b.idle();
  assert.equal(b.tab(2).windowId, 10);
  assert.equal(b.badge.text, '!');
  assert.equal(b.errors.length, 1);
  b.add(3);
  await b.idle();
  assert.equal(b.move().tabId, 3);
  assert.equal(b.tab(2).windowId, 10);
});

void test('unexpected query failures are reported rather than silently skipped', async () => {
  const b = await browser();
  b.api.tabs.query = (): Promise<never> =>
    Promise.reject(new Error('Unexpected browser failure'));
  b.add(2);
  await b.idle();
  assert.equal(b.errors.length, 1);
  assert.equal(b.moves.length, 0);
});

void test('a shared preference change refreshes the badge and pauses new moves', async () => {
  const b = await browser();
  b.saved.enabled = false;
  b.api.storage.onChanged.emit(
    { enabled: { oldValue: true, newValue: false } },
    'local',
  );
  b.add(2);
  await b.idle();
  assert.equal(b.badge.text, 'OFF');
  assert.equal(b.moves.length, 0);
});

void test('does not request focus if the source loses focus during browser queries', async () => {
  const b = await browser();
  const originalQuery = b.api.tabs.query;
  b.api.tabs.query = async (query): Promise<Tab[]> => {
    b.window(10).focused = false;
    return originalQuery(query);
  };
  b.add(2, { active: true });
  await b.idle();
  assert.equal(b.move().focused, false);
});
