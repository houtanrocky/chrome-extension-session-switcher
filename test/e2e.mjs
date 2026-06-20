/**
 * End-to-end isolation test against REAL Chrome (Chrome for Testing, which still
 * honours `--load-extension`). No real accounts needed: a local server plays
 * "login" by setting a `who` cookie, and `/whoami` echoes back the cookie it
 * received. We prove that two sessions opened by the extension see different
 * identities concurrently, that web storage is namespaced per session, and that
 * the browser's own shared profile is never touched.
 *
 *   npm run test:e2e        (or: npm run build && node test/e2e.mjs)
 *
 * Exits non-zero on the first failed assertion.
 */
import http from 'node:http';
import { launch, extensionId, engineApi, findPage, checker, sleep } from './harness.mjs';

const t = checker();
const check = t.check;

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
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;
  console.log(`server: ${base}`);
  const browser = await launch();

  try {
    const extId = await extensionId(browser);
    console.log(`extension id: ${extId}`);
    check('background service worker registered', !!extId);

    const call = await engineApi(browser, extId);
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

    console.log(`\nE2E PASSED — ${t.passed} checks green.`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('\nE2E FAILED:', err.message);
  process.exit(1);
});
