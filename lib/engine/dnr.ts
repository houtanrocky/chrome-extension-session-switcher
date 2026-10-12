/**
 * Declarative Net Request rules for per-tab cookie isolation.
 *
 * A session can span several subdomains. We install one rule for the base
 * domain and one host-specific rule for every cookie host in the session jar.
 * This keeps auth.example.com cookies out of www.example.com requests while
 * still supporting SSO redirects between subdomains without oversized headers.
 */
import type { CookieJar } from '../types';
import { toCookieHeader } from './cookieJar';

const RT = chrome.declarativeNetRequest.ResourceType;
const RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  RT.MAIN_FRAME, RT.SUB_FRAME, RT.XMLHTTPREQUEST, RT.SCRIPT, RT.IMAGE,
  RT.STYLESHEET, RT.FONT, RT.MEDIA, RT.PING, RT.OTHER,
];

function regexForPath(path: string): string | undefined {
  if (path === '/') return undefined;
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://[^/]+${escaped}(?:[/?#]|$)`;
}

export async function applyTabRule(tabId: number, domain: string, jar: CookieJar): Promise<void> {
  const Op = chrome.declarativeNetRequest.HeaderOperation;
  const hosts = new Set<string>([domain]);
  for (const cookie of Object.values(jar)) {
    const host = cookie.domain.replace(/^\./, '').toLowerCase();
    if (host === domain || host.endsWith('.' + domain)) hosts.add(host);
  }

  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const oldIds = new Set(
    existing.filter((rule) => rule.condition.tabIds?.includes(tabId)).map((rule) => rule.id),
  );
  const usedIds = new Set(existing.filter((rule) => !oldIds.has(rule.id)).map((rule) => rule.id));
  let nextId = 1_000_000;
  const allocateId = () => {
    while (usedIds.has(nextId)) nextId++;
    usedIds.add(nextId);
    return nextId++;
  };
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  for (const host of [...hosts].sort()) {
    const paths = new Set<string>(['/']);
    for (const cookie of Object.values(jar)) {
      const cookieHost = cookie.domain.replace(/^\./, '').toLowerCase();
      const appliesToHost = cookieHost === host || (!cookie.hostOnly && host.endsWith('.' + cookieHost));
      if (appliesToHost && (cookieHost === domain || cookieHost.endsWith('.' + domain))) {
        paths.add(cookie.path || '/');
      }
    }
    for (const path of [...paths].sort((a, b) => a.length - b.length)) {
      const cookieHeader = toCookieHeader(jar, host, path);
      const cookieAction: chrome.declarativeNetRequest.ModifyHeaderInfo = cookieHeader
        ? { header: 'cookie', operation: Op.SET, value: cookieHeader }
        : { header: 'cookie', operation: Op.REMOVE };
      rules.push({
        id: allocateId(),
        priority: path.length * 10 + (host === domain ? 1 : 2),
        condition: {
          tabIds: [tabId], requestDomains: [host], resourceTypes: RESOURCE_TYPES,
          ...(regexForPath(path) ? { regexFilter: regexForPath(path) } : {}),
        },
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [cookieAction],
          responseHeaders: [{ header: 'set-cookie', operation: Op.REMOVE }],
        },
      });
    }
  }

  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [...oldIds], addRules: rules });
}

export async function clearTabRule(tabId: number): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: existing
      .filter((rule) => rule.condition.tabIds?.includes(tabId))
      .map((rule) => rule.id),
  });
}

export async function clearAllRules(): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  if (existing.length) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map((rule) => rule.id),
    });
  }
}
