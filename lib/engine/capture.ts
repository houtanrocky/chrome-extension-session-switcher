/**
 * Reads `Set-Cookie` off responses so we can fold them into the owning
 * session's jar. This is observe-only `webRequest` (allowed in MV3); the
 * `extraHeaders` opt-in is required for `Set-Cookie` to be visible. Stripping
 * the header from the browser's view is DNR's job, not ours.
 */

export type SetCookieHandler = (
  tabId: number,
  url: string,
  setCookieValues: string[],
) => void;

/**
 * Register the response listener. Returns nothing; the listener lives for the
 * service worker's lifetime. The handler must be cheap and synchronous-safe —
 * it receives already-extracted `Set-Cookie` strings for tabbed requests only.
 */
export function installCaptureListener(handle: SetCookieHandler): void {
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.tabId < 0 || !details.responseHeaders) return;

      const setCookies: string[] = [];
      for (const header of details.responseHeaders) {
        if (header.name.toLowerCase() === 'set-cookie' && header.value) {
          // A combined header may pack multiple cookies separated by newlines.
          for (const line of header.value.split('\n')) {
            const v = line.trim();
            if (v) setCookies.push(v);
          }
        }
      }
      if (setCookies.length) handle(details.tabId, details.url, setCookies);
    },
    { urls: ['http://*/*', 'https://*/*'] },
    ['responseHeaders', 'extraHeaders'],
  );
}
