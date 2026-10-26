import type { BrowserApi, Tab } from './browser-api.ts';

export interface Controller {
  whenIdle: () => Promise<void>;
}

function disappeared(error: unknown): boolean {
  return /No tab with id|No window with id|Invalid tab ID|Invalid window ID/i.test(
    String(error),
  );
}

export function registerWindowTabs(
  api: BrowserApi,
  logError: (message: string, error: unknown) => void = console.error,
): Controller {
  let queue = Promise.resolve();

  const enabled = async (): Promise<boolean> =>
    (await api.storage.local.get({ enabled: true })).enabled !== false;

  async function showState(): Promise<void> {
    const on = await enabled();
    await api.action.setBadgeText({ text: on ? 'ON' : 'OFF' });
    await api.action.setBadgeBackgroundColor({
      color: on ? '#276749' : '#555555',
    });
    await api.action.setTitle({
      title: `Single Tab Window: ${on ? 'on — click to pause' : 'paused — click to resume'}`,
    });
  }

  async function report(error: unknown): Promise<void> {
    logError('Single Tab Window:', error);
    // Never close or recreate a tab to recover from a failed move.
    try {
      await api.action.setBadgeText({ text: '!' });
      await api.action.setBadgeBackgroundColor({ color: '#a52828' });
      await api.action.setTitle({
        title:
          'Single Tab Window: action failed; see extension service-worker console. Click to pause or resume.',
      });
    } catch (badgeError) {
      logError('Single Tab Window badge:', badgeError);
    }
  }

  function enqueue(task: () => Promise<void>): void {
    // Serializing prevents our own burst handlers from emptying a source window.
    // Catch each failure so subsequent events still run.
    queue = queue.then(task).catch(report);
  }

  async function detach(created: Tab): Promise<void> {
    const id = created.id;
    if (
      typeof id !== 'number' ||
      !Number.isInteger(id) ||
      !Number.isInteger(created.windowId) ||
      !(await enabled())
    )
      return;

    let tab;
    let source;
    let siblings;
    try {
      tab = await api.tabs.get(id);
      // The user may have moved/closed this tab while its event was queued.
      if (tab.windowId !== created.windowId) return;
      source = await api.windows.get(tab.windowId);
      if (source.type !== 'normal') return;
      siblings = await api.tabs.query({ windowId: tab.windowId });
    } catch (error) {
      if (disappeared(error)) return;
      throw error;
    }
    if (siblings.length < 2 || !siblings.some((other) => other.id === id))
      return;

    try {
      tab = await api.tabs.get(id);
      source = await api.windows.get(created.windowId);
    } catch (error) {
      if (disappeared(error)) return;
      throw error;
    }
    if (tab.windowId !== created.windowId || !(await enabled())) return;

    await api.windows.create({
      tabId: id,
      type: 'normal',
      incognito: source.incognito,
      // Retain creation-time intent even if a background tab becomes active.
      focused: created.active && tab.active && source.focused,
    });
  }

  // Register synchronously on every MV3 worker evaluation, before any awaits.
  api.tabs.onCreated.addListener((tab) => {
    enqueue(() => detach(tab));
  });
  api.action.onClicked.addListener(() => {
    enqueue(async () => {
      await api.storage.local.set({ enabled: !(await enabled()) });
      await showState();
    });
  });
  api.runtime.onInstalled.addListener(() => {
    enqueue(showState);
  });
  api.runtime.onStartup.addListener(() => {
    enqueue(showState);
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) enqueue(showState);
  });
  // Refresh the badge on wake without sweeping existing tabs.
  enqueue(showState);

  return { whenIdle: () => queue };
}
