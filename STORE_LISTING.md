# Chrome Web Store — Publishing & SEO Kit

Everything needed to publish **Session Switcher** on the Chrome Web Store, with
copy that's ready to paste and tuned for maximum search visibility.

> The displayed store name, summary, and icon come **from the extension's
> manifest** (here: [`wxt.config.ts`](wxt.config.ts) → `manifest`), not just the
> dashboard. To change the public name/summary you edit the manifest and upload a
> new build. Where a field is dashboard-only, it's flagged below.

---

## Table of contents

1. [Pre-flight checklist](#0-pre-flight-checklist)
2. [Field-by-field cheat sheet](#field-by-field-cheat-sheet)
3. [Store name (title)](#1-store-name-title)
4. [Summary (short description)](#2-summary-short-description)
5. [Detailed description](#3-detailed-description-paste-as-is)
6. [Category, language & URLs](#4-category-language--urls)
7. [SEO & visibility strategy](#5-seo--visibility-strategy)
8. [Graphic assets](#6-graphic-assets)
9. [Privacy, permissions & data disclosures](#7-privacy-permissions--data-disclosures)
10. [Privacy policy (hostable text)](#8-privacy-policy)
11. [Build & package](#9-build--package)
12. [Submit (step by step)](#10-submit-step-by-step)
13. [Post-launch growth](#11-post-launch-growth)
14. [Avoiding rejection](#12-avoiding-rejection)

---

## 0. Pre-flight checklist

Tick every box before you open the dashboard.

- [ ] **$5 developer account** registered & email verified (one-time fee).
- [ ] **Version bumped** to `1.0.0` in [`package.json`](package.json) (WXT reads it).
- [ ] **`npm run compile`** passes (type-check clean).
- [ ] **`npm test`** passes (unit + integration).
- [ ] **`npm run test:e2e`** passes (real-Chrome isolation proof). *Don't ship on a green build alone — prove it runs.*
- [ ] **`npm run zip`** produced a package in `.output/`.
- [ ] **Store name** decided & set in [`wxt.config.ts`](wxt.config.ts) (see §1).
- [ ] **Summary** ≤132 chars set (see §2).
- [ ] **Assets generated** — `node scripts/gen-screenshots.mjs` → `store-assets/` (5 screenshots @1280×800, 440×280 tile, 1400×560 marquee). See §6.
- [ ] **Privacy policy** hosted at a public URL (see §8).
- [ ] **Permission justifications** copied in (see §7).
- [ ] **Data-use disclosures** answered (see §7).

---

## Field-by-field cheat sheet

| Dashboard field | Source / where to get it | Limit |
|---|---|---|
| Item name (title) | Manifest `name` → §1 | 75 chars (≈45 visible) |
| Summary | Manifest `description` / dashboard → §2 | 132 chars |
| Description | §3 (paste block) | 16,000 chars |
| Category | §4 → **Productivity** | pick 1 |
| Language | §4 → English | — |
| Store icon | `public/icon/128.png` | 128×128 PNG |
| Screenshots | `store-assets/screenshot-*.png` (generated) | 1280×800, 1–5 |
| Small promo tile | `store-assets/promo-tile-440x280.png` (generated) | 440×280 PNG |
| Marquee promo tile | `store-assets/marquee-1400x560.png` (generated) | 1400×560 PNG |
| Single purpose | §7 | — |
| Permission justifications | §7 (one per permission) | — |
| Host permission justification | §7 | — |
| Remote code | §7 → **No** | — |
| Data usage | §7 | — |
| Privacy policy URL | §8 (host it) | URL |

---

## 1. Store name (title)

The name is the **single strongest ranking signal** on the Web Store. It's the
manifest `name`, so set it in [`wxt.config.ts`](wxt.config.ts):

```ts
// wxt.config.ts → manifest
name: 'Session Switcher – Multi-Account Login & Container Tabs',
```

**Recommended (safe + keyword-rich), 55 chars:**

```
Session Switcher – Multi-Account Login & Container Tabs
```

Why this one: it leads with your brand, then packs the three terms people
actually search — *multi-account*, *login*, *container tabs* — without using any
other company's trademark in the title (see the ⚠️ note below).

**Alternatives:**

| Option | Chars | Trade-off |
|---|---|---|
| `Session Switcher – Multi-Account Login & Container Tabs` ✅ | 55 | Best balance; trademark-safe. |
| `Session Switcher – Multiple Accounts for AI & Any Site` | 54 | "AI" instead of brand names; still safe. |
| `Session Switcher – Multiple Accounts for ChatGPT, Claude & More` | 62 | Highest search intent **but** ⚠️ higher rejection/trademark risk. |
| `Session Switcher` | 16 | Cleanest, weakest for search. |

> ⚠️ **Trademark caution.** Chrome regularly removes extensions that put
> "ChatGPT", "Claude", "Gemini", etc. in the **name** (implied affiliation /
> trademark policy). Keep brand names **out of the title** and use them
> descriptively in the **description and screenshots** ("Works on ChatGPT,
> Claude…") — that captures the search traffic with far less risk.

Keep `short_name` as a punchy fallback used in tight UI:

```ts
short_name: 'Sessions',
```

---

## 2. Summary (short description)

132-char max. Shows in **search results** and social shares — it's your ad. Pack
the top keyword (`multiple accounts`) in the first few words.

**Recommended (120 chars):**

```
Run multiple accounts side by side in one window — each tab gets isolated cookies & storage. ChatGPT, Claude & any site.
```

**Alternatives:**

```
Stay logged into multiple accounts on the same site at once. Isolated cookies & storage per tab. Beat rate limits.
```
```
Multi-account container tabs for Chrome. Run many logins on one site at once — isolated cookies & storage per tab.
```

Keep the manifest `description` aligned with whichever you pick (it pre-fills the
summary), then fine-tune in the dashboard if needed.

---

## 3. Detailed description (paste as-is)

The Web Store renders this as **plain text** (no Markdown/HTML) but keeps line
breaks. The opening ~3 lines show before "Read more" — they carry the most SEO
and conversion weight, so keywords are front-loaded. Paste everything in the
block verbatim:

```text
Run many accounts at once — in ONE Chrome window.

Session Switcher gives every tab its own isolated login, so you can stay signed into multiple accounts on the same website at the same time. No logging out, no incognito juggling, no separate Chrome profiles. It's like Firefox Container Tabs / Multi-Account Containers, built for Chrome.

★ PERFECT FOR
• Running multiple ChatGPT, Claude, Gemini, Perplexity or Grok accounts together
• Keeping work and personal logins on the same site open side by side
• Freelancers & agencies juggling many client accounts at once
• Testing web apps as different users (QA, dev, support)
• Anyone hitting "you're sending messages too fast" rate limits

★ HOW IT WORKS
1. Click the toolbar icon on any site.
2. Create a session (e.g. "Work") and hit Open — a fresh, isolated tab opens.
3. Log in like normal. That account is now remembered for that session.
4. Create more sessions and open each one — they ALL stay logged in at the same time.

Every session keeps its OWN:
✓ Cookies — a separate cookie jar per session
✓ localStorage, sessionStorage & IndexedDB
✓ Login state — sessions never see each other

★ WHY IT'S DIFFERENT
• True per-tab isolation — not a cookie cleaner and not a quick log-out / log-in switcher.
• Your normal browsing stays untouched. Logging into a session never changes your regular login on that site.
• One window, many identities — no extra Chrome profiles to set up or switch between.
• Rename, color-code, and export / import all your sessions as a JSON backup.

★ WORKS EVERYWHERE
Built and tested for AI tools — Claude, ChatGPT, Gemini, Perplexity, Grok, Poe, Copilot, DeepSeek, Mistral, Hugging Face — and works on virtually any login-gated site: social media, email, dashboards, support desks, and more.

★ PRIVACY FIRST
• 100% local. Your sessions and cookies are stored only on your own device.
• No account, no sign-up, no analytics, no tracking, no servers — nothing ever leaves your browser.
• Open source.

★ GOOD TO KNOW
Session Switcher separates identities for convenience; it is not a security sandbox. To keep isolation airtight, managed tabs disable the site's service worker, so those tabs skip that site's offline cache and web push. Works on Chromium browsers only: Chrome, Edge, Brave, Opera, and Arc.

Keywords: multiple accounts, multi account, account switcher, multi login, multi-session, container tabs, multi-account containers, separate cookies, multiple logins same site, profile switcher, multiple ChatGPT accounts, multiple Claude accounts.
```

> The trailing "Keywords:" line is optional. It modestly helps in-store search
> matching; remove it if you prefer a cleaner listing — it does not help Google
> web search and some find it spammy.

---

## 4. Category, language & URLs

- **Category:** **Productivity** — highest-traffic fit for a multi-account/login
  tool. (Alternatives: *Tools*, *Developer Tools* — lower traffic.)
- **Language:** English (United States). Add more locales later to widen reach.
- **Homepage / website URL:** your GitHub repo.
- **Support URL:** GitHub Issues page (or the same repo).
- **Mature content:** No.

---

## 5. SEO & visibility strategy

Web Store ranking is driven, in rough order, by: **keyword match in the name** →
**install count** → **ratings (average + volume)** → **retention** →
**freshness (recent updates)**. Optimize all five.

### Target keywords

**Primary (high intent):**
`multiple accounts` · `multi account` · `account switcher` · `multi login` ·
`session switcher` · `container tabs` · `multiple logins same site`

**Secondary (long-tail, high conversion):**
`multiple ChatGPT accounts` · `multiple Claude accounts` · `multi account containers chrome` ·
`separate cookies per tab` · `multiple gmail logins` · `bypass rate limit` ·
`switch accounts without logging out` · `multi-session browser`

### Where to place them (in priority order)

1. **Name** — one or two primary keywords (done in §1).
2. **Summary** — lead with `multiple accounts` (done in §2).
3. **First 3 lines of the description** — these preview in search/cards.
4. **Screenshot captions** — bake keyword headlines into the images (§6); the
   store can't read them but humans scan them, lifting click-through → installs.
5. **Body of the description** — natural repetition, not stuffing.

### The levers that actually move rank (beyond text)

- **Ratings are the #1 post-keyword lever.** Ask your first happy users to rate.
  Even 10–20 reviews dramatically outrank a 0-review listing.
- **Installs + retention.** A clear listing → more installs that *stay* → higher
  rank. Conversion (good screenshots) feeds ranking indirectly.
- **Freshness.** Ship small updates periodically; recently-updated items get a
  bump and look maintained.
- **Featured badge** (editorial, not earnable directly) favors: Manifest V3 (✓
  you're MV3), minimal well-justified permissions, polished UX, accurate listing,
  and an active maintenance cadence. Following this whole kit maximizes the odds.

### Off-store amplification (drives the installs that drive rank)

- Add a Web Store badge + direct install link to your GitHub README.
- **Show HN** / Hacker News, **Product Hunt** launch.
- Subreddits: r/chrome_extensions, r/ChatGPT, r/ClaudeAI, r/productivity (read
  each sub's self-promo rules first).
- A 20–30s demo GIF/video (also embeddable in the listing, see §6).

---

## 6. Graphic assets

### Brand palette (sampled from the real UI — [`uno.config.ts`](uno.config.ts))

Use these so promo art matches the product exactly:

| Token | Hex | Use |
|---|---|---|
| Background | `#0e0f13` | Canvas behind screenshots |
| Panel | `#15171e` | Cards |
| Text (ink) | `#e7e9ee` | Headlines |
| Muted | `#9aa1b2` | Subtext |
| Accent (blue) | `#6c8cff` | Primary / CTA |
| Success (green) | `#46c98a` | "Logged in" |
| Danger | `#ff7a7a` | Destructive |
| Icon cyan | `#5cd0ff` | Brand mark |
| Icon purple | `#c98cff` | Brand mark |

The logo mark is the three overlapping circles (cyan / purple / accent-blue) —
the same colored-dot motif sessions use.

### Generate them all from the repo (no new deps)

```bash
node scripts/gen-screenshots.mjs      # → store-assets/*.png
```

[`scripts/gen-screenshots.mjs`](scripts/gen-screenshots.mjs) renders every asset
below by styling HTML slides with the real brand palette and the real captured UI
([`popup-shot.png`](popup-shot.png) / [`manager-shot.png`](manager-shot.png)
embedded), then screenshotting at the exact pixel size with the same Chrome for
Testing the E2E suite uses (reuses `puppeteer-core` — nothing new to install).
Re-run it any time you tweak the captures or copy.

### Required & recommended sizes

| Asset | Size | Format | Status |
|---|---|---|---|
| Store icon | 128×128 | PNG | ✅ `public/icon/128.png` |
| Screenshots ×5 | **1280×800** | PNG | ✅ `store-assets/screenshot-1…5-*.png` |
| Small promo tile | 440×280 | PNG | ✅ `store-assets/promo-tile-440x280.png` |
| Marquee promo tile | 1400×560 | PNG | ✅ `store-assets/marquee-1400x560.png` |
| Promo video | YouTube URL | — | optional, high impact |

### The 5 generated screenshots (upload in this order)

The **first** screenshot is the most important — it's the clearest value shot.

| # | File | Caption baked in |
|---|---|---|
| 1 | `screenshot-1-hero.png` | Stay logged into multiple accounts at the same time |
| 2 | `screenshot-2-oneclick.png` | One click opens any account in its own isolated tab |
| 3 | `screenshot-3-isolation.png` | Every session keeps its own cookies & storage |
| 4 | `screenshot-4-manage.png` | Rename, color-code, export & import your sessions |
| 5 | `screenshot-5-compat.png` | Works on ChatGPT, Claude, Gemini & any site |

To restyle: edit the `assets` array / `CSS` in the script and re-run. Concepts:

1. **"Stay logged into multiple accounts — at the same time"**
   The popup ([`popup-shot.png`](popup-shot.png)) showing Work / Personal / Client
   sessions with green "Logged in" states. This is your hero — put it first.
2. **"One click opens any account in its own isolated tab"**
   Popup with the Open / Use-here actions highlighted.
3. **"Every session keeps its own cookies & storage"**
   The manager page ([`manager-shot.png`](manager-shot.png)) with the cookie
   counts and color dots.
4. **"Rename, color-code, export & import your sessions"**
   Manager page focused on the rename field + Export / Import buttons.
5. **"Works on ChatGPT, Claude, Gemini, Perplexity & any site"**
   A montage of two real AI tabs side by side, each a different account.

Tips: large headline (≈48–64px) in `#e7e9ee` on `#0e0f13`, one idea per image,
keep UI screenshots crisp at 100%, leave breathing room — they're shown small.

---

## 7. Privacy, permissions & data disclosures

This is where broad-permission extensions get held up. The justifications below
match exactly what the code does, so they'll survive review. Paste each into its
matching box in the **Privacy practices** tab.

### Single purpose (paste)

```text
Session Switcher lets users run multiple isolated logins on the same website at the same time, by giving each managed tab its own cookie jar and its own web-storage namespace (localStorage, sessionStorage, IndexedDB).
```

### Per-permission justifications (paste, one each)

**`declarativeNetRequest`**
```text
Installs one per-tab rule that rewrites the outgoing Cookie header to the active session's cookies and strips incoming Set-Cookie headers, so each tab stays logged into its own account without writing to the shared browser profile. This is the core isolation mechanism.
```

**`webRequest`**
```text
Read-only observation of Set-Cookie response headers (via extraHeaders) so the extension can keep each session's local cookie jar up to date after the user logs in. It does NOT block or modify requests and does not use webRequestBlocking.
```

**`storage`**
```text
Persists the user's saved sessions and their cookie jars locally on the device so sessions survive browser restarts.
```

**`unlimitedStorage`**
```text
A user with many sessions can accumulate cookie jars and session snapshots that exceed the default storage quota; this permission prevents data loss for power users.
```

**`tabs`**
```text
Reads the active tab's site to show the sessions relevant to it, and opens new tabs that are bound to a chosen session.
```

**`scripting`**
```text
Clears the per-tab session marker from a tab's storage when the user detaches that tab from a session, returning it to normal browsing.
```

**`cookies`**
```text
Powers the optional one-time "Adopt browser login": it copies the user's existing real cookies for the current site into a new session so they don't have to re-authenticate the first account. It only fills missing cookies and never transmits them anywhere.
```

### Host permission justification — `<all_urls>` (paste)

```text
The extension's purpose is to isolate logins on ANY website the user chooses, so it must be able to read Set-Cookie and rewrite the Cookie header across all sites. It only acts on tabs the user explicitly opens in a session; it does not read or collect data from other tabs, and no data is ever sent off the device.
```

### Remote code

**Answer: No** — *"No, I am not using remote code."* All logic (including the
MAIN-world storage shim) ships inside the package; nothing is fetched or `eval`'d
at runtime.

### Data usage disclosures

Session Switcher keeps all data **on the device** and transmits nothing, so in
the data-collection form:

- **Data collected/transmitted off the device: None.** (Cookies and storage are
  stored locally to function; they are never sent to the developer or any third
  party — that is not "collection" in the disclosure sense.)
- Check all three certifications:
  - ✅ I do not sell or transfer user data to third parties, apart from the approved use cases.
  - ✅ I do not use or transfer user data for purposes unrelated to my item's single purpose.
  - ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

> Be precise here: the extension *handles* authentication cookies locally, which
> is why a **privacy policy is required** (§8), but it does not *collect/transmit*
> them — so the disclosed collection is "none."

---

## 8. Privacy policy

A public privacy-policy URL is **required** (you handle authentication data). The
full text is saved alongside this file as [`PRIVACY.md`](PRIVACY.md).

**How to host it (pick one):**

- **GitHub Pages** — Settings → Pages → enable; policy at
  `https://<user>.github.io/<repo>/PRIVACY` (or convert to `privacy.html`).
- **Raw GitHub URL** — `https://raw.githubusercontent.com/<user>/<repo>/main/PRIVACY.md`
  (works, but a rendered page looks more legitimate to reviewers).
- **GitHub Gist** — paste the text, use the gist URL.

Paste that URL into the dashboard's **Privacy policy** field.

---

## 9. Build & package

```bash
npm run compile      # type-check — must be clean
npm test             # unit + integration — must pass
npm run test:e2e     # real-Chrome isolation proof — must pass
npm run zip          # → .output/<name>-<version>-chrome.zip
```

Before zipping, set the release version (WXT reads it from `package.json`):

```jsonc
// package.json
"version": "1.0.0",
```

Then upload the zip from `.output/`. Confirm it contains `manifest.json` and the
`icon/` PNGs (16/32/48/96/128 — all present in `public/icon/`).

---

## 10. Submit (step by step)

1. Go to the **Chrome Web Store Developer Dashboard** and register (one-time **$5**).
2. **Add new item** → upload the `.zip` from `.output/`.
3. **Store listing** tab: paste the name (§1 — or set it in the manifest and
   re-upload), summary (§2), description (§3); pick **Productivity** (§4); set
   language; add homepage/support URLs.
4. **Graphic assets:** upload the 128×128 icon, 1–5 screenshots (1280×800), the
   440×280 small tile, and (optional) the 1400×560 marquee.
5. **Privacy practices** tab: single purpose, each permission justification, host
   justification, "No remote code," data-use certifications, and the privacy
   policy URL (§7–§8).
6. **Save draft → Submit for review.**
7. **Review time:** often a few hours to a few business days. Broad host
   permissions (`<all_urls>`) + `webRequest` draw extra scrutiny and can push it
   to a week or more — the precise justifications in §7 are what keep it moving.
8. On approval it publishes (immediately, or on the date you schedule).

---

## 11. Post-launch growth

- **Seed reviews fast** — the biggest rank lever after keywords. Ask early users.
- **Add the install badge + link** to the GitHub README.
- **Launch posts:** Product Hunt, Show HN, relevant subreddits, X.
- **Ship updates** every few weeks for the freshness bump and a maintained look.
- **Watch the funnel** in the dashboard (impressions → installs → uninstalls) and
  iterate on the first screenshot + summary, which drive conversion.
- **Reply to every review**, especially critical ones — it lifts rating trends.

---

## 12. Avoiding rejection

- **No trademarks in the name** — keep ChatGPT/Claude/etc. in the description
  only (§1).
- **Permissions must match the listing** — every permission is justified in §7;
  don't add any you don't use.
- **Honest screenshots** — show the real UI; no fake "10,000 users" or fabricated
  praise.
- **Privacy policy URL must resolve** and actually describe the data handling.
- **`webRequest` is observe-only** — say so (it is, in §7); blocking webRequest
  in MV3 would be rejected.
- **Single, clear purpose** — the listing already reads as one focused tool; don't
  bolt on unrelated features.
- **Disclose the service-worker trade-off** (done in the description) so users
  aren't surprised — surprise drives 1-star reviews and policy complaints.
```
