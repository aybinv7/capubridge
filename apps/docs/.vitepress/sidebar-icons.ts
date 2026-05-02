// Lucide SVG paths — exact shapes from lucide-vue-next 1.0.0 used in the desktop app.
// VitePress renders sidebar `text` via v-html, so inline SVG works and inherits currentColor.

const SVG_ATTRS =
  `xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" ` +
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
  `style="display:inline-block;vertical-align:-2px;margin-right:7px;flex-shrink:0"`;

function svg(paths: string): string {
  return `<svg ${SVG_ATTRS}>${paths}</svg>`;
}

// ── Icon shapes ──────────────────────────────────────────────────────────────

export const icons = {
  // Sidebar.vue: Smartphone
  devices: svg(
    `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>` + `<path d="M12 18h.01"/>`,
  ),

  // Sidebar.vue: AppWindow
  app: svg(
    `<rect x="2" y="4" width="20" height="16" rx="2"/>` +
      `<path d="M10 4v4"/>` +
      `<path d="M2 8h20"/>` +
      `<path d="M6 4v4"/>`,
  ),

  // Sidebar.vue: Database
  storage: svg(
    `<ellipse cx="12" cy="5" rx="9" ry="3"/>` +
      `<path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>` +
      `<path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>`,
  ),

  // Sidebar.vue: Globe
  network: svg(
    `<circle cx="12" cy="12" r="10"/>` +
      `<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>` +
      `<path d="M2 12h20"/>`,
  ),

  // Sidebar.vue: Crosshair
  inspect: svg(
    `<circle cx="12" cy="12" r="10"/>` +
      `<line x1="22" x2="18" y1="12" y2="12"/>` +
      `<line x1="6" x2="2" y1="12" y2="12"/>` +
      `<line x1="12" x2="12" y1="6" y2="2"/>` +
      `<line x1="12" x2="12" y1="22" y2="18"/>`,
  ),

  // SubNavTabs.vue: Zap
  capacitor: svg(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`),

  // Sidebar.vue: MonitorPlay
  recording: svg(
    `<rect width="20" height="14" x="2" y="3" rx="2"/>` +
      `<path d="M12 17v4"/>` +
      `<path d="M8 21h8"/>` +
      `<path d="m10 8 5 3-5 3V8z"/>`,
  ),

  // SubNavTabs.vue: Shuffle (hybrid)
  hybrid: svg(
    `<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>` +
      `<path d="m18 2 4 4-4 4"/>` +
      `<path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/>` +
      `<path d="m18 14 4 4-4 4"/>` +
      `<path d="M21.7 17H20c-1.3 0-2.5-.6-3.3-1.7l-.5-.7"/>`,
  ),

  // SubNavTabs.vue: Terminal
  dock: svg(`<polyline points="4 17 10 11 4 5"/>` + `<line x1="12" x2="20" y1="19" y2="19"/>`),

  // SubNavTabs.vue: Monitor
  mirror: svg(
    `<rect width="20" height="14" x="2" y="3" rx="2"/>` +
      `<path d="M8 21h8"/>` +
      `<path d="M12 17v4"/>`,
  ),

  // Sidebar.vue: Settings
  settings: svg(
    `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>` +
      `<circle cx="12" cy="12" r="3"/>`,
  ),
};
