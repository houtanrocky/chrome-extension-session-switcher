/**
 * Regression test for service-worker cookie leakage (the SW-driven-SPA bug).
 *
 * A site that registers a service worker which intercepts requests is the worst
 * case for per-tab cookie isolation: once the SW controls the page, the app's
 * requests are re-issued *by the SW*, which carries no tab id — so the per-tab
 * DNR rule can't match them and they fall through to the shared profile. This
 * test makes the local server behave exactly like that and asserts the managed
 * tab still reports its own session identity.
 *
 *   npm run build && node test/e2e-sw.mjs
 *
 * Before the fix this FAILS (the SW-routed request sees the shared profile);
 * after the shim neutralizes service workers in managed tabs it PASSES.
 */
import http from 'node:http';
import { launch, extensionId, engineApi, findPage, checker, sleep } from './harness.mjs';

const t = checker();
const check = t.check;

const SW_JS = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname === '/whoami') e.respondWith(fetch(e.request)); // re-issued by the SW
});
`;

function startServer() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/sw.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(SW_JS);
      return;
    }
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

async function main() {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;
  console.log(`server: ${base}`);
  const browser = await launch();

  try {
    const extId = await extensionId(browser);
    const call = await engineApi(browser, extId);
    const s = await call('createSession', { domain: 'localhost', name: 'SW' });
    const id = s.data.session.id;

    await call('openInSession', { sessionId: id, url: `${base}/login?who=Alice` });
    const page = await findPage(browser, (u) => u.includes('localhost') && u.includes('who=Alice'));
    await page.waitForFunction(() => document.readyState !== 'loading');
    await sleep(300);

    // Baseline: a direct request (no SW) is correctly isolated to this session.
    await page.goto(`${base}/whoami`, { waitUntil: 'load' });
    check('baseline: managed tab is Alice via a direct request',
      (await page.evaluate(() => document.body.textContent)).trim() === 'Alice');

    // Now make the site use a service worker, the way SW-driven SPAs do.
    await page.goto(`${base}/`, { waitUntil: 'load' });
    const swState = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return { registered: false, reason: 'no container (disabled)' };
      try {
        await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise((r) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true });
            setTimeout(r, 3000);
          });
        }
        return { registered: true, controlled: !!navigator.serviceWorker.controller };
      } catch (e) {
        return { registered: false, reason: String((e && e.message) || e) };
      }
    });
    console.log('  service worker:', JSON.stringify(swState));

    // The invariant: identity must survive a service-worker-using site.
    const viaSW = await page.evaluate(async () =>
      (await (await fetch('/whoami', { cache: 'no-store' })).text()).trim());
    console.log(`  whoami on the SW page: ${viaSW}`);
    check('managed tab keeps its session identity on a service-worker site', viaSW === 'Alice');

    // And nothing should have leaked into the browser's shared profile.
    const plain = await browser.newPage();
    await plain.goto(`${base}/whoami`, { waitUntil: 'load' });
    check('shared profile still sees no login',
      (await plain.evaluate(() => document.body.textContent)).trim() === 'anonymous');
    await page.close();

    // --- the real-world trigger: a worker ALREADY active for the origin
    //     (from a prior unmanaged visit) before the managed tab opens. The shim
    //     must unregister it and reload once to escape. ---
    await plain.goto(`${base}/`, { waitUntil: 'load' });
    await plain.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true });
          setTimeout(r, 3000);
        });
      }
    });
    check('pre-existing service worker is active for the origin',
      await plain.evaluate(() => !!navigator.serviceWorker.controller));

    const s2 = await call('createSession', { domain: 'localhost', name: 'SW2' });
    const id2 = s2.data.session.id;
    await call('openInSession', { sessionId: id2, url: `${base}/login?who=Carol` });
    const page2 = await findPage(browser, (u) => u.includes('localhost') && u.includes('who=Carol'));
    await page2.waitForFunction(() => document.readyState !== 'loading');
    await sleep(800); // allow the unregister + one-shot reload to settle

    let carol = 'anonymous';
    for (let i = 0; i < 8; i++) {
      await page2.goto(`${base}/whoami`, { waitUntil: 'load' });
      carol = (await page2.evaluate(() => document.body.textContent)).trim();
      if (carol !== 'anonymous') break;
      await sleep(200);
    }
    console.log(`  whoami with a pre-existing SW: ${carol}`);
    check('managed tab escapes a pre-existing service worker', carol === 'Carol');

    console.log(`\nSW E2E PASSED — ${t.passed} checks green.`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('\nSW E2E FAILED:', err.message);
  process.exit(1);
});
