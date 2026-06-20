# Session Switcher

Run **many accounts side by side** on Claude, ChatGPT, Gemini, Perplexity and
basically any login-gated or rate-limited site — in a single browser window, at
the same time. Each tab you "open in a session" gets its **own isolated cookie
jar and its own `localStorage` / `sessionStorage` / IndexedDB namespace**, so
ten logins behave like ten independent browsers.

Built with **WXT + Preact + UnoCSS**, TypeScript throughout, Manifest V3.

**Browser support: Chromium only** — Chrome, Edge, Brave, Opera, Arc, and other
Chromium browsers (verified equivalent across two Chromium versions via the E2E
test). The isolation engine relies on Chromium's MV3 `declarativeNetRequest`
session rules (per-tab `tabIds` conditions); Firefox lacks these, so it is not
supported. On Firefox, native [container tabs](https://support.mozilla.org/kb/containers)
already provide per-identity isolation.

---

## How it works

Chrome has no native per-tab cookie jars (unlike Firefox containers), so
isolation is assembled from two independent mechanisms:

### 1. Per-tab cookie isolation (network layer)

- **`declarativeNetRequest`** installs one session-scoped rule per managed tab
  (`tabIds` condition). It **sets the outgoing `Cookie` header** to that
  session's jar and **strips incoming `Set-Cookie`** so the browser's shared
  profile is never touched.
- **`webRequest.onHeadersReceived`** (observe-only, `extraHeaders`) reads
  `Set-Cookie` off responses and folds them back into the session's jar, then
  refreshes the DNR rule. This is the read/write loop that keeps each session
  logged in independently.

→ `lib/engine/dnr.ts`, `lib/engine/capture.ts`, `lib/engine/cookieJar.ts`

### 2. Per-session web-storage isolation (page layer)

A **MAIN-world content script at `document_start`** (`storage-shim.content.ts`)
runs before page scripts and:

- wraps `localStorage` / `sessionStorage` in a `Proxy` that **key-prefixes**
  every entry with `__ss:<sessionId>:` — real isolation inside the shared
  physical store, fully synchronous;
- replaces `indexedDB` with a wrapper that **prefixes database names**
  (`__ss_<sessionId>__`), giving each session physically separate databases with
  full native-engine fidelity (no reimplementation of the IndexedDB API).

The session id reaches the shim **synchronously**: it's stamped onto the tab's
URL as a `#__ssns=<id>` hash on first load, then stashed in a reserved
`sessionStorage` key so it survives in-tab navigations. No async messaging gap.

### Orchestration

`lib/engine/manager.ts` is the single source of truth: it owns the in-memory
binding/jar caches, wires the capture listener, and exposes every operation the
UI calls over a typed message protocol (`lib/messaging.ts`). The cookie backend
lives entirely behind this class, so a future **true-proxy** backend can be
swapped in without touching the UI.

---

## Using it

- Click the toolbar icon on any site → **create a session** (e.g. "Work"),
  then **Open** (new isolated tab) or **Use here** (reload current tab into it).
- Log in normally. The session now remembers that account.
- Create more sessions and open each — they stay logged in concurrently.
- **Import current login** copies the browser's existing real login into the
  active session, so you don't have to re-authenticate the first account.
- **Manage all sessions** (full page) for rename / recolor / delete and
  **export / import** a JSON backup of all sessions + jars.

---

## Develop

```bash
npm install         # also runs `wxt prepare` (generates .wxt/ types)
npm run dev         # launches Chrome with the extension + HMR
npm run build       # production build → .output/chrome-mv3
npm run zip         # packaged zip for the Web Store
npm run compile     # type-check only (tsc --noEmit)
npm test            # unit + integration tests (Vitest)
npm run test:e2e    # end-to-end isolation test in real Chrome
```

### Tests

`npm test` runs the engine suite (cookie parsing, domain resolution, the
storage-namespace protocol, and the `SessionManager` against a faked `chrome`
API — including proof that two concurrent sessions stay separate).

`npm run test:e2e` loads the built extension into **real Chrome** and, using a
local fake-login server (no real accounts), verifies that two sessions stay
logged into different identities at once, that the browser's shared profile is
never touched, and that web storage is namespaced per session. It uses
[Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing)
because regular Chrome ≥137 ignores `--load-extension`; the harness installs it
on demand (or set `CHROME_PATH` to your own).

Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** →
select `.output/chrome-mv3`.

> **Icons:** the toolbar icons live at `public/icon/{16,32,48,96,128}.png` and
> WXT wires them into the manifest automatically. They're generated (no image
> deps) by `node scripts/gen-icons.mjs` — edit that script to change the mark.

---

## Honest limitations

- **Site service workers.** A site's own service worker makes requests with no
  tab id, so the per-tab DNR rule can't target them. Sites that route
  authenticated traffic through a SW may leak to the shared profile. Most
  targeted AI sites authenticate via normal document/XHR requests and are fine.
- **Cross-origin SSO.** Logins that depend on a *separate* identity domain
  (e.g. Google account for Gemini) aren't isolated by domain-scoped cookies and
  may behave inconsistently.
- **Storage shim is best-effort.** Overriding `localStorage`/`indexedDB` is
  inherently invasive; a site that captures references before `document_start`,
  or relies on `indexedDB instanceof IDBFactory` internals, may misbehave. The
  shim fails safe (native storage) rather than breaking the page.
- **Path-scoped cookies** are sent coarsely (whole domain jar per request) since
  the goal is identity isolation, not byte-exact cookie semantics.
- **Shared quota.** Key-prefixing means all sessions on one origin share that
  origin's `localStorage` quota.
