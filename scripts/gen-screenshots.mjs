/**
 * Generate editable Chrome Web Store assets from the real extension captures.
 *
 * The surrounding browser and demo pages are HTML/CSS so the copy, fictional
 * data, layout, and colors can be changed without an image editor. The popup
 * and manager panels are rendered by the built extension via test/shot.mjs and
 * embedded here as the actual UI screenshots.
 *
 *   npm run build
 *   node test/shot.mjs
 *   node test/shot.mjs guide
 *   node test/shot.mjs empty
 *   node test/shot.mjs manager
 *   node scripts/gen-screenshots.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveChrome } from '../test/harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'store-assets');

const C = {
  bg: '#0e0f13', panel: '#15171e', panel2: '#1d2029', line: '#2a2e3a',
  ink: '#e7e9ee', muted: '#9aa1b2', faint: '#6b7280', accent: '#6c8cff',
  success: '#46c98a', danger: '#ff7a7a', cyan: '#5cd0ff', purple: '#c98cff',
  amber: '#f5c451', orange: '#ff8f6c',
};

const dataUri = (rel) => `data:image/png;base64,${readFileSync(resolve(ROOT, rel)).toString('base64')}`;
const ICON = dataUri('public/icon/128.png');
const POPUP = dataUri('popup-shot.png');
const GUIDE = dataUri('popup-guide-shot.png');
const EMPTY = dataUri('popup-empty-shot.png');
const MANAGER = dataUri('manager-shot.png');

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:${C.bg}}
  .slide{position:relative;overflow:hidden;color:${C.ink};font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(980px 600px at 90% -12%,rgba(108,140,255,.15),transparent 62%),radial-gradient(820px 520px at -8% 112%,rgba(201,140,255,.11),transparent 58%),${C.bg}}
  .h{font-weight:800;letter-spacing:-.025em;line-height:1.06}.sub{color:${C.muted};line-height:1.45}.accent{color:${C.accent}}.grad{background:linear-gradient(90deg,${C.accent},${C.purple});-webkit-background-clip:text;background-clip:text;color:transparent}
  .brand{display:flex;align-items:center;gap:12px}.brand img{display:block}.brand b{font-size:20px;letter-spacing:-.01em}
  .browser{overflow:hidden;border:1px solid ${C.line};border-radius:14px;background:#0b0c10;box-shadow:0 26px 70px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.02) inset}
  .tabbar{height:35px;display:flex;align-items:flex-end;gap:5px;padding:0 10px;background:#181a22;border-bottom:1px solid ${C.line}}
  .tab{height:28px;display:flex;align-items:center;gap:7px;padding:0 12px;border-radius:8px 8px 0 0;background:#252936;color:${C.ink};font-size:11px;min-width:150px}.tab i{width:8px;height:8px;border-radius:50%;background:${C.accent}}
  .tab.dim{background:transparent;color:${C.faint}}.tab.dim i{background:${C.faint}}
  .toolbar{height:34px;display:flex;align-items:center;gap:8px;padding:0 12px;background:#111319;color:${C.faint};font-size:10px}.nav{display:flex;gap:7px;font-size:13px}.address{height:22px;display:flex;align-items:center;flex:1;padding:0 10px;border:1px solid #292d38;border-radius:999px;background:#0b0c10;color:${C.muted};font-size:10px}.lock{color:${C.success}}
  .site{height:100%;padding:22px 24px;background:#f6f8fb;color:#1b2230;font-family:"Segoe UI",system-ui,sans-serif}.site.dark{background:#10141c;color:#e7e9ee}.site-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid #dde2ea}.site.dark .site-head{border-color:#28303d}.site-title{font-weight:750;font-size:18px;letter-spacing:-.02em}.site-nav{display:flex;gap:18px;color:#788395;font-size:11px}.site.dark .site-nav{color:#9aa1b2}.user-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;background:#e8edf5;font-size:11px;font-weight:650}.site.dark .user-pill{background:#1d2430}.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.site-content{padding-top:20px}.eyebrow{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#738096;font-weight:700}.site.dark .eyebrow{color:#8e9bb0}.site h3{font-size:21px;line-height:1.1;margin-top:7px;letter-spacing:-.02em}.site p{font-size:11px;color:#738096;line-height:1.5;margin-top:7px}.site.dark p{color:#9aa1b2}.metric-row{display:flex;gap:10px;margin-top:18px}.metric{flex:1;padding:12px;border:1px solid #dfe5ee;border-radius:10px;background:white}.site.dark .metric{border-color:#2b3545;background:#161d27}.metric strong{font-size:20px;display:block}.metric span{font-size:10px;color:#738096}.site.dark .metric span{color:#9aa1b2}.result{margin-top:18px;padding:12px 13px;border:1px solid #dfe5ee;border-radius:10px;background:white}.site.dark .result{border-color:#2b3545;background:#161d27}.result-head{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:700}.result-row{display:flex;align-items:center;justify-content:space-between;padding-top:10px;font-size:11px;color:#576276}.site.dark .result-row{color:#aab4c4}.ok{color:${C.success};font-weight:700}.warn{color:${C.amber};font-weight:700}
  .panel{border:1px solid ${C.line};border-radius:12px;background:${C.panel}}.callout{display:flex;gap:10px;align-items:flex-start;padding:13px 14px;border:1px solid ${C.line};border-radius:10px;background:rgba(255,255,255,.025)}.callout .ico{width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:#232a3b;color:${C.accent};font-weight:800}.callout b{font-size:13px}.callout span{display:block;color:${C.muted};font-size:11px;line-height:1.45;margin-top:3px}
  .popup{overflow:hidden;border:1px solid ${C.line};border-radius:12px;background:${C.bg};box-shadow:0 28px 80px rgba(0,0,0,.62)}.popup img{display:block;width:100%;height:100%;object-fit:cover;object-position:left top}.caption{font-size:11px;color:${C.faint};letter-spacing:.01em}
  .lim{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:28px}.lim .item{padding:15px;border:1px solid ${C.line};border-radius:11px;background:${C.panel}}.lim b{display:block;font-size:14px}.lim span{display:block;color:${C.muted};font-size:12px;line-height:1.45;margin-top:5px}
`;

const page = (w, h, inner) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="slide" style="width:${w}px;height:${h}px">${inner}</div>`;
const mark = (size = 40) => `<div class="brand"><img src="${ICON}" style="width:${size}px;height:${size}px"><b>Session Switcher</b></div>`;
const browser = (inner, { w, h, tabs = ['Teamboard'] } = {}) => `<div class="browser" style="width:${w}px;height:${h}px"><div class="tabbar">${tabs.map((t, i) => `<div class="tab ${i ? 'dim' : ''}"><i></i>${t}</div>`).join('')}</div><div class="toolbar"><span class="nav">‹ › ↻</span><div class="address"><span class="lock">●</span>&nbsp; teamboard.test</div><span>☆</span><span>⋮</span></div><div style="height:calc(100% - 69px)">${inner}</div></div>`;
const popup = (src, style = '') => `<div class="popup" style="${style}"><img src="${src}"></div>`;
const dot = (color) => `<span class="dot" style="background:${color}"></span>`;

const appPage = (role, color, mode = 'light') => `<div class="site ${mode === 'dark' ? 'dark' : ''}"><div class="site-head"><div><div class="site-title">Teamboard</div><div class="site-nav"><span>Overview</span><span>Projects</span><span>Reports</span></div></div><div class="user-pill">${dot(color)} ${role}</div></div><div class="site-content"><div class="eyebrow">Workspace overview</div><h3>${role} view</h3><p>Fictional test data for comparing the same product with a different signed-in account.</p><div class="metric-row"><div class="metric"><strong>${role === 'Admin' ? '18' : '7'}</strong><span>open tasks</span></div><div class="metric"><strong>${role === 'Admin' ? '6' : '2'}</strong><span>team members</span></div></div><div class="result"><div class="result-head"><span>Access check</span><span class="ok">✓ passed</span></div><div class="result-row"><span>Billing settings</span><span class="${role === 'Admin' ? 'ok' : 'warn'}">${role === 'Admin' ? 'visible' : 'hidden'}</span></div><div class="result-row"><span>Project export</span><span class="${role === 'Admin' ? 'ok' : 'warn'}">${role === 'Admin' ? 'allowed' : 'review'}</span></div></div></div></div>`;

const assets = [
  {
    file: 'screenshot-1-hero.png', w: 1280, h: 800,
    html: page(1280, 800, `<div style="padding:58px 70px 48px"><div style="display:flex;align-items:flex-end;justify-content:space-between"><div>${mark(40)}<div class="h" style="font-size:47px;margin-top:26px">Compare two users<br><span class="accent">side by side</span></div><div class="sub" style="font-size:19px;margin-top:14px;max-width:530px">Keep separate logins on the same site and see each account’s view at a glance.</div></div><div class="caption">Same site · separate sessions</div></div><div style="display:flex;gap:16px;margin-top:34px;position:relative"><div style="flex:1">${browser(appPage('Admin', C.accent), { w: 480, h: 410, tabs: ['Teamboard · Admin', 'Teamboard'] })}<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0 4px;font-size:12px;color:${C.muted}">${dot(C.accent)} Admin session <span style="color:${C.success};margin-left:4px">● 24 saved cookies</span></div></div><div style="flex:1">${browser(appPage('Standard user', C.success), { w: 480, h: 410, tabs: ['Teamboard · Standard', 'Teamboard'] })}<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0 4px;font-size:12px;color:${C.muted}">${dot(C.success)} Standard user session <span style="color:${C.success};margin-left:4px">● 11 saved cookies</span></div></div><div style="position:absolute;right:-2px;bottom:-4px;width:246px;height:344px;transform:translateY(20px)">${popup(POPUP)}</div></div></div>`),
  },
  {
    file: 'screenshot-2-oneclick.png', w: 1280, h: 800,
    html: page(1280, 800, `<div style="display:flex;align-items:center;gap:46px;padding:58px 76px"><div style="flex:1;max-width:540px">${mark(40)}<div class="h" style="font-size:49px;margin-top:28px">Create a session,<br><span class="accent">open it, log in</span></div><div class="sub" style="font-size:19px;margin-top:16px">The first-use guide keeps the setup clear. Name a session, choose a tab action, and sign in with the account you want to keep separate.</div><div style="display:flex;flex-direction:column;gap:12px;margin-top:28px"><div class="callout"><div class="ico">1</div><div><b>Create session</b><span>Give the account a name such as Admin or Standard user.</span></div></div><div class="callout"><div class="ico">2</div><div><b>Use this tab or Open new tab</b><span>Pick the tab action that fits your current workflow.</span></div></div><div class="callout"><div class="ico">3</div><div><b>Log in once</b><span>The session stays available for the next visit.</span></div></div></div></div><div style="width:420px;position:relative">${browser(`<div class="site dark" style="padding:24px"><div class="site-title">Teamboard</div><div class="site-content"><div class="eyebrow">Sign in to continue</div><h3>Choose your workspace account</h3><p>Use the Session Switcher panel to keep this login separate.</p><div class="result" style="margin-top:22px"><div class="result-head"><span>Account</span><span class="ok">ready</span></div><div class="result-row"><span>Admin</span><span>••••••</span></div></div></div></div>`, { w: 420, h: 470, tabs: ['Teamboard · Sign in'] })}<div style="position:absolute;right:-26px;top:66px;width:264px;height:360px">${popup(GUIDE)}</div><div style="position:absolute;right:178px;bottom:-30px;width:170px;height:174px;transform:rotate(-2deg)">${popup(EMPTY)}</div></div></div>`),
  },
  {
    file: 'screenshot-3-isolation.png', w: 1280, h: 800,
    html: page(1280, 800, `<div style="padding:60px 76px">${mark(40)}<div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:25px"><div><div class="h" style="font-size:47px">Each account gets its<br><span class="grad">own view and storage</span></div><div class="sub" style="font-size:19px;margin-top:14px;max-width:580px">A fictional QA page makes the difference easy to verify: the same Teamboard project reports two independent signed-in users.</div></div><div class="caption">No real provider branding or customer data</div></div><div style="display:flex;gap:18px;margin-top:36px"><div style="flex:1">${browser(appPage('Admin', C.accent, 'dark'), { w: 535, h: 390, tabs: ['QA report · Admin'] })}</div><div style="flex:1">${browser(appPage('Standard user', C.success, 'dark'), { w: 535, h: 390, tabs: ['QA report · Standard', 'QA report'] })}</div></div><div style="display:flex;justify-content:center;gap:26px;margin-top:23px;color:${C.muted};font-size:13px"><span>${dot(C.accent)} Admin sees billing and exports</span><span>${dot(C.success)} Standard user sees assigned work</span><span style="color:${C.success}">✓ Independent cookies + storage</span></div></div>`),
  },
  {
    file: 'screenshot-4-manage.png', w: 1280, h: 800,
    html: page(1280, 800, `<div style="display:flex;gap:42px;padding:56px 64px"><div style="width:400px;flex:0 0 400px">${mark(40)}<div class="h" style="font-size:45px;margin-top:24px"><span class="accent">Organize</span> every account<br>in one place</div><div class="sub" style="font-size:18px;margin-top:12px">Sessions stay named, color-coded, grouped by site, and ready to export for a local backup.</div><div class="callout" style="margin-top:26px"><div class="ico">✓</div><div><b>Admin · Standard user · Guest</b><span>Teamboard sessions grouped together with cookie counts.</span></div></div></div><div style="flex:1;padding-top:2px"><div class="caption" style="margin:0 0 8px 4px">Session manager · 3 sessions · 35 cookies</div>${browser(`<div style="height:100%;background:${C.bg};display:flex;align-items:flex-start;justify-content:center">${popup(MANAGER, 'width:100%;height:100%;border:0;border-radius:0;box-shadow:none')}</div>`, { w: 700, h: 660, tabs: ['Session Switcher · Manager'] })}</div></div>`),
  },
  {
    file: 'screenshot-5-compat.png', w: 1280, h: 800,
    html: page(1280, 800, `<div style="padding:66px 92px">${mark(42)}<div class="h" style="font-size:48px;margin-top:28px">Know the <span class="grad">session boundaries</span></div><div class="sub" style="font-size:19px;max-width:760px;margin-top:14px">Session Switcher is a local convenience layer for supported Chromium browsers. These notes help you choose the right workflow.</div><div class="lim"><div class="item"><b>${dot(C.accent)} Chromium browsers</b><span>Works with Chrome, Edge, Brave, Opera, and Arc.</span></div><div class="item"><b>${dot(C.amber)} Reconnect after restart</b><span>Use the session controls to reconnect restored tabs after a browser restart.</span></div><div class="item"><b>${dot(C.purple)} Cross-domain SSO</b><span>Identity-provider flows that cross domains may behave differently.</span></div><div class="item"><b>${dot(C.orange)} Offline and push behavior</b><span>Managed tabs may affect new service-worker registrations, offline cache, or web push.</span></div></div><div style="display:flex;align-items:center;gap:18px;margin-top:34px"><div style="width:190px;height:182px">${popup(POPUP)}</div><div class="panel" style="padding:16px 18px;max-width:630px"><b style="font-size:14px">Local by design</b><div class="sub" style="font-size:13px;margin-top:5px">Session data and captured cookies stay in extension storage. Exported backups contain login data and should be protected.</div></div></div></div>`),
  },
  {
    file: 'promo-tile-440x280.png', w: 440, h: 280,
    html: page(440, 280, `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:26px"><img src="${ICON}" style="width:58px;height:58px"><div style="font-size:27px;font-weight:800;margin-top:13px">Session Switcher</div><div class="sub" style="font-size:16px;margin-top:7px">Multiple accounts. One window.</div><div style="font-size:12px;color:${C.accent};margin-top:7px">Separate cookies per tab</div></div>`),
  },
  {
    file: 'marquee-1400x560.png', w: 1400, h: 560,
    html: page(1400, 560, `<div style="display:flex;align-items:center;gap:72px;padding:60px 100px"><div style="flex:1">${mark(48)}<div class="h" style="font-size:55px;margin-top:27px">Keep multiple logins<br><span class="accent">side by side</span></div><div class="sub" style="font-size:22px;max-width:560px;margin-top:17px">Switch between work, personal, client, or test accounts on the same site without signing out.</div></div><div style="width:470px">${browser(appPage('Admin', C.accent), { w: 470, h: 360, tabs: ['Teamboard · Admin', 'Teamboard'] })}</div></div>`),
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browserInstance = await puppeteer.launch({ executablePath: await resolveChrome(), headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'] });
  try {
    for (const asset of assets) {
      const pageInstance = await browserInstance.newPage();
      await pageInstance.setViewport({ width: asset.w, height: asset.h, deviceScaleFactor: 1 });
      await pageInstance.setContent(asset.html, { waitUntil: 'load' });
      await pageInstance.evaluate(() => document.fonts.ready);
      await pageInstance.screenshot({ path: resolve(OUT, asset.file), type: 'png' });
      await pageInstance.close();
      console.log(`store-assets/${asset.file} (${asset.w}x${asset.h})`);
    }
  } finally {
    await browserInstance.close();
  }
  console.log('Marketing assets generated in store-assets/');
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
