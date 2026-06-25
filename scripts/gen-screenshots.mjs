/**
 * Generates the Chrome Web Store marketing assets from the repo — no new deps.
 *
 * Reuses the same Chrome for Testing that the E2E suite resolves
 * (`resolveChrome` from test/harness.mjs) and the existing `puppeteer-core`
 * dependency. Each asset is an HTML "slide" styled with the real brand palette
 * (sampled from uno.config.ts) and the real captured UI (popup-shot.png /
 * manager-shot.png embedded as data URIs), then screenshotted at the exact
 * pixel size the store requires.
 *
 *   node scripts/gen-screenshots.mjs   →   store-assets/*.png
 *
 * Output (all PNG):
 *   screenshot-1-hero.png … screenshot-5-compat.png   1280×800  (store screenshots)
 *   promo-tile-440x280.png                              440×280  (small promo tile)
 *   marquee-1400x560.png                              1400×560  (marquee, optional)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveChrome } from '../test/harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'store-assets');

// ---- brand tokens (must match uno.config.ts / gen-icons.mjs) ---------------
const C = {
  bg: '#0e0f13', panel: '#15171e', line: '#2a2e3a',
  ink: '#e7e9ee', muted: '#9aa1b2',
  accent: '#6c8cff', success: '#46c98a', danger: '#ff7a7a',
  cyan: '#5cd0ff', purple: '#c98cff', amber: '#f5c451', orange: '#fb8c5a',
};

// ---- embed the real icon + UI captures as data URIs -----------------------
const dataUri = (rel) =>
  `data:image/png;base64,${readFileSync(resolve(ROOT, rel)).toString('base64')}`;
const ICON = dataUri('public/icon/128.png');
const POPUP = dataUri('popup-shot.png');
const MANAGER = dataUri('manager-shot.png');

// ---- shared building blocks -----------------------------------------------
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:${C.bg}}
  .slide{position:relative;overflow:hidden;color:${C.ink};
    font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;
    background:
      radial-gradient(1100px 620px at 80% -12%, rgba(108,140,255,.18), transparent 60%),
      radial-gradient(820px 520px at -5% 112%, rgba(201,140,255,.13), transparent 55%),
      linear-gradient(155deg,#0b0c11,#0e0f13 42%,#111320)}
  .pad{position:absolute;inset:0;display:flex}
  .brand{display:flex;align-items:center;gap:14px;margin-bottom:26px}
  .brand img{width:44px;height:44px;display:block}
  .brand b{font-size:22px;font-weight:700;letter-spacing:-.01em}
  .h{font-weight:800;letter-spacing:-.02em;line-height:1.07}
  .sub{color:${C.muted};line-height:1.45;font-weight:400}
  .accent{color:${C.accent}}
  .grad{background:linear-gradient(90deg,${C.accent},${C.purple});
    -webkit-background-clip:text;background-clip:text;color:transparent}
  .feat{list-style:none;display:flex;flex-direction:column;gap:14px;margin-top:30px}
  .feat li{display:flex;align-items:center;gap:12px;font-size:22px;color:${C.ink}}
  .ck{color:${C.success};font-weight:800;font-size:22px}
  .window{border:1px solid ${C.line};border-radius:16px;overflow:hidden;background:${C.bg};
    box-shadow:0 34px 90px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.02) inset}
  .titlebar{height:38px;display:flex;align-items:center;gap:8px;padding:0 14px;
    background:${C.panel};border-bottom:1px solid ${C.line}}
  .tl{width:11px;height:11px;border-radius:50%}
  .shotwrap{background:${C.bg}}
  .shot{width:100%;height:100%;display:block}
  .chips{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:960px}
  .chip{display:flex;align-items:center;gap:10px;padding:12px 20px;border:1px solid ${C.line};
    border-radius:999px;background:${C.panel};font-size:22px;font-weight:600}
  .chip .d{width:12px;height:12px;border-radius:50%}
`;

const mark = (size, name = true) =>
  `<div class="brand"><img src="${ICON}" style="width:${size}px;height:${size}px">` +
  (name ? `<b>Session Switcher</b>` : '') + `</div>`;

/** A framed "browser window" around a captured screenshot. */
const win = (src, { w, h, fit = 'contain' }) => `
  <div class="window" style="width:${w}px">
    <div class="titlebar">
      <span class="tl" style="background:${C.danger}"></span>
      <span class="tl" style="background:${C.amber}"></span>
      <span class="tl" style="background:${C.success}"></span>
    </div>
    <div class="shotwrap" style="height:${h}px">
      <img class="shot" src="${src}" style="object-fit:${fit};object-position:top center">
    </div>
  </div>`;

const page = (w, h, inner) =>
  `<!doctype html><meta charset="utf-8"><style>${CSS}</style>` +
  `<div class="slide" style="width:${w}px;height:${h}px">${inner}</div>`;

const SITES = [
  ['AI assistants', C.accent], ['Email & webmail', C.success], ['Social media', C.cyan],
  ['Dashboards', C.purple], ['Support desks', C.orange], ['Admin panels', C.ink],
  ['Dev tools', C.amber], ['Shopping carts', C.danger], ['Streaming', C.accent],
];

// ---- the assets -----------------------------------------------------------
const assets = [
  {
    file: 'screenshot-1-hero.png', w: 1280, h: 800,
    html: page(1280, 800, `
      <div class="pad" style="align-items:center;gap:70px;padding:0 90px">
        <div style="flex:1">
          ${mark(44)}
          <div class="h" style="font-size:60px">Stay logged into<br><span class="accent">multiple accounts</span><br>at the same time</div>
          <div class="sub" style="margin-top:22px;font-size:25px;max-width:520px">Run many logins on one site, side by side — each tab gets its own isolated cookies &amp; storage.</div>
        </div>
        <div style="flex:0 0 auto">${win(POPUP, { w: 400, h: 560, fit: 'contain' })}</div>
      </div>`),
  },
  {
    file: 'screenshot-2-oneclick.png', w: 1280, h: 800,
    html: page(1280, 800, `
      <div class="pad" style="align-items:center;gap:70px;padding:0 90px">
        <div style="flex:1">
          ${mark(44)}
          <div class="h" style="font-size:56px"><span class="accent">One click</span> opens any account in its own isolated tab</div>
          <ul class="feat">
            <li><span class="ck">✓</span> Create a session, hit Open, log in</li>
            <li><span class="ck">✓</span> It's remembered for next time</li>
            <li><span class="ck">✓</span> Your normal login is never touched</li>
          </ul>
        </div>
        <div style="flex:0 0 auto">${win(POPUP, { w: 400, h: 560, fit: 'contain' })}</div>
      </div>`),
  },
  {
    file: 'screenshot-3-isolation.png', w: 1280, h: 800,
    html: page(1280, 800, `
      <div class="pad" style="flex-direction:column;align-items:center;justify-content:center;padding:64px 60px;text-align:center">
        <div class="h" style="font-size:52px">Every session keeps its <span class="grad">own cookies &amp; storage</span></div>
        <div class="sub" style="margin-top:18px;font-size:24px;max-width:820px">Cookies, localStorage, sessionStorage &amp; IndexedDB — namespaced per session, so accounts never see each other.</div>
        <div style="margin-top:42px">${win(MANAGER, { w: 820, h: 408, fit: 'cover' })}</div>
      </div>`),
  },
  {
    file: 'screenshot-4-manage.png', w: 1280, h: 800,
    html: page(1280, 800, `
      <div class="pad" style="align-items:center;gap:64px;padding:0 90px">
        <div style="flex:1">
          ${mark(44)}
          <div class="h" style="font-size:54px"><span class="accent">Rename, color-code,</span> export &amp; import your sessions</div>
          <div class="sub" style="margin-top:20px;font-size:24px;max-width:480px">Organize every account in one place, and back them all up as a single JSON file.</div>
        </div>
        <div style="flex:0 0 auto">${win(MANAGER, { w: 580, h: 500, fit: 'cover' })}</div>
      </div>`),
  },
  {
    file: 'screenshot-5-compat.png', w: 1280, h: 800,
    html: page(1280, 800, `
      <div class="pad" style="flex-direction:column;align-items:center;justify-content:center;padding:70px;text-align:center">
        ${mark(52)}
        <div class="h" style="font-size:50px;max-width:980px">Works on <span class="grad">virtually any site</span><br>you log into</div>
        <div class="sub" style="margin:18px 0 40px;font-size:23px">From AI chats to email, dashboards &amp; support desks — any login-gated site.</div>
        <div class="chips">
          ${SITES.map(([n, c]) => `<span class="chip"><span class="d" style="background:${c}"></span>${n}</span>`).join('')}
          <span class="chip" style="border-style:dashed;color:${C.muted}">+ any site</span>
        </div>
      </div>`),
  },
  {
    file: 'promo-tile-440x280.png', w: 440, h: 280,
    html: page(440, 280, `
      <div class="pad" style="flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px">
        <img src="${ICON}" style="width:60px;height:60px;display:block">
        <div style="font-size:27px;font-weight:800;letter-spacing:-.01em;margin-top:14px">Session Switcher</div>
        <div class="sub" style="font-size:16px;margin-top:8px">Multiple accounts. One window.</div>
        <div class="sub" style="font-size:13px;margin-top:4px;color:${C.accent}">Isolated cookies &amp; storage per tab</div>
      </div>`),
  },
  {
    file: 'marquee-1400x560.png', w: 1400, h: 560,
    html: page(1400, 560, `
      <div class="pad" style="align-items:center;gap:80px;padding:0 100px">
        <div style="flex:1">
          ${mark(50)}
          <div class="h" style="font-size:58px">Run <span class="accent">multiple accounts</span><br>side by side — in one window</div>
          <div class="sub" style="margin-top:20px;font-size:24px;max-width:560px">Each tab gets its own isolated cookies &amp; storage. No profiles, no logging out.</div>
        </div>
        <div style="flex:0 0 auto">${win(POPUP, { w: 380, h: 470, fit: 'contain' })}</div>
      </div>`),
  },
];

// ---- render ----------------------------------------------------------------
async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: await resolveChrome(),
    headless: true,
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  try {
    for (const a of assets) {
      const p = await browser.newPage();
      await p.setViewport({ width: a.w, height: a.h, deviceScaleFactor: 1 });
      await p.setContent(a.html, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      const path = resolve(OUT, a.file);
      await p.screenshot({ path, type: 'png' });
      await p.close();
      console.log(`  store-assets/${a.file}  (${a.w}×${a.h})`);
    }
  } finally {
    await browser.close();
  }
  console.log('Marketing assets generated → store-assets/');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
