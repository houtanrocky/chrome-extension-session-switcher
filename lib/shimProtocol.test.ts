import { describe, it, expect } from 'vitest';
import {
  NS_HASH_PARAM,
  storagePrefix,
  idbPrefix,
  withNamespaceMarker,
} from './shimProtocol';

const ID = '11111111-2222-3333-4444-555555555555';

describe('prefixes', () => {
  it('namespaces web-storage keys and IDB database names per session', () => {
    expect(storagePrefix(ID)).toBe(`__ss:${ID}:`);
    expect(idbPrefix(ID)).toBe(`__ss_${ID}__`);
  });
});

describe('withNamespaceMarker', () => {
  it('appends the marker as a URL hash', () => {
    expect(withNamespaceMarker('https://claude.ai/', ID)).toBe(
      `https://claude.ai/#${NS_HASH_PARAM}=${ID}`,
    );
  });

  it('preserves path and query', () => {
    const out = withNamespaceMarker('https://claude.ai/chat?new=1', ID);
    const u = new URL(out);
    expect(u.pathname).toBe('/chat');
    expect(u.search).toBe('?new=1');
    expect(u.hash).toBe(`#${NS_HASH_PARAM}=${ID}`);
  });

  it('replaces any pre-existing hash (markers must not stack)', () => {
    const out = withNamespaceMarker('https://claude.ai/x#section', ID);
    expect(out).toBe(`https://claude.ai/x#${NS_HASH_PARAM}=${ID}`);
  });

  it('round-trips through the same parse the shim uses', () => {
    // Mirror of readHashMarker() in the content script.
    const out = withNamespaceMarker('https://claude.ai/a/b?c=d', ID);
    const hash = new URL(out).hash.slice(1);
    const parsed = Object.fromEntries(
      hash.split('&').map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
      }),
    );
    expect(parsed[NS_HASH_PARAM]).toBe(ID);
  });
});
