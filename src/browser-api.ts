// Keep the controller's capabilities small and the test double honest. Chrome's
// full API must satisfy this interface in background.ts without a type cast.
export type Tab = Pick<chrome.tabs.Tab, 'id' | 'windowId' | 'active'>;
export type BrowserWindow = Pick<
  chrome.windows.Window,
  'id' | 'type' | 'focused' | 'incognito'
>;
export interface MoveOptions {
  tabId: number;
  type: 'normal';
  incognito: boolean;
  focused: boolean;
}

export interface BrowserEvent<Args extends unknown[]> {
  addListener(listener: (...args: Args) => void): void;
}

export interface BrowserApi {
  tabs: {
    onCreated: BrowserEvent<[Tab]>;
    get(id: number): Promise<Tab>;
    query: (query: { windowId: number }) => Promise<Tab[]>;
  };
  windows: {
    get(id: number): Promise<BrowserWindow>;
    create(options: MoveOptions): Promise<BrowserWindow | undefined>;
  };
  storage: {
    local: {
      get(defaults: { enabled: boolean }): Promise<{ enabled?: unknown }>;
      set(values: { enabled: boolean }): Promise<void>;
    };
    onChanged: BrowserEvent<
      [Record<string, chrome.storage.StorageChange>, string]
    >;
  };
  action: {
    onClicked: BrowserEvent<[]>;
    setBadgeText(details: { text: string }): Promise<void>;
    setBadgeBackgroundColor(details: { color: string }): Promise<void>;
    setTitle(details: { title: string }): Promise<void>;
  };
  runtime: {
    onInstalled: BrowserEvent<[]>;
    onStartup: BrowserEvent<[]>;
  };
}
