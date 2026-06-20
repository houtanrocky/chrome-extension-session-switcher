/**
 * End-to-end isolation test against REAL Chrome (new headless, which supports
 * extensions). No real accounts needed: a local server plays "login" by setting
 * a `who` cookie, and `/whoami` echoes back the cookie it received. We then
 * prove that two sessions opened by the extension see different identities
 * concurrently, that web storage is namespaced per session, and that the
 * browser's own shared profile is never touched.
 *
 *   npm run build && node test/e2e.mjs
 *
 * Exits non-zero on the first failed assertion.
 */
import http from 'node:http';
import os from 'node:os';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import {
  install, computeExecutablePath, resolveBuildId, detectBrowserPlatform, Browser,
} from '@puppeteer/browsers';

const EXT = resolve('.output/chrome-mv3');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CACHE_DIR = join(os.homedir(), '.cache', 'session-switcher-cft');
// Puppeteer's default cache often already holds a Chrome for Testing build.
const KNOWN_CACHES = [join(os.homedir(), '.cache', 'puppeteer'), CACHE_DIR];

/** Find an already-installed Chrome for Testing in a known puppeteer cache. */
function findCachedChrome() {
  const platform = detectBrowserPlatform();
  for (const cacheDir of KNOWN_CACHES) {
    let builds = [];
    try { builds = readdirSync(join(cacheDir, 'chrome')); } catch { continue; }
    for (const name of builds.sort().reverse()) {
      if (!name.startsWith(platform + '-')) continue;
      const buildId = name.slice(platform.length + 1);
      const exe = computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir });
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

/**
 * Resolve a Chrome that still honours `--load-extension`. Regular Chrome ≥137
 * ignores it (a malware mitigation), so we use Chrome for Testing: an existing
 * cached build if present, otherwise install one on demand. Override with
 * CHROME_PATH to point at your own CfT binary (e.g. on a restricted network).
 */
async function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cached = findCachedChrome();
  if (cached) return cached;
  const buildId = await resolveBuildId(Browser.CHROME, detectBrowserPlatform(), 'stable');
  console.log(`Installing Chrome for Testing ${buildId} (one-time, ~150 MB)…`);
  await install({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR });
  return computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR });
}

let passed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { console.error(`  ✗ ${label}`); throw new Error(`FAILED: ${label}`); }
}

// ---- local fake-login server ----------------------------------------------
function startServer() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/login') {
      const who = u.searchParams.get('who') || 'anon';
      res.setHeader('Set-Cookie', `who=${who}; Path=/; SameSite=Lax`);
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><title>login</title><body>ok:${who}</body>`);
      return;
    }
    if (u.pathname === '/whoami') {
      const m = /(?:^|;\s*)who=([^;]+)/.exec(req.headers.cookie || '');
      res.setHeader('Content-Type', 'text/plain');
      res.end(m ? m[1] : 'anonymous');
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>home</title><body>home</body>');
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function findPage(browser, pred, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const p of await browser.pages()) {
      let url = '';
      try { url = p.url(); } catch { /* detached */ }
      if (pred(url)) return p;
    }
    await sleep(150);
  }
  throw new Error('timed out waiting for page');
}

async function whoami(page, base) {
  // Retry a few times to absorb the 60ms debounced DNR refresh after login.
  for (let i = 0; i < 8; i++) {
    await page.goto(`${base}/whoami`, { waitUntil: 'load' });
    const v = (await page.evaluate(() => document.body.textContent)).trim();
    if (v !== 'anonymous') return v;
    await sleep(150);
  }
  return 'anonymous';
}

async function main() {
  if (!existsSync(EXT)) throw new Error(`Build first (npm run build): ${EXT} missing`);
  const chromePath = await resolveChrome();
  console.log(`chrome: ${chromePath}`);

  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;
  console.log(`server: ${base}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    // new headless supports MV3 extensions; set HL=false to debug headful.
    headless: process.env.HL === 'false' ? false : true,
    userDataDir: mkdtempSync(join(os.tmpdir(), 'ss-e2e-')),
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
    ],
  });

  try {
    // Wait for the extension's background service worker, derive its id.
    const sw = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().includes('background.js'),
      { timeout: 20000 },
    );
    const extId = new URL(sw.url()).host;
    console.log(`extension id: ${extId}`);
    check('background service worker registered', !!extId);

    // Drive the engine through its real message API from an extension page.
    const mgr = await browser.newPage();
    await mgr.goto(`chrome-extension://${extId}/manager.html`, { waitUntil: 'load' });
    const call = (type, payload) =>
      mgr.evaluate((t, p) => chrome.runtime.sendMessage({ type: t, payload: p }), type, payload);

    const a = await call('createSession', { domain: 'localhost', name: 'A' });
    const b = await call('createSession', { domain: 'localhost', name: 'B' });
    check('two sessions created', a.ok && b.ok && a.data.session.id !== b.data.session.id);
    const idA = a.data.session.id, idB = b.data.session.id;

    // Open each session straight onto a distinct "login".
    await call('openInSession', { sessionId: idA, url: `${base}/login?who=Alice` });
    const pageA = await findPage(browser, (u) => u.includes('localhost') && u.includes('who=Alice'));
    await pageA.waitForFunction(() => document.readyState !== 'loading');

    await call('openInSession', { sessionId: idB, url: `${base}/login?who=Bob` });
    const pageB = await findPage(browser, (u) => u.includes('localhost') && u.includes('who=Bob'));
    await pageB.waitForFunction(() => document.readyState !== 'loading');
    await sleep(400); // let both Set-Cookie captures + DNR refreshes settle

    // ---- the headline: concurrent, isolated identities ----
    const seenA = await whoami(pageA, base);
    const seenB = await whoami(pageB, base);
    console.log(`  tab A sees: ${seenA} | tab B sees: ${seenB}`);
    check('tab A is logged in as Alice', seenA === 'Alice');
    check('tab B is logged in as Bob', seenB === 'Bob');
    check('the two tabs do NOT share a login', seenA !== seenB);

    // Re-read A after B logged in — proves B did not clobber A's jar.
    check('tab A still Alice after B logged in', (await whoami(pageA, base)) === 'Alice');

    // ---- the browser's shared profile stays clean ----
    const plain = await browser.newPage();
    const anon = await whoami(plain, base);
    check('an unmanaged tab sees no login (real jar untouched)', anon === 'anonymous');

    // ---- web-storage namespacing ----
    await pageA.bringToFront();
    await pageA.evaluate(() => localStorage.setItem('acct', 'Alice'));
    await pageB.evaluate(() => localStorage.setItem('acct', 'Bob'));
    check('localStorage["acct"] is per-session in tab A', (await pageA.evaluate(() => localStorage.getItem('acct'))) === 'Alice');
    check('localStorage["acct"] is per-session in tab B', (await pageB.evaluate(() => localStorage.getItem('acct'))) === 'Bob');

    // The physical store (seen by an unmanaged tab) shows the prefixed keys.
    const rawKeys = await plain.evaluate(() => Object.keys(localStorage));
    check('physical localStorage keys are namespaced per session',
      rawKeys.includes(`__ss:${idA}:acct`) && rawKeys.includes(`__ss:${idB}:acct`));

    console.log(`\nE2E PASSED — ${passed} checks green.`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('\nE2E FAILED:', err.message);
  process.exit(1);
});
