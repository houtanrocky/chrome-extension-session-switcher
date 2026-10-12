import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { makeChrome, type FakeChrome } from '../../test/chromeMock';
import { SessionManager } from './manager';

let fake: FakeChrome;

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  fake = makeChrome();
  (globalThis as unknown as { chrome: typeof globalThis.chrome }).chrome = fake.chrome;
});

async function freshManager() {
  const m = new SessionManager();
  await m.init();
  return m;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('rule recovery', () => {
  it('retries a transient failure without losing the binding or existing rule', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'QA');
    const tabId = await m.openInSession(s.id);
    const update = vi.spyOn(chrome.declarativeNetRequest, 'updateSessionRules')
      .mockRejectedValueOnce(new Error('Temporary DNR failure'));
    fake.simulateResponse(tabId, 'https://example.com/', ['sid=QA']);
    await delay(400);
    expect(update).toHaveBeenCalledTimes(2);
    expect((await m.getContext(tabId)).boundSessionId).toBe(s.id);
    expect(cookieHeaderFor(tabId)).toBe('sid=QA');
  });

  it('preserves a live binding after repeated failure and blocks initial navigation', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'QA');
    const update = vi.spyOn(chrome.declarativeNetRequest, 'updateSessionRules')
      .mockRejectedValue(new Error('DNR unavailable'));
    await expect(m.openInSession(s.id)).rejects.toThrow('DNR unavailable');
    const tab = [...fake.state.tabs.values()][0]!;
    expect(tab.url).toBe('about:blank');
    expect((await m.getContext(tab.id)).boundSessionId).toBe(s.id);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('removes a stale binding only when the tab is confirmed absent', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'QA');
    const tabId = await m.openInSession(s.id);
    fake.state.tabs.delete(tabId);
    vi.spyOn(chrome.declarativeNetRequest, 'updateSessionRules')
      .mockRejectedValue(new Error('Invalid tab'));
    fake.simulateResponse(tabId, 'https://example.com/', ['sid=QA']);
    await delay(150);
    expect(fake.state.session.get('bindings')).toEqual({});
  });

  it('rehydrates bindings and cookie rules after background worker restart', async () => {
    const first = await freshManager();
    const s = await first.createSession('example.com', 'QA');
    const tabId = await first.openInSession(s.id);
    fake.simulateResponse(tabId, 'https://example.com/', ['sid=QA']);
    await delay(150);
    const restarted = await freshManager();
    expect((await restarted.getContext(tabId)).boundSessionId).toBe(s.id);
    expect(cookieHeaderFor(tabId)).toBe('sid=QA');
  });
});
/** The DNR-injected Cookie header for a tab ('' when the rule removes it). */
function cookieHeaderFor(tabId: number): string {
  for (const rule of fake.state.sessionRules.values()) {
    if (!rule.condition.tabIds?.includes(tabId)) continue;
    const action = rule.action.requestHeaders?.[0];
    if (action?.operation === 'set') return action.value ?? '';
  }
  return '';
}

describe('session CRUD', () => {
  it('creates sessions with sequential default names and palette colors', async () => {
    const m = await freshManager();
    const a = await m.createSession('example.com', '');
    const b = await m.createSession('example.com', 'Work');
    expect(a.name).toBe('Session 1');
    expect(b.name).toBe('Work');
    expect(a.color).not.toBe(b.color); // distinct palette slots
    expect(a.domain).toBe('example.com');

    const { sessions } = await m.listAllSessions();
    expect(sessions.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('rename / recolor persist', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    await m.renameSession(s.id, 'Renamed');
    await m.recolorSession(s.id, '#123456');
    const ctx = await m.getContext(fake.addTab('https://example.com/', true));
    const found = ctx.sessions.find((x) => x.id === s.id)!;
    expect(found.name).toBe('Renamed');
    expect(found.color).toBe('#123456');
  });
});

describe('openInSession', () => {
  it('opens a tab, binds it, stamps the namespace marker, and installs a DNR rule', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = await m.openInSession(s.id);

    // URL carries the per-session namespace marker for the storage shim.
    const tab = fake.state.tabs.get(tabId)!;
    expect(tab.url).toContain('__ssns=' + s.id);

    // A session-scoped DNR rule exists for this tab, on the right domain.
    const rule = fake.ruleFor(tabId)!;
    expect(rule.condition.tabIds).toEqual([tabId]);
    expect(rule.condition.requestDomains).toEqual(['example.com']);
    // Empty jar => the Cookie header is *removed* (logged-out state).
    expect(rule.action.requestHeaders?.[0]).toMatchObject({ header: 'cookie', operation: 'remove' });
    expect(rule.action.responseHeaders?.[0]).toMatchObject({ header: 'set-cookie', operation: 'remove' });
  });
});

describe('bindTab ("Use here") reload behaviour', () => {
  it('forces a reload when only the URL hash changes (same-document nav)', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = fake.addTab('https://example.com/chat', true);

    await m.bindTab(tabId, s.id);

    // Marker appended to the *same* document => must reload so the shim runs.
    expect(fake.state.tabs.get(tabId)!.url).toBe(`https://example.com/chat#__ssns=${s.id}`);
    expect(fake.state.reloads).toContain(tabId);
  });

  it('does not force a reload when navigating cross-document', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = fake.addTab('https://other.example/page', true);

    await m.bindTab(tabId, s.id);

    // Different origin => tabs.update already triggers a full load; no extra reload.
    expect(fake.state.tabs.get(tabId)!.url).toBe(`https://example.com/#__ssns=${s.id}`);
    expect(fake.state.reloads).not.toContain(tabId);
  });
});

describe('Set-Cookie capture → per-tab isolation', () => {
  it('folds Set-Cookie into the bound session and injects it back via DNR', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = await m.openInSession(s.id);

    fake.simulateResponse(tabId, 'https://example.com/api/auth', ['sid=ACCOUNT_A; Path=/']);
    await delay(120); // let the debounced refresh fire

    expect(cookieHeaderFor(tabId)).toBe('sid=ACCOUNT_A');
    const { jarSizes } = await m.listAllSessions();
    expect(jarSizes[s.id]).toBe(1);
  });

  it('keeps a cross-subdomain SSO login in the session header', async () => {
    const m = await freshManager();
    const s = await m.createSession('digikala.com', 'QA');
    const tabId = await m.openInSession(s.id, 'https://auth.digikala.com/login');

    fake.simulateResponse(tabId, 'https://auth.digikala.com/realms/login', [
      'KEYCLOAK_SESSION=abc; Path=/; Secure; HttpOnly',
    ]);
    await delay(120);

    expect(cookieHeaderFor(tabId)).toContain('KEYCLOAK_SESSION=abc');
  });

  it('keeps two concurrent sessions on the same site fully separate', async () => {
    const m = await freshManager();
    const a = await m.createSession('example.com', 'A');
    const b = await m.createSession('example.com', 'B');
    const tabA = await m.openInSession(a.id);
    const tabB = await m.openInSession(b.id);

    fake.simulateResponse(tabA, 'https://example.com/api', ['sid=AAA']);
    fake.simulateResponse(tabB, 'https://example.com/api', ['sid=BBB']);
    await delay(120);

    // Each tab's rule injects only its own session's cookie — no cross-talk.
    expect(cookieHeaderFor(tabA)).toBe('sid=AAA');
    expect(cookieHeaderFor(tabB)).toBe('sid=BBB');
  });

  it('ignores Set-Cookie for a tab that is not managed', async () => {
    const m = await freshManager();
    await m.createSession('example.com', 'A');
    const orphanTab = fake.addTab('https://example.com/', true);

    fake.simulateResponse(orphanTab, 'https://example.com/api', ['sid=NOPE']);
    await delay(120);

    expect(fake.ruleFor(orphanTab)).toBeUndefined();
    const { jarSizes, sessions } = await m.listAllSessions();
    expect(jarSizes[sessions[0]!.id]).toBe(0);
  });
});

describe('importCurrentLogin', () => {
  it('copies the browser\'s real cookies for the domain into the session jar', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = await m.openInSession(s.id);
    fake.setCookies([
      { name: 'sid', value: 'real', domain: '.example.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: false, expirationDate: 4_000_000_000 },
      { name: 'csrf', value: 'tok', domain: 'example.com', path: '/', secure: true, httpOnly: false, sameSite: 'strict', hostOnly: true },
      { name: 'other', value: 'x', domain: 'other.example', path: '/', secure: false, httpOnly: false, sameSite: 'lax', hostOnly: true },
    ]);

    const imported = await m.importCurrentLogin(s.id, tabId);
    expect(imported).toBe(2); // only example.com cookies
    await delay(120);

    const header = cookieHeaderFor(tabId);
    expect(header).toContain('sid=real');
    expect(header).toContain('csrf=tok');
  });

  it('never overwrites a session\'s own login (the cross-session footgun)', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'hc');
    const tabId = await m.openInSession(s.id);
    // hc logs into its own account — captured into its jar.
    fake.simulateResponse(tabId, 'https://example.com/api/auth', ['sid=HC_ACCOUNT; Path=/']);
    await delay(120);
    expect(cookieHeaderFor(tabId)).toBe('sid=HC_ACCOUNT');

    // The shared browser profile still holds a DIFFERENT login ("hr") plus an
    // unrelated cookie hc doesn't have — the exact state behind the bug report.
    fake.setCookies([
      { name: 'sid', value: 'HR_ACCOUNT', domain: 'example.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true },
      { name: 'pref', value: 'dark', domain: 'example.com', path: '/', secure: false, httpOnly: false, sameSite: 'lax', hostOnly: true },
    ]);

    const added = await m.importCurrentLogin(s.id, tabId);
    await delay(120);

    // hc keeps its OWN auth — import must not merge hr's identity in.
    const header = cookieHeaderFor(tabId);
    expect(header).toContain('sid=HC_ACCOUNT');
    expect(header).not.toContain('HR_ACCOUNT');
    expect(added).toBe(1); // only the genuinely-new 'pref' cookie was filled
  });
});

describe('export / import round-trip', () => {
  it('exports sessions + jars and re-imports them on a clean store', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = await m.openInSession(s.id);
    fake.simulateResponse(tabId, 'https://example.com/api', ['sid=KEEP']);
    await delay(120);

    const backup = await m.exportData();
    expect(backup.format).toBe('session-switcher');
    expect(backup.sessions).toHaveLength(1);

    // Fresh browser + manager; import the backup (replace mode).
    fake = makeChrome();
    (globalThis as unknown as { chrome: typeof globalThis.chrome }).chrome = fake.chrome;
    const m2 = await freshManager();
    const count = await m2.importData(backup, false);
    expect(count).toBe(1);

    const { sessions, jarSizes } = await m2.listAllSessions();
    expect(sessions[0]!.name).toBe('A');
    expect(jarSizes[sessions[0]!.id]).toBe(1);
  });
});

describe('deleteSession', () => {
  it('removes the session, its jar, and tears down any bound tab rule', async () => {
    const m = await freshManager();
    const s = await m.createSession('example.com', 'A');
    const tabId = await m.openInSession(s.id);
    expect(fake.ruleFor(tabId)).toBeDefined();

    await m.deleteSession(s.id);

    expect(fake.ruleFor(tabId)).toBeUndefined(); // rule cleared on detach
    const { sessions } = await m.listAllSessions();
    expect(sessions).toHaveLength(0);
  });
});
