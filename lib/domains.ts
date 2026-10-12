/**
 * Registrable-domain ("eTLD+1") resolution plus a small registry of well-known
 * sites for nicer labels. We intentionally avoid bundling the full Public
 * Suffix List — a compact multi-part-suffix set covers the vast majority of
 * sites this extension targets. Unknown sites still work; they just fall back
 * to a 2-label guess and a domain-derived name.
 */

/** Multi-label public suffixes where eTLD+1 needs three labels. */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'gov.au',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'co.nz', 'org.nz', 'co.in', 'co.kr', 'com.br', 'com.cn',
  'com.tr', 'com.mx', 'com.sg', 'co.za',
]);

/**
 * Display-name overrides for domains whose auto-derived label would be wrong
 * (multi-word or non-standard casing). Any domain not listed here falls back to
 * a Title-Cased base label, so the extension works on every site regardless.
 */
const KNOWN_SITES: Record<string, string> = {
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'replit.com': 'Replit',
  'leetcode.com': 'LeetCode',
  'medium.com': 'Medium',
};

/** Returns the registrable domain (eTLD+1) for a hostname. */
export function registrableDomain(hostname: string): string {
  const host = hostname.replace(/\.$/, '').toLowerCase();
  const labels = host.split('.');
  if (labels.length <= 2) return host;

  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
}

/** Registrable domain for a full URL, or null for non-http(s) pages. */
export function domainFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return registrableDomain(u.hostname);
  } catch {
    return null;
  }
}

export function hostFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Friendly label for a domain. Falls back to a Title-Cased base name. */
export function siteName(domain: string): string {
  if (KNOWN_SITES[domain]) return KNOWN_SITES[domain]!;
  // Match a known entry by sub/parent domain (e.g. an app. or www. host).
  for (const [key, name] of Object.entries(KNOWN_SITES)) {
    if (key.endsWith('.' + domain) || domain.endsWith('.' + key)) return name;
  }
  const base = domain.split('.')[0] ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function isKnownSite(domain: string): boolean {
  return domain in KNOWN_SITES;
}
