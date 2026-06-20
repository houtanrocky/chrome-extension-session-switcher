import { makeChrome } from './chromeMock';

// Baseline so modules that capture chrome enums at import time load cleanly.
// Individual tests override globalThis.chrome with a fresh fake per case.
(globalThis as unknown as { chrome: typeof globalThis.chrome }).chrome = makeChrome().chrome;
