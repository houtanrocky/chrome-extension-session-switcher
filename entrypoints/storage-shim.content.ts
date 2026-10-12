/**
 * MAIN-world storage shim (runs at document_start, before page scripts).
 *
 * When a tab is managed, its session id is delivered synchronously via a URL
 * hash marker on first load and then stashed in a reserved real-`sessionStorage`
 * key so it survives in-tab navigations. Given a session id we:
 *   - wrap `localStorage` / `sessionStorage` in a Proxy that key-prefixes every
 *     entry with `__ss:<id>:` (real isolation inside the shared physical store),
 *   - replace `indexedDB` with a wrapper that prefixes database *names* so each
 *     session gets physically separate databases with full native fidelity.
 *
 * No `chrome.*` here — MAIN world has none. Pure DOM + the shared constants.
 */
import {
  NS_HASH_PARAM,
  NS_SESSION_KEY,
  storagePrefix,
  idbPrefix,
} from '@/lib/shimProtocol';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  allFrames: true,
  world: 'MAIN',
  main() {
    let realLocal: Storage;
    let realSession: Storage;
    try {
      realLocal = window.localStorage;
      realSession = window.sessionStorage;
    } catch {
      return; // storage blocked for this origin (opaque/sandboxed)
    }

    const sessionId = resolveSessionId(realSession);
    if (!sessionId) return; // unmanaged tab → leave native storage untouched

    // Must run before the page can register/use a service worker (whose
    // requests would bypass the per-tab cookie rule — see below).
    disableServiceWorkers(realSession);

    installDocumentCookieBridge();
    const prefix = storagePrefix(sessionId);
    installNamespacedStorage('localStorage', realLocal, prefix);
    installNamespacedStorage('sessionStorage', realSession, prefix);
    installNamespacedIndexedDb(sessionId);
  },
});

/** Pull the session id from the hash marker, else the reserved session key. */
function resolveSessionId(realSession: Storage): string | null {
  const fromHash = readHashMarker();
  if (fromHash) {
    try {
      realSession.setItem(NS_SESSION_KEY, fromHash);
    } catch {
      /* ignore */
    }
    stripHashMarker();
    return fromHash;
  }
  try {
    return realSession.getItem(NS_SESSION_KEY);
  } catch {
    return null;
  }
}

/** Forward JavaScript-set cookies to the isolated content bridge. */
function installDocumentCookieBridge(): void {
  let proto: object | null = Object.getPrototypeOf(document);
  let descriptor: PropertyDescriptor | undefined;
  while (proto && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(proto, 'cookie');
    proto = Object.getPrototypeOf(proto);
  }
  if (!descriptor?.get || !descriptor.set) return;
  try {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => descriptor.get!.call(document),
      set: (value: string) => {
        descriptor.set!.call(document, value);
        window.dispatchEvent(new CustomEvent('session-switcher-cookie', {
          detail: { url: location.href, cookie: value },
        }));
      },
    });
  } catch {
    /* Some locked-down pages do not allow replacing document.cookie. */
  }
}

function readHashMarker(): string | null {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  for (const part of hash.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === NS_HASH_PARAM) {
      try {
        return decodeURIComponent(part.slice(eq + 1));
      } catch {
        return part.slice(eq + 1);
      }
    }
  }
  return null;
}

/**
 * Neutralize service workers in a managed tab.
 *
 * A page's service worker is *per-origin* — one instance serves every tab of
 * that origin — and its network requests carry **no tab id**, so the per-tab
 * `declarativeNetRequest` cookie rule can never match them. A SW-driven site
 * (a chat app or webmail SPA, say) would therefore route authenticated traffic
 * through the shared profile and collapse every session onto one identity once
 * its worker takes control (typically after the first reload). There is no way
 * to scope a single shared worker per session, so for isolated tabs we block
 * new registrations and tear down any worker left from a prior unmanaged visit,
 * keeping all traffic in the page where it is tab-scoped and isolated.
 */
function disableServiceWorkers(realSession: Storage): void {
  const swc = navigator.serviceWorker as ServiceWorkerContainer | undefined;
  if (!swc) return;

  const wasControlled = !!swc.controller;
  const getRegistrations = swc.getRegistrations?.bind(swc);

  // Block (re)registration. Rejecting keeps feature-detecting sites happy; if
  // the property can't be redefined, hide the container as a fallback.
  try {
    Object.defineProperty(swc, 'register', {
      configurable: true,
      value: () =>
        Promise.reject(new Error('Service workers are disabled in an isolated session')),
    });
  } catch {
    try {
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => undefined });
    } catch {
      /* locked down — best effort */
    }
  }

  // Remove any worker registered during an earlier non-isolated visit; if one
  // was actually controlling this load, reload once (guarded) to escape it.
  getRegistrations?.()
    .then((regs) => {
      if (!regs.length) return undefined;
      return Promise.all(regs.map((r) => r.unregister().catch(() => false))).then(() => {
        if (wasControlled && !reloadGuard(realSession)) location.reload();
      });
    })
    .catch(() => {});
}

/** One-shot guard (per origin) so the unregister-triggered reload can't loop. */
function reloadGuard(realSession: Storage): boolean {
  const KEY = '__ss_sw_reloaded__';
  try {
    if (realSession.getItem(KEY)) return true;
    realSession.setItem(KEY, '1');
    return false;
  } catch {
    return true; // can't track it → don't risk a reload loop
  }
}

/** Remove only our marker from the URL hash; preserve any legitimate fragment. */
function stripHashMarker(): void {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const kept = hash.split('&').filter((p) => p.split('=')[0] !== NS_HASH_PARAM);
  const newHash = kept.length ? '#' + kept.join('&') : '';
  try {
    history.replaceState(history.state, '', location.pathname + location.search + newHash);
  } catch {
    /* replaceState can fail on some origins; harmless */
  }
}

/**
 * Replace a Storage accessor on `window` with a Proxy that transparently
 * prefixes keys. Only entries belonging to this session are visible; `clear()`
 * and enumeration are likewise scoped, so concurrent sessions on the same
 * origin never see each other's keys.
 */
function installNamespacedStorage(
  prop: 'localStorage' | 'sessionStorage',
  real: Storage,
  prefix: string,
): void {
  const ourKeys = (): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < real.length; i++) {
      const k = real.key(i);
      if (k && k.startsWith(prefix)) keys.push(k.slice(prefix.length));
    }
    return keys;
  };

  const proxy = new Proxy(real, {
    get(target, p, receiver) {
      switch (p) {
        case 'getItem':
          return (k: string) => real.getItem(prefix + k);
        case 'setItem':
          return (k: string, v: string) => real.setItem(prefix + k, String(v));
        case 'removeItem':
          return (k: string) => real.removeItem(prefix + k);
        case 'clear':
          return () => {
            for (const k of ourKeys()) real.removeItem(prefix + k);
          };
        case 'key':
          return (i: number) => ourKeys()[i] ?? null;
        case 'length':
          return ourKeys().length;
        default:
          if (typeof p === 'symbol') return Reflect.get(target, p, receiver);
          if (p in Storage.prototype) return Reflect.get(target, p, receiver);
          // named property access: localStorage.foo
          return real.getItem(prefix + String(p)) ?? undefined;
      }
    },
    set(_target, p, value) {
      if (typeof p === 'symbol') return true;
      if (p === 'length') return true;
      real.setItem(prefix + String(p), String(value));
      return true;
    },
    has(_target, p) {
      if (typeof p === 'symbol') return false;
      return real.getItem(prefix + String(p)) !== null;
    },
    deleteProperty(_target, p) {
      if (typeof p !== 'symbol') real.removeItem(prefix + String(p));
      return true;
    },
    ownKeys() {
      return ourKeys();
    },
    getOwnPropertyDescriptor(_target, p) {
      if (typeof p === 'symbol') return undefined;
      const v = real.getItem(prefix + String(p));
      if (v === null) return undefined;
      return { value: v, writable: true, enumerable: true, configurable: true };
    },
  });

  try {
    Object.defineProperty(window, prop, { configurable: true, get: () => proxy });
  } catch {
    /* accessor locked down — best effort */
  }
}

/** Swap `window.indexedDB` for a name-prefixing wrapper over the native factory. */
function installNamespacedIndexedDb(sessionId: string): void {
  const real = window.indexedDB;
  if (!real) return;
  const prefix = idbPrefix(sessionId);

  const wrapper = Object.create(IDBFactory.prototype) as IDBFactory;
  Object.assign(wrapper, {
    open: (name: string, version?: number) =>
      version === undefined ? real.open(prefix + name) : real.open(prefix + name, version),
    deleteDatabase: (name: string) => real.deleteDatabase(prefix + name),
    cmp: (a: unknown, b: unknown) => real.cmp(a, b),
    databases: async () => {
      const list = (await real.databases?.()) ?? [];
      return list
        .filter((d) => d.name?.startsWith(prefix))
        .map((d) => ({ name: d.name!.slice(prefix.length), version: d.version }));
    },
  });

  try {
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => wrapper });
  } catch {
    /* best effort */
  }
}
