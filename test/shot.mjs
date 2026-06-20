/**
 * Screenshot the real popup/manager UI from the built extension, with a mocked
 * getContext so they render populated. For visual QA of the UI only.
 *   node test/shot.mjs            → popup-shot.png
 *   node test/shot.mjs manager    → manager-shot.png
 */
import { writeFileSync } from 'node:fs';
import { launch, extensionId, sleep } from './harness.mjs';

const sessions = [
  { id: 's1', domain: 'claude.ai', name: 'Work', color: '#6c8cff', createdAt: 0, updatedAt: 0 },
  { id: 's2', domain: 'claude.ai', name: 'Personal', color: '#4fcf8f', createdAt: 0, updatedAt: 0 },
  { id: 's3', domain: 'claude.ai', name: 'Client — Acme', color: '#ff8f6c', createdAt: 0, updatedAt: 0 },
];
const ctx = {
  tabId: 1, url: 'https://claude.ai/', host: 'claude.ai', domain: 'claude.ai',
  siteName: 'Claude', boundSessionId: 's2', sessions, jarSizes: { s1: 12, s2: 0, s3: 7 },
};
const listAll = { sessions, jarSizes: { s1: 12, s2: 0, s3: 7 } };

const which = process.argv[2] === 'manager' ? 'manager' : 'popup';
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
        return true;
      } catch { return false; }
    };
    if (!(window.chrome && chrome.runtime && patch())) {
      const iv = setInterval(() => { if (window.chrome && chrome.runtime && patch()) clearInterval(iv); }, 2);
    }
  }, ctx, listAll);

  await page.goto(`chrome-extension://${extId}/${which}.html`, { waitUntil: 'load' });
  await sleep(500);
  const el = which === 'manager' ? await page.$('body') : await page.$('#app');
  const png = await el.screenshot();
  const file = `${which}-shot.png`;
  writeFileSync(file, png);
  console.log(`saved ${file}`);
} finally {
  await browser.close();
}
