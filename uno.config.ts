import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    // Inline icons via `i-lucide-<name>` classes, resolved at build time from
    // the installed @iconify-json/lucide package. Degrades to an empty span if
    // a name is missing.
    presetIcons({ scale: 1.15, warn: false }),
  ],
  // presetUno's minimal preflight doesn't neutralize native button chrome, so
  // bare/ghost buttons would show the UA's light background. Reset it once here.
  preflights: [
    {
      getCSS: () =>
        'button{appearance:none;background:transparent;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer}',
    },
  ],
  theme: {
    colors: {
      bg: '#0e0f13',
      panel: '#15171e',
      panel2: '#1d2029',
      line: '#2a2e3a',
      ink: '#e7e9ee',
      muted: '#9aa1b2',
      faint: '#6b7280',
      accent: '#6c8cff',
      accent2: '#5a7bff',
      success: '#46c98a',
      danger: '#ff7a7a',
    },
  },
  shortcuts: {
    btn: 'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer select-none transition-all duration-100 active:scale-[.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
    'btn-primary': 'btn bg-accent text-white hover:bg-accent2 shadow-[0_1px_2px_rgba(0,0,0,.3)]',
    'btn-ghost': 'btn bg-panel2 text-ink hover:bg-line',
    'btn-danger': 'btn bg-transparent text-danger hover:bg-[#ff7a7a1a]',
    // Square icon-only button.
    'btn-icon': 'inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-line transition-colors cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',
    card: 'bg-panel border border-line rounded-xl',
    badge: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide',
    input:
      'w-full bg-panel2 border border-line rounded-lg px-2.5 py-1.5 text-sm text-ink placeholder-faint outline-none transition-colors focus:border-accent focus:bg-[#20232d]',
  },
});
