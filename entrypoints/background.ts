import { registerHandlers } from '@/lib/messaging';
import { SessionManager } from '@/lib/engine/manager';

export default defineBackground(() => {
  const manager = new SessionManager();

  // Kick off init eagerly; handlers also tolerate a cold cache via hydrate().
  const ready = manager.init().catch((err) => console.error('[session-switcher] init failed', err));

  registerHandlers({
    getContext: async ({ tabId }) => {
      await ready;
      return manager.getContext(tabId);
    },
    listAllSessions: async () => {
      await ready;
      return manager.listAllSessions();
    },
    createSession: async ({ domain, name, color }) => ({
      session: await manager.createSession(domain, name, color),
    }),
    renameSession: async ({ sessionId, name }) => ({
      session: await manager.renameSession(sessionId, name),
    }),
    recolorSession: async ({ sessionId, color }) => ({
      session: await manager.recolorSession(sessionId, color),
    }),
    deleteSession: async ({ sessionId }) => {
      await manager.deleteSession(sessionId);
      return { ok: true } as const;
    },
    openInSession: async ({ sessionId, url }) => ({
      tabId: await manager.openInSession(sessionId, url),
    }),
    bindTab: async ({ tabId, sessionId }) => {
      await manager.bindTab(tabId, sessionId);
      return { ok: true } as const;
    },
    unbindTab: async ({ tabId }) => {
      await manager.unbindTab(tabId);
      return { ok: true } as const;
    },
    importCurrentLogin: async ({ sessionId, tabId }) => ({
      imported: await manager.importCurrentLogin(sessionId, tabId),
    }),
    exportData: async () => manager.exportData(),
    importData: async ({ backup, merge }) => ({
      sessions: await manager.importData(backup, merge),
    }),
  });
});
