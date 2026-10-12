# Repository Guidelines

## Project Structure & Module Organization

This is a WXT + Preact + TypeScript Chromium extension. UI entry points live in `entrypoints/popup` and `entrypoints/manager`; the background service worker is `entrypoints/background.ts`. Core session, cookie, tab, and messaging logic is under `lib/engine`, with shared contracts in `lib/`. The main-world storage isolation shim is `entrypoints/storage-shim.content.ts`. Unit tests sit beside implementation files as `*.test.ts`; browser scenarios and helpers are in `test/`. Static icons and store imagery are in `public/` and `store-assets/`; architectural and policy documentation is in `docs/`, `README.md`, and `PRIVACY.md`.

## Build, Test, and Development Commands

- `npm run dev` starts WXT development mode with hot reload.
- `npm run build` creates a production extension bundle in `.output/`.
- `npm run compile` runs TypeScript checking without emitting files.
- `npm test` runs the Vitest unit suite once; use `npm run test:watch` while iterating.
- `npm run test:e2e` builds the extension and runs the Puppeteer-based end-to-end checks.
- `npm run zip` packages the production build for distribution.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, and single-quoted strings, matching the existing files. Prefer explicit types at public boundaries and small modules with focused responsibilities. Use `camelCase` for variables/functions, `PascalCase` for Preact components and types, and descriptive kebab-free filenames such as `cookieJar.ts`. Keep UI utility classes consistent with the existing UnoCSS configuration.

## Testing Guidelines

Add colocated `*.test.ts` tests for engine, messaging, domain, and shim behavior. Use Vitest mocks from `test/chromeMock.ts` where browser APIs are involved. Run `npm test` and `npm run compile` before submitting; run `npm run test:e2e` when changing tab isolation, storage shims, or service-worker behavior.

## Commit & Pull Request Guidelines

Use imperative, scoped Conventional Commit subjects such as `feat: ...`, `fix: ...`, `docs: ...`, or `chore: ...`. Keep commits focused. Pull requests should explain the user-visible change, include relevant test commands and results, link an issue when applicable, and attach screenshots for popup or manager UI changes.

## Security & Configuration Tips

Do not commit credentials or live account data. Treat cookie capture, DNR rules, storage prefixes, and service-worker handling as security-sensitive; update `docs/ARCHITECTURE.md` when their behavior changes. Preserve Chromium-only assumptions documented in `README.md`.
