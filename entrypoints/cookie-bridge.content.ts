/** Relay document.cookie assignments from the MAIN-world shim to the worker. */
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  allFrames: true,
  main() {
    window.addEventListener('session-switcher-cookie', (event) => {
      const detail = (event as CustomEvent<{ url?: unknown; cookie?: unknown }>).detail;
      if (typeof detail?.url !== 'string' || typeof detail.cookie !== 'string') return;
      void chrome.runtime.sendMessage({
        type: 'captureDocumentCookie',
        payload: { url: detail.url, cookie: detail.cookie },
      });
    });
  },
});
