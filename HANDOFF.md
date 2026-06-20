# Session Switcher — Handoff / Context Pack

> Purpose of this file: everything needed to continue this project in a fresh
> chat after moving the repo to Windows and testing in Chrome. Read this first.

## What this is

A Manifest V3 Chrome extension that lets you run **many accounts side by side**
on Claude, ChatGPT, Gemini, Perplexity, and any login-gated / rate-limited site,
**concurrently in one window**. Each tab "opened in a session" gets its **own
isolated cookie jar** and its **own `localStorage` / `sessionStorage` / IndexedDB
namespace**.

## Locked technology decisions (confirmed by user)

- **Build framework:** WXT
- **UI:** Preact
- **Styling:** UnoCSS
- **Isolation strategy:** "Cookie-concurrent + storage shim" — per-tab cookie
  jars (declarativeNetRequest + webRequest) PLUS a MAIN-world storage shim that
  namespaces web storage per session. (Architected "hybrid": cookie backend is
  behind `SessionManager` so a future true-proxy backend can swap in.)

## Status

- ✅ Full codebase written, clean TypeScript, strict mode.
- ✅ `npm install` works; `wxt prepare` generates `.wxt/` types.
- ✅ `npm run compile` (tsc --noEmit) passes with **zero errors** (re-verified on Windows / Node 22).
- ✅ `npm run build` succeeds → `.output/chrome-mv3` (~63 kB total, icons included).
- ✅ Generated `manifest.json` verified: MV3, correct permissions, and the
  storage shim is registered with `"world": "MAIN"`, `"run_at": "document_start"`,
  `"all_frames": true`.
- ✅ **Toolbar icons added** — `public/icon/{16,32,48,96,128}.png`, auto-wired by
  WXT into `icons` + `action.default_icon`. Regenerate with
  `node scripts/gen-icons.mjs` (pure-Node PNG encoder, no image deps).
- ✅ **Automated tests pass** — 48 unit/integration tests (Vitest) **and a
  10-check real-Chrome end-to-end isolation test**. The E2E loads the built
  extension in real Chrome and proves: two accounts stay logged in concurrently
  and isolated, the browser's shared profile is never touched, and web storage
  is namespaced per session. Verified on **two different Chromium builds**.
  `npm test`, `npm run test:e2e`. See "Testing".
- ⚠️ **Real AI sites not yet manually spot-checked.** The E2E proves the
  isolation *mechanism* in real Chrome (against a local fake-login server);
  ChatGPT/Claude with their own service workers / cross-origin SSO still warrant
  a quick manual pass (see "Known limitations").

### Changes since the original handoff

- **Fixed "import current login" merging identities across sessions.** It copies
  the *shared* browser profile's login, so using it on a second (or already
  logged-in) session pulled the first account's cookies in and overwrote the
  session's own login → sessions collapsed onto one account. Now import only
  *fills missing* cookies (`fillRecord`, never overwrites), the popup shows the
  button (relabeled **"Adopt browser login"**) only while the session is logged
  out, and `importCurrentLogin` returns the count actually added. Regression
  test in `lib/engine/manager.test.ts`.
- **Fixed service-worker cookie leakage** (reproduced on claude.ai: two sessions
  collapsed onto one account after a reload). Managed tabs now disable service
  workers — see "Known limitations" for the full mechanism + trade-off. Pinned
  by a real-Chrome regression test, `test/e2e-sw.mjs`.
- **Fixed `bindTab` ("Use here") silently not isolating storage.** Appending the
  `#__ssns=<id>` marker to the tab's *current* URL is a same-document
  navigation, so the `document_start` storage shim never re-ran and the
  namespace was never picked up. `bindTab` now forces a reload when the change
  is hash-only (`sameDocument()` guard in `lib/engine/manager.ts`). "Open"
  (new-tab) was unaffected — it loads via `about:blank` → real URL (cross-doc).
  This fix is covered by a regression test (`lib/engine/manager.test.ts`).
- Added a **test suite**: `lib/**/*.test.ts` (Vitest; engine tests use a faked
  `chrome` API in `test/chromeMock.ts`) plus a real-browser **E2E** harness
  (`test/e2e.mjs`) with a local fake-login server.
- Removed the WSL-only `scripts/*.sh` helpers; added `scripts/gen-icons.mjs`.
- **Scoped support to Chromium only** (Chrome/Edge/Brave/Opera/Arc) and removed
  the `dev:firefox` / `build:firefox` scripts. The E2E passes on two different
  Chromium builds; the Firefox target compiled but can't function — Firefox has
  no DNR session rules / `tabIds`, which *is* the per-tab cookie engine. (A real
  Firefox port would use native contextual identities, a separate backend.)

## Architecture (how isolation actually works)

Chrome has no native per-tab cookie jars (unlike Firefox containers), so two
independent mechanisms are combined:

### 1. Per-tab cookie isolation (network layer)
- `declarativeNetRequest` installs **one session-scoped rule per managed tab**
  (rule id == tabId; `tabIds` condition). It **sets the outgoing `Cookie`
  header** to that session's jar value and **removes incoming `Set-Cookie`** so
  the browser's shared profile stays clean. Empty jar → Cookie header removed
  (logged-out state).
- `webRequest.onHeadersReceived` (observe-only, `extraHeaders`) **reads
  `Set-Cookie`** off responses, folds them into the session jar, then refreshes
  the DNR rule (debounced 60ms). This loop keeps each session independently
  logged in.
- Files: `lib/engine/dnr.ts`, `lib/engine/capture.ts`, `lib/engine/cookieJar.ts`.

### 2. Per-session web-storage isolation (page layer)
- MAIN-world content script at `document_start` (`entrypoints/storage-shim.content.ts`):
  - wraps `localStorage`/`sessionStorage` in a `Proxy` that **key-prefixes**
    every entry with `__ss:<sessionId>:` (real isolation in the shared physical
    store, fully synchronous);
  - replaces `indexedDB` with a wrapper that **prefixes database names**
    (`__ss_<sessionId>__`) → physically separate DBs, full native fidelity, no
    reimplementation of the IDB API.
- **Synchronous session-id delivery (the key trick):** the session id is stamped
  onto the managed tab's URL as `#__ssns=<id>` on first load; the shim reads it
  at `document_start`, stashes it in a reserved real-`sessionStorage` key
  (`__ss_ns__`) so it survives in-tab navigations, then strips the hash. No async
  messaging gap. Constants in `lib/shimProtocol.ts`.

### Orchestration
- `lib/engine/manager.ts` (`SessionManager`) is the single source of truth:
  in-memory caches for bindings + jars, wires the capture listener, exposes all
  high-level ops. **All cookie state flows through here** — the seam for a future
  proxy backend.
- `lib/messaging.ts` is the typed message protocol (UI ↔ background). Fully
  type-checked via `MessageMap`.
- Persistence (`lib/engine/store.ts`): sessions + jars in `storage.local`
  (`unlimitedStorage`); tab→session bindings in `storage.session` (survive SW
  restarts, clear on browser restart, matching session-scoped DNR rules).

## File map

```
package.json                         deps + scripts (dev/build/zip/compile)
wxt.config.ts                        manifest (permissions, host_permissions, Preact+UnoCSS via Vite)
uno.config.ts                        UnoCSS theme + shortcuts (btn, card, input, colors)
tsconfig.json                        extends .wxt/tsconfig.json, strict, preact jsx
lib/types.ts                         CookieRecord, CookieJar, Session, TabBinding, TabContext, BackupFile
lib/domains.ts                       registrableDomain(), domainFromUrl(), siteName(), known-site registry
lib/messaging.ts                     MessageMap + sendMessage() + registerHandlers()
lib/shimProtocol.ts                  NS_HASH_PARAM, NS_SESSION_KEY, prefixes, withNamespaceMarker()  (pure, MAIN-safe)
lib/engine/cookieJar.ts              parseSetCookie, applyToJar, toCookieHeader, fromChromeCookie, prune
lib/engine/store.ts                  chrome.storage wrappers (sessions/jars/bindings)
lib/engine/dnr.ts                    applyTabRule/clearTabRule/clearAllRules (uses chrome.declarativeNetRequest enums)
lib/engine/capture.ts                installCaptureListener (webRequest onHeadersReceived)
lib/engine/manager.ts                SessionManager — orchestrator
entrypoints/background.ts            instantiate manager + registerHandlers
entrypoints/storage-shim.content.ts  MAIN-world storage namespacing shim
entrypoints/popup/{index.html,main.tsx,App.tsx}    popup UI (per-site sessions)
entrypoints/manager/{index.html,main.tsx,App.tsx}  full-page manager (all sessions, export/import)
public/icon/{16,32,48,96,128}.png    toolbar icons (generated; do not hand-edit)
scripts/gen-icons.mjs                regenerates public/icon/*.png — zero deps (raw PNG + zlib)
README.md                            user-facing docs
HANDOFF.md                           this file
```

## Build & test (on Windows)

```powershell
cd <repo>
npm install          # runs wxt prepare (postinstall)
npm run compile      # type-check (must stay clean)
npm test             # 48 unit/integration tests (Vitest)
npm run test:e2e     # real-Chrome end-to-end isolation test (10 checks)
npm run dev          # launches Chrome with HMR — easiest for manual testing
# or
npm run build        # -> .output/chrome-mv3 ; load unpacked in chrome://extensions
```

(The old WSL/nvm `scripts/*.sh` helpers have been removed. `scripts/` now holds
only `gen-icons.mjs`, the dependency-free icon generator.)

## Testing

**Unit + integration (`npm test`, Vitest, ~1 s):**
- `lib/domains.test.ts` — eTLD+1 resolution, URL → domain, site names.
- `lib/shimProtocol.test.ts` — namespace prefixes + `withNamespaceMarker`.
- `lib/engine/cookieJar.test.ts` — `Set-Cookie` parsing (attributes, Max-Age /
  Expires, deletions, host-only vs domain), jar apply/prune, `Cookie` header
  build incl. host/subdomain matching.
- `lib/engine/manager.test.ts` — the SessionManager against a faked `chrome`
  API (`test/chromeMock.ts`): session CRUD, `openInSession` rule install, the
  `bindTab` same-document reload fix, the `Set-Cookie` capture→jar→DNR loop,
  **two concurrent sessions staying separate**, import-login, export/import,
  delete-detaches-tabs.

**End-to-end in real Chrome (`npm run test:e2e`):** builds the extension, loads
it in real Chrome, and drives a local fake-login server (no real accounts):
- `test/e2e.mjs` — concurrent isolated logins (Alice vs Bob), the shared browser
  profile staying clean, and per-session web-storage namespacing.
- `test/e2e-sw.mjs` — the **service-worker regression**: a site whose SW
  intercepts requests must not break a managed tab's identity (the claude.ai
  bug). Shared helpers live in `test/harness.mjs`.

> The E2E needs a Chrome that still honours `--load-extension`. Regular Chrome
> ≥137 ignores it (a malware mitigation), so the harness uses **Chrome for
> Testing** — it auto-discovers one in puppeteer's cache, else downloads it
> (needs network to `storage.googleapis.com`). Point `CHROME_PATH` at your own
> CfT binary to skip the download.

## Manual test plan (do this first in real Chrome)

1. Load unpacked `.output/chrome-mv3` (or use `npm run dev`).
2. Go to `chatgpt.com` (or `claude.ai`). Open popup → create session "A".
3. Click **Open** → new tab loads logged-out. Log in as account 1.
4. Back on the site, create session "B" → **Open** → log in as account 2.
5. Both tabs should stay logged into different accounts **simultaneously**.
6. Verify storage isolation: in each tab's DevTools, Application → Local Storage
   keys should be prefixed `__ss:<id>:`; IndexedDB DBs prefixed `__ss_<id>__`.
7. **Import current login**: on a tab already logged in normally, create a
   session, bind it ("Use here"), click "Import current login" → it copies the
   real cookies into the session.
8. Manager page (popup → "Manage all sessions"): rename/recolor/delete,
   Export/Import JSON.

## Known limitations / things to watch when testing

- **Site service workers — FIXED (was the #1 risk; reproduced on claude.ai).** A
  site's own SW issues requests with tabId == -1, which the per-tab DNR rule
  can't target, so a SW-driven SPA collapsed every session onto the shared
  profile once its worker took control (after the first reload). The storage
  shim now **disables service workers in managed tabs** (`disableServiceWorkers`
  in `entrypoints/storage-shim.content.ts`): it blocks registration and
  unregisters any worker from a prior unmanaged visit (with a one-shot reload),
  forcing all traffic through the tab-scoped path. Covered by `test/e2e-sw.mjs`.
  *Trade-off:* managed tabs lose SW features (offline cache, web push) — an
  acceptable cost for correct isolation. Unmanaged tabs keep their SW.
- **Set-Cookie capture vs strip ordering:** we both observe `Set-Cookie`
  (webRequest) and strip it (DNR). On Chrome the observer generally still sees
  the original; if captures are missed, verify ordering behavior.
- **DNR `tabIds` requires session-scoped rules** (we use `updateSessionRules`).
  Tab ids aren't stable across browser restart — fine, bindings are ephemeral.
- **Cookie header is computed coarsely** (whole domain jar, host = registrable
  domain). Subdomain-hostOnly cookies may be under/over-sent. OK for auth.
- **Storage shim is invasive:** sites that grab `localStorage`/`indexedDB`
  references before `document_start`, or rely on `indexedDB instanceof
  IDBFactory` internals, may misbehave. Shim fails safe to native storage.
- **Cross-origin SSO** (e.g. Google account for Gemini) isn't isolated by
  domain-scoped cookies.

## Suggested next steps (priority order)

1. **Manually spot-check the real AI sites** (the E2E already proves the
   mechanism — see "Testing"). Log into two accounts on ChatGPT/Claude in two
   sessions and watch for **service-worker cookie leakage** and cross-origin
   SSO, the cases the local-server E2E can't exercise.
2. ~~Add toolbar icons~~ ✅ done (see Status). Tweak the art in
   `scripts/gen-icons.mjs` if a different mark is wanted.
3. Consider re-asserting DNR rules / namespace on `webNavigation.onCommitted` if
   in-tab full navigations lose isolation (currently relies on persisted session
   rules + reserved sessionStorage key — verify it holds).
4. Edge cases: popup window targets (`window.open`), OAuth popups inheriting the
   parent tab's session, multiple tabs sharing one session.
5. (Future / "hybrid" path) optional true-proxy backend behind `SessionManager`
   for sites where header rewriting is insufficient.

## Environment note (why we moved)

Dev happened in WSL (`/home/anon/Repos/chrome-extension-session-switcher`) but
WSL had no native Linux Node — Node 22 was installed via nvm just to verify the
build. On Windows, use Windows Node directly (verified on Node 22.17.1). The
`scripts/*.sh` WSL/nvm helpers have since been removed.
```
