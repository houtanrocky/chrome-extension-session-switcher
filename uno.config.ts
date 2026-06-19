import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    // Inline icons via `i-<collection>-<name>` classes. Collections are
    // resolved at build time from any installed @iconify-json/* package; the
    // UI degrades gracefully (empty span) if none are installed.
    presetIcons({ scale: 1.1, warn: false }),
  ],
  theme: {
    colors: {
      bg: '#0e0f13',
      panel: '#15171e',
      panel2: '#1d2029',
      line: '#2a2e3a',
      ink: '#e7e9ee',
      muted: '#9aa1b2',
      accent: '#6c8cff',
    },
  },
  shortcuts: {
    btn: 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium cursor-pointer select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    'btn-primary': 'btn bg-accent text-white hover:bg-[#5a7bff]',
    'btn-ghost': 'btn bg-panel2 text-ink hover:bg-line',
    'btn-danger': 'btn bg-transparent text-[#ff7a7a] hover:bg-[#ff7a7a1a]',
    card: 'bg-panel border border-line rounded-lg',
    input:
      'w-full bg-panel2 border border-line rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent',
  },
});
