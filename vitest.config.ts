import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    // Installs a baseline globalThis.chrome so engine modules that read enum
    // values at import time (e.g. dnr.ts) load cleanly; tests swap in a fresh
    // fake per case.
    setupFiles: ['./test/setup.ts'],
  },
});
