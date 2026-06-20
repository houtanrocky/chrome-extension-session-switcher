/**
 * A small in-memory fake of the slice of the `chrome.*` extension API that the
 * background engine touches, so the SessionManager can be exercised under Node
 * (Vitest) without a real browser. It records side effects (DNR session rules,
 * tab reloads, injected scripts) and lets a test simulate a `Set-Cookie`
 * response, which is how the per-session cookie loop is verified end to end.
 */
export interface FakeTab {
  id: number;
  url: string;
  active: boolean;
}

type HeadersListener = (details: {
  tabId: number;
  url: string;
  responseHeaders: { name: string; value: string }[];
}) => void;

export function makeChrome() {
  const local = new Map<string, unknown>();
  const session = new Map<string, unknown>();
  const sessionRules = new Map<number, chrome.declarativeNetRequest.Rule>();
  const tabs = new Map<number, FakeTab>();
  const reloads: number[] = [];
  const scriptExecs: unknown[] = [];
  let cookieStore: chrome.cookies.Cookie[] = [];
  let headersListener: HeadersListener | null = null;
  let nextTabId = 100;

  const readKeys = (map: Map<string, unknown>, keys: unknown): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (keys == null) {
      for (const [k, v] of map) out[k] = v;
    } else if (typeof keys === 'string') {
      if (map.has(keys)) out[keys] = map.get(keys);
    } else if (Array.isArray(keys)) {
      for (const k of keys) if (map.has(k)) out[k] = map.get(k);
    }
    return out;
  };
  const writeKeys = (map: Map<string, unknown>, obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
  };

  const chrome = {
    storage: {
      local: {
        get: async (keys: unknown) => readKeys(local, keys),
        set: async (obj: Record<string, unknown>) => writeKeys(local, obj),
        remove: async (keys: string | string[]) => {
          for (const k of ([] as string[]).concat(keys)) local.delete(k);
        },
      },
      session: {
        get: async (keys: unknown) => readKeys(session, keys),
        set: async (obj: Record<string, unknown>) => writeKeys(session, obj),
      },
    },
    declarativeNetRequest: {
      ResourceType: {
        MAIN_FRAME: 'main_frame', SUB_FRAME: 'sub_frame', XMLHTTPREQUEST: 'xmlhttprequest',
        SCRIPT: 'script', IMAGE: 'image', STYLESHEET: 'stylesheet', FONT: 'font',
        MEDIA: 'media', PING: 'ping', OTHER: 'other',
      },
      HeaderOperation: { SET: 'set', REMOVE: 'remove', APPEND: 'append' },
      RuleActionType: { MODIFY_HEADERS: 'modifyHeaders', BLOCK: 'block' },
      updateSessionRules: async (opts: {
        removeRuleIds?: number[];
        addRules?: chrome.declarativeNetRequest.Rule[];
      }) => {
        for (const id of opts.removeRuleIds ?? []) sessionRules.delete(id);
        for (const r of opts.addRules ?? []) sessionRules.set(r.id, r);
      },
      getSessionRules: async () => [...sessionRules.values()],
    },
    tabs: {
      create: async ({ url, active }: { url: string; active?: boolean }) => {
        const id = nextTabId++;
        const tab: FakeTab = { id, url, active: active ?? false };
        if (active) for (const t of tabs.values()) t.active = false;
        tabs.set(id, tab);
        return { ...tab };
      },
      update: async (tabId: number, { url }: { url?: string }) => {
        const t = tabs.get(tabId);
        if (t && url !== undefined) t.url = url;
        return t ? { ...t } : undefined;
      },
      get: async (tabId: number) => {
        const t = tabs.get(tabId);
        if (!t) throw new Error(`No tab ${tabId}`);
        return { ...t };
      },
      query: async () => {
        const active = [...tabs.values()].find((t) => t.active);
        return active ? [{ ...active }] : [];
      },
      reload: async (tabId: number) => {
        reloads.push(tabId);
      },
      onRemoved: { addListener: (_fn: (tabId: number) => void) => {} },
    },
    cookies: {
      getAll: async ({ domain }: { domain: string }) =>
        cookieStore.filter((c) => c.domain.replace(/^\./, '') === domain),
    },
    scripting: {
      executeScript: async (arg: unknown) => {
        scriptExecs.push(arg);
        return [];
      },
    },
    webRequest: {
      onHeadersReceived: {
        addListener: (fn: HeadersListener) => {
          headersListener = fn;
        },
      },
    },
  };

  return {
    chrome: chrome as unknown as typeof globalThis.chrome,
    state: { local, session, sessionRules, tabs, reloads, scriptExecs },
    /** Seed the browser's "real" cookies for importCurrentLogin tests. */
    setCookies: (cs: Partial<chrome.cookies.Cookie>[]) => {
      cookieStore = cs as chrome.cookies.Cookie[];
    },
    /** Register a pre-existing tab (e.g. one the user is about to bind). */
    addTab: (url: string, active = false): number => {
      const id = nextTabId++;
      if (active) for (const t of tabs.values()) t.active = false;
      tabs.set(id, { id, url, active });
      return id;
    },
    /** Fire the webRequest capture listener as if a response set cookies. */
    simulateResponse: (tabId: number, url: string, setCookie: string[]) =>
      headersListener?.({
        tabId,
        url,
        responseHeaders: setCookie.map((value) => ({ name: 'set-cookie', value })),
      }),
    /** The DNR session rule currently installed for a tab, if any. */
    ruleFor: (tabId: number) => sessionRules.get(tabId),
  };
}

export type FakeChrome = ReturnType<typeof makeChrome>;
