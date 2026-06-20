import { useCallback, useEffect, useState } from 'preact/hooks';
import { sendMessage } from '@/lib/messaging';
import type { TabContext } from '@/lib/types';

export function App() {
  const [ctx, setCtx] = useState<TabContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    setCtx(await sendMessage('getContext'));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const openManager = () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('/manager.html') });

  if (!ctx) {
    return <Shell><div class="p-4 text-muted text-sm">Loading…</div></Shell>;
  }

  if (!ctx.domain) {
    return (
      <Shell>
        <div class="p-4 space-y-3">
          <p class="text-sm text-muted">
            This isn't a website you can manage sessions for. Open an AI site
            (Claude, ChatGPT, …) or any login-gated site and try again.
          </p>
          <button class="btn-ghost w-full justify-center" onClick={openManager}>
            Open session manager
          </button>
        </div>
      </Shell>
    );
  }

  const bound = ctx.sessions.find((s) => s.id === ctx.boundSessionId) ?? null;

  return (
    <Shell>
      <header class="px-4 pt-4 pb-3 border-b border-line">
        <div class="flex items-center gap-2">
          <span class="text-base font-semibold text-ink">{ctx.siteName}</span>
          <span class="text-xs text-muted">{ctx.domain}</span>
        </div>
        <div class="mt-1 text-xs">
          {bound ? (
            <span class="inline-flex items-center gap-1.5 text-muted">
              <Dot color={bound.color} /> Active session: <b class="text-ink">{bound.name}</b>
            </span>
          ) : (
            <span class="text-muted">Using the browser's shared profile</span>
          )}
        </div>
      </header>

      <div class="p-3 space-y-1.5 max-h-80 overflow-auto">
        {ctx.sessions.length === 0 && (
          <p class="text-xs text-muted px-1 py-2">
            No sessions yet for this site. Create one below, then log in — each
            session keeps its own cookies and storage.
          </p>
        )}

        {ctx.sessions.map((s) => {
          const isBound = s.id === ctx.boundSessionId;
          const count = ctx.jarSizes[s.id] ?? 0;
          return (
            <div key={s.id} class="card px-2.5 py-2 flex items-center gap-2">
              <Dot color={s.color} />
              <div class="min-w-0 flex-1">
                <div class="text-sm text-ink truncate">{s.name}</div>
                <div class="text-[11px] text-muted">
                  {count > 0 ? `${count} cookies` : 'empty (logged out)'}
                </div>
              </div>
              {isBound ? (
                <span class="text-[11px] text-accent font-medium px-1.5">active</span>
              ) : (
                <button
                  class="btn-ghost text-xs"
                  disabled={busy}
                  title="Reload this tab into the session"
                  onClick={() => run(() => sendMessage('bindTab', { tabId: ctx.tabId, sessionId: s.id }), true)}
                >
                  Use here
                </button>
              )}
              <button
                class="btn-ghost text-xs"
                disabled={busy}
                title="Open a new tab in this session"
                onClick={() => run(() => sendMessage('openInSession', { sessionId: s.id }), true)}
              >
                Open
              </button>
            </div>
          );
        })}
      </div>

      <div class="px-3 pb-3 space-y-2">
        <div class="flex gap-1.5">
          <input
            class="input"
            placeholder="New session name (e.g. Work)"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                run(async () => {
                  await sendMessage('createSession', { domain: ctx.domain!, name: newName });
                  setNewName('');
                });
              }
            }}
          />
          <button
            class="btn-primary"
            disabled={busy || !newName.trim()}
            onClick={() =>
              run(async () => {
                await sendMessage('createSession', { domain: ctx.domain!, name: newName });
                setNewName('');
              })
            }
          >
            Add
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
                Adopt browser login
              </button>
            )}
            <button
              class="btn-danger flex-1 justify-center text-xs"
              disabled={busy}
              onClick={() => run(() => sendMessage('unbindTab', { tabId: ctx.tabId }), true)}
            >
              Detach tab
            </button>
          </div>
        )}
      </div>

      <footer class="px-4 py-2.5 border-t border-line flex justify-between items-center">
        <span class="text-[11px] text-muted">Session Switcher</span>
        <button class="text-[11px] text-accent hover:underline" onClick={openManager}>
          Manage all sessions →
        </button>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: preact.ComponentChildren }) {
  return <div class="w-[344px] bg-bg text-ink font-sans">{children}</div>;
}

function Dot({ color }: { color: string }) {
  return <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: color }} />;
}
