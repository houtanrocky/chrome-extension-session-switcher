/**
 * Constants shared between the background (which stamps the namespace onto a
 * managed tab's URL) and the MAIN-world storage shim (which reads it back).
 *
 * Pure strings only — this module must stay importable from a MAIN-world
 * content script that has no access to `chrome.*`.
 */

/** URL-hash parameter carrying the session id on a managed tab's first load. */
export const NS_HASH_PARAM = '__ssns';

/** Reserved real-`sessionStorage` key that persists the namespace per tab. */
export const NS_SESSION_KEY = '__ss_ns__';

/** Key prefix applied to every web-storage entry of a managed session. */
export function storagePrefix(sessionId: string): string {
  return `__ss:${sessionId}:`;
}

/** Prefix applied to IndexedDB database names so each session gets real DBs. */
export function idbPrefix(sessionId: string): string {
  return `__ss_${sessionId}__`;
}

/** Append the namespace marker to a URL so the shim can pick it up at start. */
export function withNamespaceMarker(url: string, sessionId: string): string {
  try {
    const u = new URL(url);
    u.hash = `${NS_HASH_PARAM}=${encodeURIComponent(sessionId)}`;
    return u.toString();
  } catch {
    const sep = url.includes('#') ? '&' : '#';
    return `${url}${sep}${NS_HASH_PARAM}=${encodeURIComponent(sessionId)}`;
  }
}
