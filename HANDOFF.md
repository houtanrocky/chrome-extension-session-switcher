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
- ✅ `npm run compile` (tsc --noEmit) passes with **zero errors**.
- ✅ `npm run build` succeeds → `.output/chrome-mv3` (~59 kB total).
- ✅ Generated `manifest.json` verified: MV3, correct permissions, and the
  storage shim is registered with `"world": "MAIN"`, `"run_at": "document_start"`,
  `"all_frames": true`.
- ⛔ **Not yet loaded/tested in a real Chrome browser.** This is the #1 next step.
- ⛔ No toolbar icons yet (build works without them; default icon used).

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
scripts/*.sh                         WSL-only nvm/build helpers — DELETE on Windows, not part of the extension
README.md                            user-facing docs
HANDOFF.md                           this file
```

## Build & test (on Windows)

```powershell
cd <repo>
npm install          # runs wxt prepare (postinstall)
npm run compile      # type-check (must stay clean)
npm run dev          # launches Chrome with HMR — easiest for testing
# or
npm run build        # -> .output/chrome-mv3 ; load unpacked in chrome://extensions
```

Delete the `scripts/` folder — those are WSL/nvm helpers only.

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

- **Site service workers:** a site's own SW issues requests with tabId == -1, so
  the per-tab DNR rule can't target them → those may use the shared profile.
  This is the most likely real-world breakage on heavy SPAs. Watch for it on
  ChatGPT/Claude; if auth leaks, this is why.
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

1. **Load in real Chrome and run the manual test plan.** Fix whatever breaks —
   especially service-worker cookie leakage on the target AI sites.
2. Add toolbar icons: `public/icon/{16,32,48,96,128}.png` (WXT auto-wires).
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
build. On Windows, use Windows Node directly. The `scripts/*.sh` helpers exist
only to bridge the WSL/nvm gap and are safe to delete.
```
