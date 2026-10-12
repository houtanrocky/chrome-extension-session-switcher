/**
 * Core data model shared across the background engine and the UI.
 *
 * A {@link Session} is a named identity scoped to one registrable domain
 * (e.g. "Work" on `example.com`). Each session owns an isolated {@link CookieJar}
 * and — through the storage shim — an isolated `localStorage` / `sessionStorage`
 * / IndexedDB namespace. A browser *tab* can be *bound* to a session; while
 * bound, all of that tab's traffic and storage use the session's data instead
 * of the browser's shared profile.
 */

export type SameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

/** A single cookie as stored in a session's jar. */
export interface CookieRecord {
  name: string;
  value: string;
  /** Host without a leading dot (e.g. `example.com`). */
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSite;
  /** Epoch milliseconds. `undefined` => session cookie (no expiry). */
  expires?: number;
  /** True when the cookie had no `Domain` attribute (exact-host match only). */
  hostOnly: boolean;
}

/** All cookies belonging to one session, keyed by `name\0domain\0path`. */
export type CookieJar = Record<string, CookieRecord>;

export interface Session {
  id: string;
  /** Registrable domain this identity belongs to, e.g. `example.com`. */
  domain: string;
  /** Human label, e.g. "Work" or "alt #3". */
  name: string;
  /** UnoCSS-friendly hex color used for the dot/badge in the UI. */
  color: string;
  createdAt: number;
  updatedAt: number;
}

/** Runtime link between an open tab and the session driving it. */
export interface TabBinding {
  tabId: number;
  sessionId: string;
  domain: string;
}

/** What the popup needs to render for the currently active tab. */
export interface TabContext {
  tabId: number;
  url: string | null;
  host: string | null;
  /** Registrable domain of the active tab, or null for non-web pages. */
  domain: string | null;
  /** Friendly site name if the domain is in the known registry. */
  siteName: string | null;
  /** Session currently bound to this tab, if any. */
  boundSessionId: string | null;
  /** All sessions defined for this tab's domain. */
  sessions: Session[];
  /** Cookie counts per session id, for a quick "is this logged in" hint. */
  jarSizes: Record<string, number>;
}

/** Portable backup shape for export / import. */
export interface BackupFile {
  format: 'session-switcher';
  version: 1;
  exportedAt: number;
  sessions: Session[];
  jars: Record<string, CookieJar>;
}
