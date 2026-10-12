import { useCallback, useEffect, useState } from 'preact/hooks';
import { sendMessage } from '@/lib/messaging';
import type { Session, TabContext } from '@/lib/types';

export function App() {
  const [ctx, setCtx] = useState<TabContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [showUpdate, setShowUpdate] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [loadError, setLoadError] = useState('');
  const version = chrome.runtime.getManifest().version;

  const refresh = useCallback(async () => {
    setCtx(await sendMessage('getContext'));
  }, []);

  useEffect(() => {
    void refresh().catch((err) => setLoadError(String(err)));
    void chrome.storage.local.get('releaseNoteSeen').then((data) => {
      setShowUpdate(data.releaseNoteSeen !== version);
    });
  }, [refresh]);

  const dismissUpdate = async () => {
    await chrome.storage.local.set({ releaseNoteSeen: version });
    setShowUpdate(false);
  };

  const run = useCallback(
    async (fn: () => Promise<unknown>, close = false) => {
      setBusy(true);
      try {
        await fn();
        if (close) window.close();
        else await refresh();
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const openManager = () => chrome.tabs.create({ url: chrome.runtime.getURL('/manager.html') });

  const addSession = () =>
    run(async () => {
      await sendMessage('createSession', { domain: ctx!.domain!, name: newName });
      setNewName('');
    });

  if (!ctx) {
    return (
      <Shell>
        <div class="p-6 flex items-center justify-center gap-2 text-muted text-sm">
          {loadError ? (
            <div role="alert">
              <p>Could not load sessions. {loadError}</p>
              <button class="btn-ghost mt-2" onClick={() => run(refresh)}>Retry</button>
            </div>
          ) : <><span class="i-lucide-loader-circle animate-spin" /> Loading…</>}
        </div>
      </Shell>
    );
  }

  if (!ctx.domain) {
    return (
      <Shell>
        <div class="p-5 flex flex-col items-center text-center gap-3">
          <Logo size={34} />
          <p class="text-sm text-muted leading-relaxed">
            This page can't host sessions. Open a login-gated site — webmail, a
            dashboard, an AI chat — and try again.
          </p>
          <button class="btn-ghost w-full justify-center" onClick={openManager}>
            <span class="i-lucide-layout-grid" /> Open session manager
          </button>
        </div>
      </Shell>
    );
  }

  const bound = ctx.sessions.find((s) => s.id === ctx.boundSessionId) ?? null;

  return (
    <Shell>
      <header class="px-4 pt-3.5 pb-3 border-b border-line">
        <div class="flex items-center gap-2.5">
          <Logo size={26} />
          <div class="min-w-0 flex-1">
            <div class="text-[15px] font-semibold text-ink leading-tight truncate">{ctx.siteName}</div>
            <div class="text-[11px] text-faint leading-tight">{ctx.domain}</div>
          </div>
          <button class="btn-icon" title="Manage all sessions" onClick={openManager}>
            <span class="i-lucide-settings text-[15px]" />
          </button>
        </div>
        <div class="mt-2.5">
          {bound ? (
            <span
              class="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg text-[11px] bg-panel2 border border-line"
              style={{ borderColor: bound.color + '66' }}
            >
              <Dot color={bound.color} ring />
              <span class="text-muted">Active:</span>
              <b class="text-ink">{bound.name}</b>
            </span>
          ) : (
            <span class="inline-flex items-center gap-1.5 text-[11px] text-faint">
              <span class="i-lucide-globe text-[13px]" /> Using the browser's shared profile
            </span>
          )}
        </div>
      </header>

      {showUpdate && (
        <aside class="mx-3 mt-3 card p-3 text-xs" aria-label="What's new">
          <b>What’s new in {version}</b>
          <p class="mt-1 text-muted">Temporary rule failures now retry without forgetting your session. Session actions have clearer labels.</p>
          <div class="flex gap-2 mt-2">
            <button class="btn-ghost text-xs" onClick={() => { setShowGuide(true); void dismissUpdate(); }}>Try the workflow</button>
            <button class="btn-ghost text-xs" onClick={() => void dismissUpdate()}>Dismiss</button>
          </div>
        </aside>
      )}

      {(ctx.sessions.length <= 1 || showGuide) && (
        <aside class="mx-3 mt-3 card p-3 text-xs" aria-label="Getting started">
          <b>Test as multiple users</b>
          <ol class="list-decimal pl-4 mt-1 space-y-1 text-muted">
            <li>Create a named session, such as Admin.</li>
            <li>Choose Open new tab or Use this tab, then log in.</li>
            <li>Create another session, such as Standard user, and open it alongside the first.</li>
          </ol>
          <p class="mt-2 text-faint">Sessions belong to this site. After a browser restart, use these buttons to reconnect restored tabs.</p>
        </aside>
      )}

      <div class="px-3 pt-3 pb-1.5">
        <div class="flex items-center justify-between px-1 mb-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-faint">
            Sessions
          </span>
          {ctx.sessions.length > 0 && (
            <span class="text-[10px] text-faint">{ctx.sessions.length}</span>
          )}
        </div>

        <div class="space-y-1.5 max-h-72 overflow-auto pr-0.5">
          {ctx.sessions.length === 0 && (
            <div class="flex flex-col items-center text-center gap-1.5 px-3 py-5 card">
              <span class="i-lucide-users-round text-xl text-faint" />
              <p class="text-xs text-muted leading-relaxed">
                No sessions yet for this site.<br />Create one below, open it, then log in.
              </p>
            </div>
          )}

          {ctx.sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              bound={s.id === ctx.boundSessionId}
              cookies={ctx.jarSizes[s.id] ?? 0}
              busy={busy}
              onUse={() => run(() => sendMessage('bindTab', { tabId: ctx.tabId, sessionId: s.id }), true)}
              onOpen={() => run(() => sendMessage('openInSession', { sessionId: s.id }), true)}
            />
          ))}
        </div>
      </div>

      <div class="px-3 pb-3 pt-1 space-y-2">
        <label class="block text-xs text-muted" for="new-session">{ctx.sessions.length ? 'Create another session' : 'Create your first session'}</label>
        <div class="flex flex-col gap-1.5">
          <input
            id="new-session"
            class="input"
            placeholder="e.g. Admin, Standard user, Guest"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && newName.trim() && addSession()}
          />
          <button class="btn-primary px-3" disabled={busy || !newName.trim()} onClick={addSession}>
            <span class="i-lucide-plus" /> {ctx.sessions.length ? 'Create another session' : 'Create session'}
          </button>
        </div>

        {bound && (
          <div class="flex gap-1.5">
            {(ctx.jarSizes[bound.id] ?? 0) === 0 && (
              <button
                class="btn-ghost flex-1 justify-center text-xs"
                disabled={busy}
                title="One-time bootstrap: copy your normal (non-isolated) browser login for this site into this empty session. Hidden once the session has its own login — just log in instead."
                onClick={() => run(() => sendMessage('importCurrentLogin', { sessionId: bound.id, tabId: ctx.tabId }))}
              >
                <span class="i-lucide-key-round" /> Adopt browser login
              </button>
            )}
            <button
              class="btn-danger flex-1 justify-center text-xs"
              disabled={busy}
              title="Detach this tab back to the browser's shared profile"
              onClick={() => run(() => sendMessage('unbindTab', { tabId: ctx.tabId }), true)}
            >
              <span class="i-lucide-unlink" /> Detach tab
            </button>
          </div>
        )}
      </div>

      <footer class="px-4 py-2.5 border-t border-line flex justify-between items-center">
        <span class="inline-flex items-center gap-1.5 text-[11px] text-faint">
          <span class="i-lucide-shield-check text-[13px]" /> Session Switcher
        </span>
        <button class="text-[11px] text-accent hover:underline inline-flex items-center gap-1" onClick={openManager}>
          Manage all <span class="i-lucide-arrow-right text-[12px]" />
        </button>
      </footer>
    </Shell>
  );
}

function SessionRow(props: {
  session: Session;
  bound: boolean;
  cookies: number;
  busy: boolean;
  onUse: () => void;
  onOpen: () => void;
}) {
  const { session: s, bound, cookies, busy } = props;
  return (
    <div
      class={`group rounded-xl border px-2.5 py-2 flex flex-wrap items-center gap-2.5 transition-colors ${
        bound ? 'bg-panel2' : 'bg-panel border-line hover:bg-panel2'
      }`}
      style={bound ? { borderColor: s.color } : undefined}
    >
      <Dot color={s.color} ring={bound} />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="text-sm text-ink font-medium truncate">{s.name}</span>
          {bound && (
            <span class="badge text-success bg-[#46c98a1a]">
              <span class="i-lucide-check text-[11px]" /> active
            </span>
          )}
        </div>
        <div class="text-[11px] mt-0.5 flex items-center gap-1">
          {cookies > 0 ? (
            <span class="inline-flex items-center gap-1 text-success">
              <span class="i-lucide-circle-check text-[12px]" /> {cookies} saved cookies
            </span>
          ) : (
            <span class="inline-flex items-center gap-1 text-faint">
              <span class="i-lucide-circle-dashed text-[12px]" /> No saved cookies
            </span>
          )}
        </div>
      </div>
      <div class="flex gap-1.5 w-full">
        {!bound && (
          <button class="btn-ghost text-xs flex-1 justify-center" disabled={busy} title="Reload this tab into the session" onClick={props.onUse}>
            <span class="i-lucide-log-in text-[15px]" /> Use this tab
          </button>
        )}
        <button class="btn-ghost text-xs flex-1 justify-center" disabled={busy} onClick={props.onOpen}>
          <span class="i-lucide-external-link text-[15px]" /> Open new tab
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: preact.ComponentChildren }) {
  return <div class="w-[344px] bg-bg text-ink font-sans">{children}</div>;
}

function Dot({ color, ring = false }: { color: string; ring?: boolean }) {
  return (
    <span
      class="w-2.5 h-2.5 rounded-full inline-block shrink-0"
      style={{ background: color, boxShadow: ring ? `0 0 0 3px ${color}33` : undefined }}
    />
  );
}

/** Brand mark — three overlapping account circles, matching the toolbar icon. */
function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" class="shrink-0" aria-hidden="true">
      <circle cx="50" cy="34" r="22" fill="#5cd0ff" />
      <circle cx="34" cy="64" r="22" fill="#c98cff" />
      <circle cx="66" cy="64" r="22" fill="#6c8cff" />
    </svg>
  );
}
