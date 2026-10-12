# Session Switcher

Test **multiple user accounts side by side** in one browser window. Create
sessions such as Admin, Standard user, and Guest to compare roles and permissions
in your web application. Each managed tab uses a session's cookie jar and
`localStorage` / `sessionStorage` / IndexedDB namespace. Sessions are grouped by
site; cross-domain SSO and some browser storage mechanisms have limitations.

See [what changed](CHANGELOG.md) and the [manual QA checklist](docs/QA_RELEASE_CHECKLIST.md).

Chrome Web Store submission copy is split into paste-ready files in
[`store-listing/`](store-listing/), including the title, summary, description,
privacy and permission disclosures, screenshot captions, release notes, support
replies, SEO guidance, and the publication checklist.

Built with **WXT + Preact + UnoCSS**, TypeScript throughout, Manifest V3.

**[Project homepage](https://houtan-rocky.github.io/chrome-extension-session-switcher/)** Â· **[Chrome Web Store](https://chromewebstore.google.com/detail/session-switcher/ibleijinnlbhcpkgcccfmakidclplgga)** Â· **[Report an issue](https://github.com/houtan-rocky/chrome-extension-session-switcher/issues)**

**Browser support: Chromium only** â€” Chrome, Edge, Brave, Opera, Arc, and other
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

â†’ `lib/engine/dnr.ts`, `lib/engine/capture.ts`, `lib/engine/cookieJar.ts`

### 2. Per-session web-storage isolation (page layer)

A **MAIN-world content script at `document_start`** (`storage-shim.content.ts`)
runs before page scripts and:

- wraps `localStorage` / `sessionStorage` in a `Proxy` that **key-prefixes**
  every entry with `__ss:<sessionId>:` â€” real isolation inside the shared
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

> **Deep dive:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the full
> technical write-up â€” the cookie capture/inject loop, the storage shim,
> service-worker neutralization, the lifecycle of each operation, and a precise
> table of what is and isn't isolated.

---

## Using it

- Click the toolbar icon on your web app â†’ **Create session** (e.g. "Admin"),
  then **Open new tab** or **Use this tab** (reload the current tab into it).
- Log in normally. The session now remembers that account.
- Choose **Create another session**, name it "Standard user", open it, and log
  into the second account. Compare both users side by side.
- Sessions belong to a site/domain. After restarting the browser, reconnect
  restored tabs before using them: tab attachments and network rules reset.
- **Adopt browser login** (shown only while a bound session is *logged out*)
  seeds the session from your normal, non-isolated login for the site â€” a
  one-time bootstrap so you don't re-authenticate the first account. It only
  fills cookies the session is missing, so it never overwrites a session's own
  login (importing onto an already-logged-in session would merge identities).
- **Manage all sessions** (full page) for rename / recolor / delete and
  **export / import** a JSON backup of all sessions + jars.

---

## Develop

```bash
npm install         # also runs `wxt prepare` (generates .wxt/ types)
npm run dev         # launches Chrome with the extension + HMR
npm run build       # production build â†’ .output/chrome-mv3
npm run zip         # packaged zip for the Web Store
npm run compile     # type-check only (tsc --noEmit)
npm test            # unit + integration tests (Vitest)
npm run test:e2e    # end-to-end isolation test in real Chrome
```

### Tests

`npm test` runs the engine suite (cookie parsing, domain resolution, the
storage-namespace protocol, and the `SessionManager` against a faked `chrome`
API â€” including proof that two concurrent sessions stay separate).

`npm run test:e2e` loads the built extension into **real Chrome** and, using a
local fake-login server (no real accounts), verifies that two sessions stay
logged into different identities at once, that the browser's shared profile is
never touched, and that web storage is namespaced per session. It uses
[Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing)
because regular Chrome â‰¥137 ignores `--load-extension`; the harness installs it
on demand (or set `CHROME_PATH` to your own).

Load unpacked: `chrome://extensions` â†’ Developer mode â†’ **Load unpacked** â†’
select `.output/chrome-mv3`.

> **Icons:** the toolbar icons live at `public/icon/{16,32,48,96,128}.png` and
> WXT wires them into the manifest automatically. They're generated (no image
> deps) by `node scripts/gen-icons.mjs` â€” edit that script to change the mark.

---

## Honest limitations

- **Site service workers (handled).** A site's own service worker makes requests
  with no tab id, so the per-tab cookie rule can't target them â€” left alone, a
  SW-driven site would leak every session onto the shared profile. To prevent
  this, **managed tabs disable service workers** (registration is blocked and
  any existing worker is unregistered). The cost: managed tabs don't get that
  site's offline cache or web push. Unmanaged tabs are unaffected.
- **Cross-origin SSO.** Logins that depend on a *separate* identity provider
  (e.g. a federated Google/Microsoft login) aren't isolated by domain-scoped
  cookies and may behave inconsistently.
- **Storage shim is best-effort.** Overriding `localStorage`/`indexedDB` is
  inherently invasive; a site that captures references before `document_start`,
  or relies on `indexedDB instanceof IDBFactory` internals, may misbehave. The
  shim fails safe (native storage) rather than breaking the page.
- **Path-scoped cookies** are sent coarsely (whole domain jar per request) since
  the goal is identity isolation, not byte-exact cookie semantics.
- **Shared quota.** Key-prefixing means all sessions on one origin share that
  origin's `localStorage` quota.

