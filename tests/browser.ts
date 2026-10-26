import assert from 'node:assert/strict';
import type {
  BrowserApi,
  BrowserEvent,
  BrowserWindow,
  MoveOptions,
  Tab,
} from '../src/browser-api.ts';
import { registerWindowTabs } from '../src/controller.ts';

interface TestEvent<Args extends unknown[]> extends BrowserEvent<Args> {
  emit(...args: Args): void;
}

function event<Args extends unknown[]>(): TestEvent<Args> {
  const listeners: ((...args: Args) => void)[] = [];
  return {
    addListener: (listener): void => {
      listeners.push(listener);
    },
    emit: (...args): void => {
      for (const listener of listeners) listener(...args);
    },
  };
}

interface Options {
  enabled?: boolean;
  type?: BrowserWindow['type'];
  focused?: boolean;
  incognito?: boolean;
}

interface Harness {
  api: BrowserApi & {
    tabs: { onCreated: TestEvent<[Tab]> };
    action: { onClicked: TestEvent<[]> };
    runtime: { onStartup: TestEvent<[]>; onInstalled: TestEvent<[]> };
    storage: {
      onChanged: TestEvent<
        [Record<string, chrome.storage.StorageChange>, string]
      >;
    };
  };
  tabs: Map<number, Tab>;
  windows: Map<number, BrowserWindow>;
  moves: MoveOptions[];
  errors: unknown[];
  badge: { text: string; color: string; title: string };
  saved: { enabled: boolean };
  add(id: number, changes?: Partial<Tab>): Tab;
  tab(id: number): Tab;
  window(id: number): BrowserWindow;
  move(index?: number): MoveOptions;
  idle(): Promise<void>;
  fail(error: Error): void;
}

export async function browser({
  enabled = true,
  type = 'normal',
  focused = true,
  incognito = false,
}: Options = {}): Promise<Harness> {
  const tabs = new Map<number, Tab>([
    [1, { id: 1, windowId: 10, active: true }],
  ]);
  const windows = new Map<number, BrowserWindow>([
    [10, { id: 10, type, focused, incognito }],
  ]);
  const saved = { enabled };
  const moves: MoveOptions[] = [];
  const errors: unknown[] = [];
  const badge = { text: '', color: '', title: '' };
  let failure: Error | undefined;

  function tab(id: number): Tab {
    const value = tabs.get(id);
    assert.ok(value, `No tab with id: ${String(id)}`);
    return value;
  }
  function window(id: number): BrowserWindow {
    const value = windows.get(id);
    assert.ok(value, `No window with id: ${String(id)}`);
    return value;
  }

  const api: Harness['api'] = {
    storage: {
      onChanged: event(),
      local: {
        get: (defaults) => Promise.resolve({ ...defaults, ...saved }),
        set: (values) => {
          Object.assign(saved, values);
          return Promise.resolve();
        },
      },
    },
    tabs: {
      onCreated: event(),
      get: (id) => Promise.resolve({ ...tab(id) }),
      query: ({ windowId }) =>
        Promise.resolve(
          [...tabs.values()]
            .filter((item) => item.windowId === windowId)
            .map((item) => ({ ...item })),
        ),
    },
    windows: {
      get: (id) => Promise.resolve({ ...window(id) }),
      create: (options) => {
        if (failure) {
          const error = failure;
          failure = undefined;
          throw error;
        }
        const existing = tab(options.tabId);
        assert.ok(
          [...tabs.values()].some(
            (other) =>
              other.id !== existing.id && other.windowId === existing.windowId,
          ),
          'leaves a source tab',
        );
        moves.push(options);
        const id = 20 + moves.length;
        windows.set(id, {
          id,
          type: 'normal',
          focused: options.focused,
          incognito: options.incognito,
        });
        existing.windowId = id;
        existing.active = true;
        return Promise.resolve({ ...window(id) });
      },
    },
    action: {
      onClicked: event(),
      setBadgeText: ({ text }) => {
        badge.text = text;
        return Promise.resolve();
      },
      setBadgeBackgroundColor: ({ color }) => {
        badge.color = color;
        return Promise.resolve();
      },
      setTitle: ({ title }) => {
        badge.title = title;
        return Promise.resolve();
      },
    },
    runtime: { onInstalled: event(), onStartup: event() },
  };
  const controller = registerWindowTabs(api, (...args) => {
    errors.push(args);
  });
  await controller.whenIdle();

  function add(id: number, changes: Partial<Tab> = {}): Tab {
    const value = { id, windowId: 10, active: false, ...changes };
    if (value.active) {
      for (const other of tabs.values()) {
        if (other.windowId === value.windowId) other.active = false;
      }
    }
    tabs.set(id, value);
    api.tabs.onCreated.emit({ ...value });
    return value;
  }

  return {
    api,
    tabs,
    windows,
    moves,
    badge,
    saved,
    errors,
    add,
    tab,
    window,
    idle: controller.whenIdle,
    move: (index = 0): MoveOptions => {
      const value = moves[index];
      assert.ok(value);
      return value;
    },
    fail: (error): void => {
      failure = error;
    },
  };
}
