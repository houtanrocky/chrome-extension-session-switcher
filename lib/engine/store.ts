/**
 * Persistence layer. Sessions + cookie jars live in `storage.local` (durable,
 * `unlimitedStorage`). Tab→session bindings live in `storage.session` because
 * they are only meaningful while the browser session — and the bound tabs —
 * are alive, and they must survive the MV3 service worker being torn down.
 *
 * Everything goes through this module so the rest of the engine never touches
 * `chrome.storage` keys directly. This is also the seam where a future
 * proxy-based concurrent backend could swap in a different jar store.
 */
import type { CookieJar, Session, TabBinding } from '../types';

const SESSIONS_KEY = 'sessions';
const jarKey = (id: string) => `jar:${id}`;
const BINDINGS_KEY = 'bindings';

// ---- sessions -------------------------------------------------------------

export async function getSessions(): Promise<Session[]> {
  const out = await chrome.storage.local.get(SESSIONS_KEY);
  return (out[SESSIONS_KEY] as Session[]) ?? [];
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await getSessions()).find((s) => s.id === id);
}

export async function getSessionsForDomain(domain: string): Promise<Session[]> {
  return (await getSessions()).filter((s) => s.domain === domain);
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
}

export async function deleteSessionRecord(id: string): Promise<void> {
  const sessions = (await getSessions()).filter((s) => s.id !== id);
  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
  await chrome.storage.local.remove(jarKey(id));
}

// ---- jars -----------------------------------------------------------------

export async function getJar(sessionId: string): Promise<CookieJar> {
  const out = await chrome.storage.local.get(jarKey(sessionId));
  return (out[jarKey(sessionId)] as CookieJar) ?? {};
}

export async function saveJar(sessionId: string, jar: CookieJar): Promise<void> {
  await chrome.storage.local.set({ [jarKey(sessionId)]: jar });
}

export async function getAllJars(ids: string[]): Promise<Record<string, CookieJar>> {
  const keys = ids.map(jarKey);
  const out = await chrome.storage.local.get(keys);
  const jars: Record<string, CookieJar> = {};
  for (const id of ids) jars[id] = (out[jarKey(id)] as CookieJar) ?? {};
  return jars;
}

// ---- bindings (ephemeral, per browser session) ----------------------------

export async function getBindings(): Promise<Record<number, TabBinding>> {
  const out = await chrome.storage.session.get(BINDINGS_KEY);
  return (out[BINDINGS_KEY] as Record<number, TabBinding>) ?? {};
}

export async function setBinding(binding: TabBinding): Promise<void> {
  const bindings = await getBindings();
  bindings[binding.tabId] = binding;
  await chrome.storage.session.set({ [BINDINGS_KEY]: bindings });
}

export async function removeBinding(tabId: number): Promise<void> {
  const bindings = await getBindings();
  if (bindings[tabId]) {
    delete bindings[tabId];
    await chrome.storage.session.set({ [BINDINGS_KEY]: bindings });
  }
}
