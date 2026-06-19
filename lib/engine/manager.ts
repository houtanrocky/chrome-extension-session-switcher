/**
 * SessionManager — the single orchestrator the background service worker owns.
 * It holds the live in-memory caches (bindings + jars), wires the Set-Cookie
 * capture listener, and exposes every high-level operation the UI calls.
 *
 * Design note (hybrid path): all cookie state flows through here, so swapping
 * the snapshot/header backend for a future true-proxy backend means changing
 * this class and `dnr.ts` only — the UI and message protocol stay put.
 */
import type { BackupFile, CookieJar, Session, TabBinding, TabContext } from '../types';
import { domainFromUrl, hostFromUrl, registrableDomain, siteName } from '../domains';
import { withNamespaceMarker, NS_SESSION_KEY } from '../shimProtocol';
import {
  applyToJar,
  fromChromeCookie,
  liveCount,
  parseSetCookie,
  pruneExpired,
  putRecord,
  toCookieHeader,
} from './cookieJar';
import { applyTabRule, clearAllRules, clearTabRule } from './dnr';
import { installCaptureListener } from './capture';
import * as store from './store';

const PALETTE = ['#6c8cff', '#ff8f6c', '#4fcf8f', '#ffcf5c', '#c98cff', '#5cd0ff', '#ff6c9d', '#9aa1b2'];

export class SessionManager {
  private bindings = new Map<number, TabBinding>();
  private jars = new Map<string, CookieJar>();
  private refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private hydrated = false;

  /** Wire listeners + warm caches. Safe to call on every SW startup. */
  async init(): Promise<void> {
    installCaptureListener((tabId, url, values) => this.handleSetCookie(tabId, url, values));

    chrome.tabs.onRemoved.addListener((tabId) => {
      void this.unbindTab(tabId, { reload: false });
    });

    await this.hydrate();
    // Re-assert DNR rules in case the browser session was reset under us.
    for (const b of this.bindings.values()) await this.refreshTab(b);
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const persisted = await store.getBindings();
    this.bindings = new Map(Object.values(persisted).map((b) => [b.tabId, b]));
    this.hydrated = true;
  }

  private async getJar(sessionId: string): Promise<CookieJar> {
    let jar = this.jars.get(sessionId);
    if (!jar) {
      jar = await store.getJar(sessionId);
      this.jars.set(sessionId, jar);
    }
    return jar;
  }

  // ---- session CRUD -------------------------------------------------------

  async createSession(domain: string, name: string, color?: string): Promise<Session> {
    const existing = await store.getSessionsForDomain(domain);
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      domain,
      name: name.trim() || `Session ${existing.length + 1}`,
      color: color ?? PALETTE[existing.length % PALETTE.length]!,
      createdAt: now,
      updatedAt: now,
    };
    await store.saveSession(session);
    return session;
  }

  async renameSession(sessionId: string, name: string): Promise<Session> {
    const session = await this.requireSession(sessionId);
    session.name = name.trim() || session.name;
    session.updatedAt = Date.now();
    await store.saveSession(session);
    return session;
  }

  async recolorSession(sessionId: string, color: string): Promise<Session> {
    const session = await this.requireSession(sessionId);
    session.color = color;
    session.updatedAt = Date.now();
    await store.saveSession(session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Detach any tabs still using it, then drop the record + jar.
    for (const b of [...this.bindings.values()]) {
      if (b.sessionId === sessionId) await this.unbindTab(b.tabId, { reload: true });
    }
    this.jars.delete(sessionId);
    await store.deleteSessionRecord(sessionId);
  }

  // ---- binding lifecycle --------------------------------------------------

  async openInSession(sessionId: string, url?: string): Promise<number> {
    const session = await this.requireSession(sessionId);
    const startUrl = url ?? `https://${session.domain}/`;

    // Open a blank tab first so the DNR rule is in place before the real
    // navigation fires — otherwise the first request races the rule.
    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    if (tab.id === undefined) throw new Error('Failed to create tab');

    await this.bind(tab.id, session);
    await chrome.tabs.update(tab.id, { url: withNamespaceMarker(startUrl, sessionId) });
    return tab.id;
  }

  async bindTab(tabId: number, sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    const tab = await chrome.tabs.get(tabId);
    const current = tab.url ?? '';
    const target =
      domainFromUrl(current) === session.domain ? current : `https://${session.domain}/`;

    await this.bind(tabId, session);
    await chrome.tabs.update(tabId, { url: withNamespaceMarker(target, sessionId) });
  }

  private async bind(tabId: number, session: Session): Promise<void> {
    const binding: TabBinding = { tabId, sessionId: session.id, domain: session.domain };
    this.bindings.set(tabId, binding);
    await store.setBinding(binding);
    await this.refreshTab(binding);
  }

  async unbindTab(tabId: number, opts: { reload: boolean } = { reload: true }): Promise<void> {
    const binding = this.bindings.get(tabId);
    this.bindings.delete(tabId);
    await store.removeBinding(tabId);
    await clearTabRule(tabId);
    if (!binding || !opts.reload) return;

    // Clear the per-tab namespace marker so the storage shim deactivates,
    // then reload back into the browser's shared profile.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (key: string) => {
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* opaque/blocked origin */
          }
        },
        args: [NS_SESSION_KEY],
      });
      await chrome.tabs.reload(tabId);
    } catch {
      /* tab may already be gone */
    }
  }

  // ---- importing an existing real login -----------------------------------

  async importCurrentLogin(sessionId: string, tabId: number): Promise<number> {
    const session = await this.requireSession(sessionId);
    const jar = await this.getJar(sessionId);
    const cookies = await chrome.cookies.getAll({ domain: session.domain });
    for (const c of cookies) putRecord(jar, fromChromeCookie(c));

    await store.saveJar(sessionId, jar);
    const binding = this.bindings.get(tabId);
    if (binding?.sessionId === sessionId) await this.refreshTab(binding);
    return cookies.length;
  }

  // ---- Set-Cookie capture -------------------------------------------------

  private async handleSetCookie(tabId: number, url: string, values: string[]): Promise<void> {
    await this.hydrate();
    const binding = this.bindings.get(tabId);
    if (!binding) return;

    const reqDomain = domainFromUrl(url);
    if (reqDomain !== binding.domain) return;

    const jar = await this.getJar(binding.sessionId);
    let changed = false;
    for (const raw of values) {
      const parsed = parseSetCookie(raw, url);
      if (parsed && applyToJar(jar, parsed)) changed = true;
    }
    if (!changed) return;

    await store.saveJar(binding.sessionId, jar);
    this.scheduleRefresh(binding.sessionId);
  }

  /** Coalesce bursty Set-Cookie updates into one DNR refresh per session. */
  private scheduleRefresh(sessionId: string): void {
    clearTimeout(this.refreshTimers.get(sessionId));
    this.refreshTimers.set(
      sessionId,
      setTimeout(() => {
        this.refreshTimers.delete(sessionId);
        for (const b of this.bindings.values()) {
          if (b.sessionId === sessionId) void this.refreshTab(b);
        }
      }, 60),
    );
  }

  private async refreshTab(binding: TabBinding): Promise<void> {
    const jar = await this.getJar(binding.sessionId);
    if (pruneExpired(jar)) await store.saveJar(binding.sessionId, jar);
    const header = toCookieHeader(jar, binding.domain);
    try {
      await applyTabRule(binding.tabId, binding.domain, header);
    } catch {
      // Tab closed between lookup and apply — drop the stale binding.
      this.bindings.delete(binding.tabId);
      await store.removeBinding(binding.tabId);
    }
  }

  // ---- read models for the UI ---------------------------------------------

  async getContext(explicitTabId?: number): Promise<TabContext> {
    await this.hydrate();
    const tab = explicitTabId
      ? await chrome.tabs.get(explicitTabId)
      : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

    const tabId = tab?.id ?? -1;
    const url = tab?.url ?? null;
    const host = hostFromUrl(url);
    const domain = domainFromUrl(url);
    const sessions = domain ? await store.getSessionsForDomain(domain) : [];
    const jars = await store.getAllJars(sessions.map((s) => s.id));
    const jarSizes: Record<string, number> = {};
    for (const s of sessions) jarSizes[s.id] = liveCount(jars[s.id]);

    return {
      tabId,
      url,
      host,
      domain,
      siteName: domain ? siteName(domain) : null,
      boundSessionId: this.bindings.get(tabId)?.sessionId ?? null,
      sessions,
      jarSizes,
    };
  }

  async listAllSessions(): Promise<{ sessions: Session[]; jarSizes: Record<string, number> }> {
    const sessions = await store.getSessions();
    const jars = await store.getAllJars(sessions.map((s) => s.id));
    const jarSizes: Record<string, number> = {};
    for (const s of sessions) jarSizes[s.id] = liveCount(jars[s.id]);
    return { sessions, jarSizes };
  }

  // ---- backup -------------------------------------------------------------

  async exportData(): Promise<BackupFile> {
    const sessions = await store.getSessions();
    const jars = await store.getAllJars(sessions.map((s) => s.id));
    return { format: 'session-switcher', version: 1, exportedAt: Date.now(), sessions, jars };
  }

  async importData(backup: BackupFile, merge: boolean): Promise<number> {
    if (backup.format !== 'session-switcher') throw new Error('Unrecognized backup file');
    if (!merge) {
      await clearAllRules();
      for (const b of [...this.bindings.keys()]) await this.unbindTab(b, { reload: false });
      const existing = await store.getSessions();
      for (const s of existing) await store.deleteSessionRecord(s.id);
    }
    for (const session of backup.sessions) {
      // Normalize the domain in case the backup came from a different parser.
      session.domain = registrableDomain(session.domain);
      await store.saveSession(session);
      await store.saveJar(session.id, backup.jars[session.id] ?? {});
    }
    return backup.sessions.length;
  }

  private async requireSession(id: string): Promise<Session> {
    const session = await store.getSession(id);
    if (!session) throw new Error(`Session ${id} not found`);
    return session;
  }
}
