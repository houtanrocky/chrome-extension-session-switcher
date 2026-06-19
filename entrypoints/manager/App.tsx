import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { sendMessage } from '@/lib/messaging';
import { registrableDomain, siteName } from '@/lib/domains';
import type { Session } from '@/lib/types';

const PALETTE = ['#6c8cff', '#ff8f6c', '#4fcf8f', '#ffcf5c', '#c98cff', '#5cd0ff', '#ff6c9d', '#9aa1b2'];

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [jarSizes, setJarSizes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const refresh = useCallback(async () => {
    const { sessions, jarSizes } = await sendMessage('listAllSessions');
    setSessions(sessions);
    setJarSizes(jarSizes);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = map.get(s.domain) ?? [];
      arr.push(s);
      map.set(s.domain, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  const addSession = () => {
    const host = domainInput.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!host) return;
    const domain = registrableDomain(host);
    run(async () => {
      await sendMessage('createSession', { domain, name: nameInput.trim() || 'Session' });
      setDomainInput('');
      setNameInput('');
    });
  };

  const exportData = async () => {
    const backup = await sendMessage('exportData');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-switcher-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (merge: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        await run(() => sendMessage('importData', { backup, merge }));
      } catch (err) {
        alert('Invalid backup file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    input.click();
  };

  return (
    <div class="min-h-screen bg-bg text-ink font-sans">
      <div class="max-w-3xl mx-auto px-6 py-8">
        <header class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-semibold">Session Switcher</h1>
            <p class="text-sm text-muted">
              Every session keeps its own cookies + storage. Open as many as you like, side by side.
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn-ghost" disabled={busy} onClick={exportData}>Export</button>
            <button class="btn-ghost" disabled={busy} onClick={() => importData(true)}>Import (merge)</button>
            <button class="btn-danger" disabled={busy} onClick={() => importData(false)}>Import (replace)</button>
          </div>
        </header>

        <div class="card p-3 mb-6 flex flex-wrap items-end gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Site domain</span>
            <input
              class="input w-56"
              placeholder="claude.ai"
              value={domainInput}
              onInput={(e) => setDomainInput((e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Session name</span>
            <input
              class="input w-56"
              placeholder="Work"
              value={nameInput}
              onInput={(e) => setNameInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && addSession()}
            />
          </label>
          <button class="btn-primary" disabled={busy || !domainInput.trim()} onClick={addSession}>
            Create session
          </button>
        </div>

        {groups.length === 0 && (
          <p class="text-sm text-muted">No sessions yet. Create one above to get started.</p>
        )}

        <div class="space-y-6">
          {groups.map(([domain, list]) => (
            <section key={domain}>
              <div class="flex items-baseline gap-2 mb-2">
                <h2 class="text-sm font-semibold">{siteName(domain)}</h2>
                <span class="text-xs text-muted">{domain}</span>
              </div>
              <div class="space-y-1.5">
                {list.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    cookies={jarSizes[s.id] ?? 0}
                    busy={busy}
                    onOpen={() => run(() => sendMessage('openInSession', { sessionId: s.id }))}
                    onRename={(name) => run(() => sendMessage('renameSession', { sessionId: s.id, name }))}
                    onRecolor={(color) => run(() => sendMessage('recolorSession', { sessionId: s.id, color }))}
                    onDelete={() =>
                      confirm(`Delete session "${s.name}"? Its cookies will be lost.`) &&
                      run(() => sendMessage('deleteSession', { sessionId: s.id }))
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionRow(props: {
  session: Session;
  cookies: number;
  busy: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}) {
  const { session, cookies, busy } = props;
  const [name, setName] = useState(session.name);

  return (
    <div class="card px-3 py-2 flex items-center gap-3">
      <div class="flex gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            title="Set color"
            class="w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-110"
            style={{ background: c, borderColor: c === session.color ? '#fff' : 'transparent' }}
            onClick={() => props.onRecolor(c)}
          />
        ))}
      </div>
      <input
        class="input flex-1"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        onBlur={() => name.trim() && name !== session.name && props.onRename(name.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span class="text-xs text-muted w-20 text-right">
        {cookies > 0 ? `${cookies} cookies` : 'logged out'}
      </span>
      <button class="btn-ghost text-xs" disabled={busy} onClick={props.onOpen}>Open</button>
      <button class="btn-danger text-xs" disabled={busy} onClick={props.onDelete}>Delete</button>
    </div>
  );
}
