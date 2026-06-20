import { describe, it, expect } from 'vitest';
import type { CookieJar } from '../types';
import {
  parseSetCookie,
  applyToJar,
  fromChromeCookie,
  putRecord,
  pruneExpired,
  toCookieHeader,
  liveCount,
} from './cookieJar';

const URL_ROOT = 'https://claude.ai/';

describe('parseSetCookie', () => {
  it('parses a bare name=value as a host-only session cookie', () => {
    const r = parseSetCookie('sid=abc123', URL_ROOT);
    expect(r).not.toBeNull();
    expect(r!.deleted).toBe(false);
    expect(r!.record).toMatchObject({
      name: 'sid',
      value: 'abc123',
      domain: 'claude.ai',
      path: '/',
      hostOnly: true,
      secure: false,
      httpOnly: false,
      sameSite: 'unspecified',
    });
    expect(r!.record.expires).toBeUndefined();
  });

  it('parses all standard attributes', () => {
    const r = parseSetCookie(
      'sid=abc; Domain=claude.ai; Path=/app; Secure; HttpOnly; SameSite=Lax; Max-Age=3600',
      'https://claude.ai/login',
    )!;
    expect(r.record).toMatchObject({
      domain: 'claude.ai',
      path: '/app',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      hostOnly: false, // an explicit Domain attribute means not host-only
    });
    const delta = r.record.expires! - Date.now();
    expect(delta).toBeGreaterThan(3_500_000);
    expect(delta).toBeLessThanOrEqual(3_600_000);
  });

  it('strips a leading dot from Domain and treats it as not host-only', () => {
    const r = parseSetCookie('a=b; Domain=.claude.ai', URL_ROOT)!;
    expect(r.record.domain).toBe('claude.ai');
    expect(r.record.hostOnly).toBe(false);
  });

  it('maps SameSite=None to no_restriction', () => {
    expect(parseSetCookie('a=b; SameSite=None', URL_ROOT)!.record.sameSite).toBe('no_restriction');
  });

  it('derives the default path from the request (strips the last segment)', () => {
    expect(parseSetCookie('a=b', 'https://claude.ai/foo/bar')!.record.path).toBe('/foo');
    expect(parseSetCookie('a=b', 'https://claude.ai/foo')!.record.path).toBe('/');
  });

  it('flags Max-Age=0 and past Expires as deletions', () => {
    expect(parseSetCookie('a=b; Max-Age=0', URL_ROOT)!.deleted).toBe(true);
    expect(
      parseSetCookie('a=b; Expires=Thu, 01 Jan 1970 00:00:00 GMT', URL_ROOT)!.deleted,
    ).toBe(true);
  });

  it('ignores unparseable Max-Age / Expires (treats as session cookie)', () => {
    const r = parseSetCookie('a=b; Max-Age=notanumber', URL_ROOT)!;
    expect(r.record.expires).toBeUndefined();
    expect(r.deleted).toBe(false);
  });

  it('rejects malformed headers', () => {
    expect(parseSetCookie('justaflag', URL_ROOT)).toBeNull();
    expect(parseSetCookie('=novalue', URL_ROOT)).toBeNull();
    expect(parseSetCookie('a=b', 'not-a-url')).toBeNull();
  });
});

describe('applyToJar', () => {
  it('reports change only when something actually changes', () => {
    const jar: CookieJar = {};
    expect(applyToJar(jar, parseSetCookie('a=1', URL_ROOT)!)).toBe(true); // insert
    expect(applyToJar(jar, parseSetCookie('a=1', URL_ROOT)!)).toBe(false); // identical
    expect(applyToJar(jar, parseSetCookie('a=2', URL_ROOT)!)).toBe(true); // new value
  });

  it('removes a cookie on a deletion header', () => {
    const jar: CookieJar = {};
    applyToJar(jar, parseSetCookie('a=1', URL_ROOT)!);
    expect(applyToJar(jar, parseSetCookie('a=; Max-Age=0', URL_ROOT)!)).toBe(true);
    expect(liveCount(jar)).toBe(0);
    expect(applyToJar(jar, parseSetCookie('a=; Max-Age=0', URL_ROOT)!)).toBe(false); // already gone
  });

  it('keys by name + domain + path so distinct scopes coexist', () => {
    const jar: CookieJar = {};
    applyToJar(jar, parseSetCookie('a=root', 'https://claude.ai/')!);
    applyToJar(jar, parseSetCookie('a=appval', 'https://claude.ai/app/x')!); // path /app
    expect(liveCount(jar)).toBe(2);
  });
});

describe('toCookieHeader', () => {
  it('serializes matching cookies as a Cookie header value', () => {
    const jar: CookieJar = {};
    applyToJar(jar, parseSetCookie('sid=abc', URL_ROOT)!);
    applyToJar(jar, parseSetCookie('theme=dark', URL_ROOT)!);
    const header = toCookieHeader(jar, 'claude.ai');
    expect(header.split('; ').sort()).toEqual(['sid=abc', 'theme=dark']);
  });

  it('host-only cookies are not sent to subdomains; domain cookies are', () => {
    const jar: CookieJar = {};
    applyToJar(jar, parseSetCookie('host=1', 'https://claude.ai/')!); // hostOnly
    applyToJar(jar, parseSetCookie('dom=1; Domain=claude.ai', 'https://claude.ai/')!);
    expect(toCookieHeader(jar, 'claude.ai')).toContain('host=1');
    // For a subdomain host, only the Domain cookie applies.
    expect(toCookieHeader(jar, 'api.claude.ai')).toBe('dom=1');
  });

  it('excludes expired cookies', () => {
    const jar: CookieJar = {};
    putRecord(jar, {
      name: 'stale', value: 'x', domain: 'claude.ai', path: '/',
      secure: false, httpOnly: false, sameSite: 'unspecified',
      expires: Date.now() - 1000, hostOnly: true,
    });
    expect(toCookieHeader(jar, 'claude.ai')).toBe('');
  });
});

describe('pruneExpired + liveCount', () => {
  it('drops expired entries and counts only live ones', () => {
    const jar: CookieJar = {};
    applyToJar(jar, parseSetCookie('live=1', URL_ROOT)!); // session cookie
    putRecord(jar, {
      name: 'dead', value: 'x', domain: 'claude.ai', path: '/',
      secure: false, httpOnly: false, sameSite: 'unspecified',
      expires: Date.now() - 1, hostOnly: true,
    });
    expect(liveCount(jar)).toBe(1);
    expect(pruneExpired(jar)).toBe(true);
    expect(Object.keys(jar)).toHaveLength(1);
    expect(toCookieHeader(jar, 'claude.ai')).toBe('live=1'); // the survivor
    expect(pruneExpired(jar)).toBe(false); // nothing left to prune
  });

  it('liveCount tolerates an undefined jar', () => {
    expect(liveCount(undefined)).toBe(0);
  });
});

describe('fromChromeCookie', () => {
  it('maps a chrome.cookies.Cookie into a record (seconds → ms)', () => {
    const rec = fromChromeCookie({
      name: 'sid', value: 'v', domain: '.claude.ai', path: '/',
      secure: true, httpOnly: true, sameSite: 'lax', hostOnly: false,
      expirationDate: 2_000_000, session: false, storeId: '0',
    } as chrome.cookies.Cookie);
    expect(rec).toMatchObject({
      name: 'sid', domain: 'claude.ai', secure: true, httpOnly: true,
      sameSite: 'lax', hostOnly: false, expires: 2_000_000_000,
    });
  });
});
