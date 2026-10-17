/**
 * Screenshot the real popup/manager UI from the built extension, with a mocked
 * getContext so they render populated. For visual QA of the UI only.
 *   node test/shot.mjs            → popup-shot.png (three sessions)
 *   node test/shot.mjs guide      → popup-guide-shot.png (first-use guide)
 *   node test/shot.mjs empty      → popup-empty-shot.png (Create session state)
 *   node test/shot.mjs manager    → manager-shot.png
 */
import { writeFileSync } from 'node:fs';
import { launch, extensionId, sleep } from './harness.mjs';

const baseSessions = [
  { id: 's1', domain: 'teamboard.test', name: 'Admin', color: '#6c8cff', createdAt: 0, updatedAt: 0 },
  { id: 's2', domain: 'teamboard.test', name: 'Standard user', color: '#46c98a', createdAt: 0, updatedAt: 0 },
  { id: 's3', domain: 'teamboard.test', name: 'Guest', color: '#ff8f6c', createdAt: 0, updatedAt: 0 },
];
const guideSession = [baseSessions[0]];
const emptySessions = [];

const mode = process.argv[2] ?? 'popup';
const which = mode === 'manager' ? 'manager' : 'popup';
const sessions = mode === 'guide' ? guideSession : mode === 'empty' ? emptySessions : baseSessions;
const jarSizes = mode === 'guide' ? { s1: 0 } : mode === 'empty' ? {} : { s1: 24, s2: 11, s3: 0 };
const ctx = {
  tabId: 1, url: 'https://teamboard.test/', host: 'teamboard.test', domain: 'teamboard.test',
  siteName: 'Teamboard', boundSessionId: mode === 'popup' ? 's1' : null, sessions, jarSizes,
};
const listAll = { sessions: baseSessions, jarSizes: { s1: 24, s2: 11, s3: 0 } };
const browser = await launch();
try {
  const extId = await extensionId(browser);
  const page = await browser.newPage();
  await page.setViewport({ width: which === 'manager' ? 820 : 380, height: 760, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((ctx, listAll) => {
    const reply = (msg) => {
      const t = msg && msg.type;
      if (t === 'getContext') return { ok: true, data: ctx };
      if (t === 'listAllSessions') return { ok: true, data: listAll };
      return { ok: true, data: {} };
    };
    const patch = () => {
      try {
        Object.defineProperty(chrome.runtime, 'sendMessage', {
          configurable: true, writable: true, value: (msg) => Promise.resolve(reply(msg)),
        });
        // Keep the release banner out of marketing captures so the screenshots
        // show the stable published workflow rather than a one-time notice.
        if (chrome.storage?.local) {
          Object.defineProperty(chrome.storage.local, 'get', {
            configurable: true, writable: true,
            value: () => Promise.resolve({ releaseNoteSeen: '0.2.0' }),
          });
        }
        return true;
      } catch { return false; }
    };
    if (!(window.chrome && chrome.runtime && patch())) {
      const iv = setInterval(() => { if (window.chrome && chrome.runtime && patch()) clearInterval(iv); }, 2);
    }
  }, ctx, listAll);

  await page.goto(`chrome-extension://${extId}/${which}.html`, { waitUntil: 'load' });
  await sleep(500);
  // Capture the fixed-width popup shell itself. The host page is wider than
  // the extension panel and would otherwise leave a white strip in the PNG.
  const el = which === 'manager' ? await page.$('body') : (await page.$('#app > div') ?? await page.$('#app'));
  const png = await el.screenshot();
  const file = mode === 'guide' ? 'popup-guide-shot.png' : mode === 'empty' ? 'popup-empty-shot.png' : `${which}-shot.png`;
  writeFileSync(file, png);
  console.log(`saved ${file}`);
} finally {
  await browser.close();
}
