import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import UnoCSS from 'unocss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  // Preact + UnoCSS are wired in through Vite. WXT owns the manifest.
  vite: () => ({
    plugins: [preact(), UnoCSS()],
  }),

  manifest: {
    name: 'Session Switcher',
    short_name: 'Sessions',
    description:
      'Run many accounts side by side on Claude, ChatGPT and any rate-limited site. Each tab gets its own isolated cookie jar + storage.',
    // host_permissions are required so DNR can modify the Cookie header and
    // webRequest can read Set-Cookie for any site the user manages.
    host_permissions: ['<all_urls>'],
    permissions: [
      'declarativeNetRequest', // rewrite outgoing Cookie / strip Set-Cookie per tab
      'webRequest', // observe Set-Cookie responses to fill each session's jar
      'storage', // persist sessions + jars
      'unlimitedStorage', // jars/snapshots can be large
      'tabs', // read active tab, open tabs bound to a session
      'scripting', // clear the namespace marker when detaching a tab
      'cookies', // import an existing real login into a session
    ],
  },
});
