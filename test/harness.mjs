/**
 * Shared plumbing for the real-Chrome E2E tests: resolving an extension-capable
 * Chrome (Chrome for Testing — regular Chrome ≥137 ignores `--load-extension`),
 * launching it with the built extension loaded, and small page helpers.
 */
import os from 'node:os';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import {
  install, computeExecutablePath, resolveBuildId, detectBrowserPlatform, Browser,
} from '@puppeteer/browsers';

export const EXT = resolve('.output/chrome-mv3');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CACHE_DIR = join(os.homedir(), '.cache', 'session-switcher-cft');
// Puppeteer's default cache often already holds a Chrome for Testing build.
const KNOWN_CACHES = [join(os.homedir(), '.cache', 'puppeteer'), CACHE_DIR];

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

/** Resolve a Chrome that still honours `--load-extension`. */
export async function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cached = findCachedChrome();
  if (cached) return cached;
  const buildId = await resolveBuildId(Browser.CHROME, detectBrowserPlatform(), 'stable');
  console.log(`Installing Chrome for Testing ${buildId} (one-time, ~150 MB)…`);
  await install({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR });
  return computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR });
}

/** Launch Chrome for Testing with the built extension loaded. */
export async function launch() {
  if (!existsSync(EXT)) throw new Error(`Build first (npm run build): ${EXT} missing`);
  const executablePath = await resolveChrome();
  console.log(`chrome: ${executablePath}`);
  return puppeteer.launch({
    executablePath,
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
}

/** Wait for the extension's background service worker and return its id. */
export async function extensionId(browser) {
  const sw = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('background.js'),
    { timeout: 20000 },
  );
  return new URL(sw.url()).host;
}

/** Open the manager page and return a typed `call(type, payload)` helper. */
export async function engineApi(browser, extId) {
  const mgr = await browser.newPage();
  await mgr.goto(`chrome-extension://${extId}/manager.html`, { waitUntil: 'load' });
  return (type, payload) =>
    mgr.evaluate((t, p) => chrome.runtime.sendMessage({ type: t, payload: p }), type, payload);
}

/** Poll all open pages until one matches `pred(url)`. */
export async function findPage(browser, pred, timeout = 20000) {
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

/** Minimal assertion helper with a running pass count. */
export function checker() {
  let passed = 0;
  return {
    check(label, cond) {
      if (cond) { passed++; console.log(`  ✓ ${label}`); }
      else { console.error(`  ✗ ${label}`); throw new Error(`FAILED: ${label}`); }
    },
    get passed() { return passed; },
  };
}
