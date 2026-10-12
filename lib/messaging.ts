/**
 * Typed message protocol between the UI (popup / manager) and the background
 * engine. One discriminated union for requests, one mapped type for responses,
 * so `sendMessage('createSession', …)` is fully type-checked end to end.
 */
import type { BackupFile, Session, TabContext } from './types';

export interface MessageMap {
  /** Everything the popup needs for the active tab. */
  getContext: {
    req: { tabId?: number };
    res: TabContext;
  };
  listAllSessions: {
    req: {};
    res: { sessions: Session[]; jarSizes: Record<string, number> };
  };
  createSession: {
    req: { domain: string; name: string; color?: string };
    res: { session: Session };
  };
  renameSession: {
    req: { sessionId: string; name: string };
    res: { session: Session };
  };
  recolorSession: {
    req: { sessionId: string; color: string };
    res: { session: Session };
  };
  deleteSession: {
    req: { sessionId: string };
    res: { ok: true };
  };
  /** Open a new tab already bound to a session. */
  openInSession: {
    req: { sessionId: string; url?: string };
    res: { tabId: number };
  };
  /** Bind an existing tab to a session (reloads the tab into it). */
  bindTab: {
    req: { tabId: number; sessionId: string };
    res: { ok: true };
  };
  /** Detach a tab back to the browser's shared profile (reloads it). */
  unbindTab: {
    req: { tabId: number };
    res: { ok: true };
  };
  /** Seed a session's jar from the browser's current real login for a domain. */
  importCurrentLogin: {
    req: { sessionId: string; tabId: number };
    res: { imported: number };
  };
  exportData: {
    req: {};
    res: BackupFile;
  };
  importData: {
    req: { backup: BackupFile; merge: boolean };
    res: { sessions: number };
  };
}

export type MessageType = keyof MessageMap;

interface Envelope<T extends MessageType> {
  type: T;
  payload: MessageMap[T]['req'];
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** UI-side: send a typed request to the background and unwrap the result. */
export async function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageMap[T]['req'] = {} as MessageMap[T]['req'],
): Promise<MessageMap[T]['res']> {
  const envelope: Envelope<T> = { type, payload };
  const result = (await chrome.runtime.sendMessage(envelope)) as
    | Result<MessageMap[T]['res']>
    | undefined;
  if (!result) throw new Error('No response from background service worker');
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export type Handlers = {
  [T in MessageType]: (
    payload: MessageMap[T]['req'],
    sender: chrome.runtime.MessageSender,
  ) => Promise<MessageMap[T]['res']>;
};

/** Background-side: wire a handler map onto `runtime.onMessage`. */
export function registerHandlers(handlers: Handlers, ready: Promise<void> = Promise.resolve()): void {
  chrome.runtime.onMessage.addListener((message: Envelope<MessageType>, sender, sendResponse) => {
    const handler = handlers[message?.type];
    if (!handler) return false;

    ready.then(() => (handler as (p: unknown, s: chrome.runtime.MessageSender) => Promise<unknown>)(
      message.payload,
      sender,
    ))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true; // keep the message channel open for the async response
  });
}
