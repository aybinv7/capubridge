<script setup lang="ts">
import { ref, computed } from "vue";

type ModuleId =
  | "devices"
  | "app"
  | "storage"
  | "network"
  | "inspect"
  | "capacitor"
  | "recording"
  | "settings";

interface SubTab {
  label: string;
  anchor: string;
}
interface Module {
  id: ModuleId;
  label: string;
  link: string;
  tabs: SubTab[];
}

const modules: Module[] = [
  {
    id: "devices",
    label: "Devices",
    link: "/modules/devices",
    tabs: [
      { label: "Overview", anchor: "" },
      { label: "Apps", anchor: "#app-browser" },
      { label: "Files", anchor: "#file-explorer" },
      { label: "Performance", anchor: "" },
    ],
  },
  {
    id: "app",
    label: "App",
    link: "/modules/app",
    tabs: [
      { label: "Overview", anchor: "" },
      { label: "Performance", anchor: "" },
      { label: "Data Usage", anchor: "" },
    ],
  },
  {
    id: "storage",
    label: "Storage",
    link: "/modules/storage",
    tabs: [
      { label: "IndexedDB", anchor: "#indexeddb" },
      { label: "LocalStorage", anchor: "#localstorage" },
      { label: "SQLite", anchor: "#sqlite" },
      { label: "OPFS", anchor: "#opfs" },
      { label: "Cache", anchor: "#cache-api" },
      { label: "Graph", anchor: "#storage-graph" },
      { label: "Changes", anchor: "#change-tracking" },
    ],
  },
  {
    id: "network",
    label: "Network",
    link: "/modules/network",
    tabs: [
      { label: "Requests", anchor: "" },
      { label: "WebSocket", anchor: "" },
      { label: "Throttle", anchor: "" },
      { label: "Mock", anchor: "" },
    ],
  },
  {
    id: "inspect",
    label: "Inspect",
    link: "/modules/inspect",
    tabs: [
      { label: "Elements", anchor: "" },
      { label: "Vue DevTools", anchor: "" },
    ],
  },
  {
    id: "capacitor",
    label: "Capacitor",
    link: "/modules/capacitor",
    tabs: [
      { label: "Bridge", anchor: "" },
      { label: "Plugins", anchor: "" },
      { label: "Config", anchor: "" },
      { label: "Permissions", anchor: "" },
      { label: "Deeplinks", anchor: "" },
    ],
  },
];

// SVG paths from the desktop app's Sidebar.vue + SubNavTabs.vue
const ICON: Record<ModuleId | "settings", string> = {
  devices: `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`,
  app: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/>`,
  storage: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>`,
  network: `<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" y1="12" x2="22" y2="12"/>`,
  inspect: `<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>`,
  capacitor: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  recording: `<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="m10 8 5 3-5 3V8z"/>`,
  settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
};

function iconSvg(id: ModuleId | "settings", size = 15): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>`;
}

const activeId = ref<ModuleId>("storage");
const activeTabIdx = ref(0);
const current = computed(() => modules.find((m) => m.id === activeId.value)!);

function pick(id: ModuleId) {
  if (activeId.value !== id) {
    activeId.value = id;
    activeTabIdx.value = 0;
  }
}
</script>

<template>
  <div class="ap-root">
    <div class="ap-hint">Interactive preview — hover to explore, click to read docs</div>

    <div class="ap-window">
      <!-- ── Title bar ───────────────────────────────────────────── -->
      <div class="ap-titlebar">
        <div class="ap-wc">
          <span class="ap-dot ap-dot-r" />
          <span class="ap-dot ap-dot-y" />
          <span class="ap-dot ap-dot-g" />
        </div>
        <div class="ap-breadcrumb">
          <span class="ap-bc-app">Capubridge</span>
          <span class="ap-bc-sep">/</span>
          <span class="ap-bc-route">{{ current.label.toLowerCase() }}</span>
        </div>
        <div class="ap-tb-actions">
          <span class="ap-kbd">⌘K</span>
          <span class="ap-kbd">⌘J</span>
          <span class="ap-kbd ap-kbd-b">⌘B</span>
        </div>
      </div>

      <!-- ── Body ───────────────────────────────────────────────── -->
      <div class="ap-body">
        <!-- Sidebar -->
        <nav class="ap-sidebar">
          <div class="ap-nav">
            <a
              v-for="m in modules"
              :key="m.id"
              :href="m.link"
              class="ap-nav-item"
              :class="{ 'is-active': activeId === m.id }"
              @mouseenter="pick(m.id)"
            >
              <span class="ap-nav-icon" v-html="iconSvg(m.id)" />
              <span class="ap-nav-label">{{ m.label }}</span>
              <span v-if="activeId === m.id" class="ap-nav-indicator" />
            </a>
          </div>

          <div class="ap-nav-footer">
            <div class="ap-device-pill">
              <span class="ap-status-dot" />
              <span class="ap-device-name">Galaxy S24</span>
            </div>
            <a
              href="/modules/settings"
              class="ap-nav-item ap-settings-item"
              @mouseenter="pick('settings' as any)"
            >
              <span class="ap-nav-icon" v-html="iconSvg('settings')" />
              <span class="ap-nav-label">Settings</span>
            </a>
          </div>
        </nav>

        <!-- Main pane -->
        <div class="ap-main">
          <!-- Module header -->
          <div class="ap-mod-header">
            <span class="ap-mod-title">{{ current.label }}</span>
            <div class="ap-mod-actions">
              <button class="ap-action-btn">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <!-- Sub-nav tabs -->
          <div class="ap-subnav">
            <a
              v-for="(tab, i) in current.tabs"
              :key="i"
              :href="current.link + tab.anchor"
              class="ap-subnav-tab"
              :class="{ 'is-active': i === activeTabIdx }"
              @click.prevent="activeTabIdx = i"
            >
              {{ tab.label }}
            </a>
          </div>

          <!-- Content skeleton -->
          <div class="ap-content">
            <!-- Devices -->
            <template v-if="activeId === 'devices'">
              <div class="ap-device-list">
                <div class="ap-device-row is-online">
                  <span class="ap-status-dot is-online" />
                  <span class="ap-device-info">
                    <span class="ap-device-name-main">Galaxy S24 Ultra</span>
                    <span class="ap-device-sub">USB · :9222</span>
                  </span>
                  <span class="ap-badge ap-badge-green">Online</span>
                </div>
                <div class="ap-device-row is-online">
                  <span class="ap-status-dot is-online" />
                  <span class="ap-device-info">
                    <span class="ap-device-name-main">Pixel 8 Pro</span>
                    <span class="ap-device-sub">Wi-Fi · :9223</span>
                  </span>
                  <span class="ap-badge ap-badge-green">Online</span>
                </div>
                <div class="ap-device-row">
                  <span class="ap-status-dot" />
                  <span class="ap-device-info">
                    <span class="ap-device-name-main">emulator-5554</span>
                    <span class="ap-device-sub">ADB · offline</span>
                  </span>
                  <span class="ap-badge">Offline</span>
                </div>
              </div>
            </template>

            <!-- Storage — IDB explorer -->
            <template v-else-if="activeId === 'storage'">
              <div class="ap-storage">
                <div class="ap-tree">
                  <div class="ap-tree-db">
                    <span class="ap-tree-icon">▾</span> prod-app
                    <span class="ap-tree-count">3</span>
                  </div>
                  <div class="ap-tree-store is-active">
                    <span class="ap-tree-icon ap-indent">▸</span> users
                    <span class="ap-tree-count">142</span>
                  </div>
                  <div class="ap-tree-store">
                    <span class="ap-tree-icon ap-indent">▸</span> sessions
                    <span class="ap-tree-count">28</span>
                  </div>
                  <div class="ap-tree-store">
                    <span class="ap-tree-icon ap-indent">▸</span> cache
                    <span class="ap-tree-count">94</span>
                  </div>
                  <div class="ap-tree-db">
                    <span class="ap-tree-icon">▸</span> analytics
                    <span class="ap-tree-count">1</span>
                  </div>
                </div>
                <div class="ap-table-area">
                  <div class="ap-table-head">
                    <span class="ap-th ap-th-sm">id</span>
                    <span class="ap-th">email</span>
                    <span class="ap-th ap-th-sm">role</span>
                    <span class="ap-th">createdAt</span>
                    <span class="ap-th ap-th-sm">status</span>
                  </div>
                  <div class="ap-table-row">
                    <span class="ap-td ap-td-mono ap-th-sm">1</span>
                    <span class="ap-td">alice@example.com</span>
                    <span class="ap-td ap-td-muted ap-th-sm">admin</span>
                    <span class="ap-td ap-td-muted">2024-01-15</span>
                    <span class="ap-td ap-th-sm"
                      ><span class="ap-badge ap-badge-green">active</span></span
                    >
                  </div>
                  <div class="ap-table-row">
                    <span class="ap-td ap-td-mono ap-th-sm">2</span>
                    <span class="ap-td">bob@example.com</span>
                    <span class="ap-td ap-td-muted ap-th-sm">user</span>
                    <span class="ap-td ap-td-muted">2024-01-16</span>
                    <span class="ap-td ap-th-sm"
                      ><span class="ap-badge ap-badge-green">active</span></span
                    >
                  </div>
                  <div class="ap-table-row">
                    <span class="ap-td ap-td-mono ap-th-sm">3</span>
                    <span class="ap-td">carol@example.com</span>
                    <span class="ap-td ap-td-muted ap-th-sm">user</span>
                    <span class="ap-td ap-td-muted">2024-01-20</span>
                    <span class="ap-td ap-th-sm"><span class="ap-badge">inactive</span></span>
                  </div>
                  <div class="ap-table-row ap-skeleton-row" v-for="n in 4" :key="n">
                    <span class="ap-skel ap-th-sm" />
                    <span class="ap-skel" />
                    <span class="ap-skel ap-th-sm" />
                    <span class="ap-skel" />
                    <span class="ap-skel ap-th-sm" />
                  </div>
                </div>
              </div>
            </template>

            <!-- Network -->
            <template v-else-if="activeId === 'network'">
              <div class="ap-net-list">
                <div class="ap-net-head">
                  <span class="ap-net-h">Method</span>
                  <span class="ap-net-h ap-net-url">URL</span>
                  <span class="ap-net-h ap-net-sm">Status</span>
                  <span class="ap-net-h ap-net-sm">Time</span>
                  <span class="ap-net-h ap-net-sm">Size</span>
                </div>
                <div
                  class="ap-net-row"
                  v-for="req in [
                    { m: 'GET', url: '/api/users', s: 200, t: '12ms', sz: '1.2kB' },
                    { m: 'POST', url: '/api/auth/login', s: 201, t: '45ms', sz: '0.4kB' },
                    { m: 'GET', url: '/api/items/42', s: 200, t: '8ms', sz: '3.1kB' },
                    { m: 'GET', url: '/api/config', s: 304, t: '3ms', sz: '0B' },
                    { m: 'WS', url: 'wss://socket.io/...', s: 101, t: '—', sz: '—' },
                    { m: 'GET', url: '/api/devices', s: 200, t: '22ms', sz: '0.8kB' },
                  ]"
                  :key="req.url"
                >
                  <span class="ap-method" :class="`ap-m-${req.m.toLowerCase()}`">{{ req.m }}</span>
                  <span class="ap-net-url ap-td ap-td-mono">{{ req.url }}</span>
                  <span
                    class="ap-net-sm ap-td"
                    :class="req.s >= 400 ? 'ap-err' : req.s >= 300 ? 'ap-warn' : 'ap-td-muted'"
                    >{{ req.s }}</span
                  >
                  <span class="ap-net-sm ap-td ap-td-muted">{{ req.t }}</span>
                  <span class="ap-net-sm ap-td ap-td-muted">{{ req.sz }}</span>
                </div>
              </div>
            </template>

            <!-- Inspect -->
            <template v-else-if="activeId === 'inspect'">
              <div class="ap-dom-tree">
                <div class="ap-dom-row">
                  <span class="ap-dom-tag">&lt;html</span> lang=<span class="ap-dom-str">"en"</span
                  ><span class="ap-dom-tag">&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i1">
                  <span class="ap-dom-tag">&lt;body</span> class=<span class="ap-dom-str"
                    >"dark"</span
                  ><span class="ap-dom-tag">&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i2 ap-dom-sel">
                  <span class="ap-dom-tag">&lt;div</span> id=<span class="ap-dom-str">"app"</span
                  ><span class="ap-dom-tag">&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i3">
                  <span class="ap-dom-tag">&lt;div</span> class=<span class="ap-dom-str"
                    >"app-shell"</span
                  ><span class="ap-dom-tag">&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i4">
                  <span class="ap-dom-cmt">&lt;!-- TitleBar --&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i4">
                  <span class="ap-dom-tag">&lt;nav</span> class=<span class="ap-dom-str"
                    >"sidebar"</span
                  ><span class="ap-dom-tag">&gt;</span> <span class="ap-dom-ellipsis">…</span>
                  <span class="ap-dom-tag">&lt;/nav&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i4">
                  <span class="ap-dom-tag">&lt;main</span> class=<span class="ap-dom-str"
                    >"content"</span
                  ><span class="ap-dom-tag">&gt;</span> <span class="ap-dom-ellipsis">…</span>
                  <span class="ap-dom-tag">&lt;/main&gt;</span>
                </div>
                <div class="ap-dom-row ap-dom-i3"><span class="ap-dom-tag">&lt;/div&gt;</span></div>
                <div class="ap-dom-row ap-dom-i2"><span class="ap-dom-tag">&lt;/div&gt;</span></div>
                <div class="ap-dom-row ap-dom-i1">
                  <span class="ap-dom-tag">&lt;/body&gt;</span>
                </div>
              </div>
            </template>

            <!-- App Inspector -->
            <template v-else-if="activeId === 'app'">
              <div class="ap-app-overview">
                <div class="ap-app-card">
                  <div class="ap-app-card-label">Package</div>
                  <div class="ap-app-card-val ap-td-mono">com.example.app</div>
                </div>
                <div class="ap-app-card">
                  <div class="ap-app-card-label">Version</div>
                  <div class="ap-app-card-val">3.2.1 (42)</div>
                </div>
                <div class="ap-app-card">
                  <div class="ap-app-card-label">Target SDK</div>
                  <div class="ap-app-card-val">34</div>
                </div>
                <div class="ap-app-card">
                  <div class="ap-app-card-label">Min SDK</div>
                  <div class="ap-app-card-val">24</div>
                </div>
                <div class="ap-app-card">
                  <div class="ap-app-card-label">Install Date</div>
                  <div class="ap-app-card-val ap-td-muted">2024-11-02</div>
                </div>
                <div class="ap-app-card">
                  <div class="ap-app-card-label">Framework</div>
                  <div class="ap-app-card-val">
                    <span class="ap-badge ap-badge-brand">Capacitor 6</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Capacitor -->
            <template v-else-if="activeId === 'capacitor'">
              <div class="ap-plugin-list">
                <div class="ap-plugin-head">
                  <span>Plugin</span><span>Version</span><span>Native</span>
                </div>
                <div
                  class="ap-plugin-row"
                  v-for="p in [
                    { name: '@capacitor/camera', v: '6.0.2', native: true },
                    { name: '@capacitor/filesystem', v: '6.0.1', native: true },
                    { name: '@capacitor/push-notifications', v: '6.0.0', native: true },
                    { name: '@capacitor/splash-screen', v: '6.0.2', native: true },
                    { name: '@capacitor/preferences', v: '6.0.3', native: false },
                    { name: '@capacitor/network', v: '6.0.1', native: false },
                  ]"
                  :key="p.name"
                >
                  <span class="ap-td ap-td-mono">{{ p.name }}</span>
                  <span class="ap-td ap-td-muted">{{ p.v }}</span>
                  <span class="ap-td"
                    ><span class="ap-badge" :class="p.native ? 'ap-badge-green' : ''">{{
                      p.native ? "yes" : "no"
                    }}</span></span
                  >
                </div>
              </div>
            </template>

            <!-- Recording -->
            <template v-else-if="activeId === 'recording'">
              <div class="ap-recording">
                <div class="ap-rec-empty">
                  <div class="ap-rec-icon">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="20" height="14" x="2" y="3" rx="2" />
                      <path d="M12 17v4" />
                      <path d="M8 21h8" />
                      <path d="m10 8 5 3-5 3V8z" />
                    </svg>
                  </div>
                  <div class="ap-rec-label">No recordings yet</div>
                  <button class="ap-rec-btn">Start Recording</button>
                </div>
              </div>
            </template>

            <!-- Settings (fallback / not in modules list) -->
            <template v-else>
              <div class="ap-settings-list">
                <div
                  class="ap-setting-row"
                  v-for="s in ['ADB Path', 'Chrome Port', 'Theme', 'Shortcuts', 'Auto-connect']"
                  :key="s"
                >
                  <span class="ap-setting-label">{{ s }}</span>
                  <span class="ap-skel ap-skel-input" />
                </div>
              </div>
            </template>
          </div>
          <!-- /content -->

          <!-- Bottom dock -->
          <div class="ap-dock">
            <div class="ap-dock-tabs">
              <a href="/modules/dock" class="ap-dock-tab is-active">Logcat</a>
              <a href="/modules/dock" class="ap-dock-tab">Console</a>
              <a href="/modules/dock" class="ap-dock-tab">REPL</a>
              <a href="/modules/dock" class="ap-dock-tab">Exceptions</a>
              <div class="ap-dock-spacer" />
              <button class="ap-dock-close">↗</button>
            </div>
            <div class="ap-dock-body">
              <span class="ap-log-line"
                ><span class="ap-log-tag">ActivityManager</span>
                <span class="ap-log-msg">START {act=android.intent.action.MAIN}</span></span
              >
              <span class="ap-log-line"
                ><span class="ap-log-tag">Capacitor</span>
                <span class="ap-log-msg"
                  >Loading app at file:///android_asset/public/index.html</span
                ></span
              >
              <span class="ap-log-line ap-log-warn"
                ><span class="ap-log-tag">WebView</span>
                <span class="ap-log-msg">Mixed content: page loaded over HTTPS</span></span
              >
              <span class="ap-log-line"
                ><span class="ap-log-tag">Capacitor/App</span>
                <span class="ap-log-msg">Firing App State Change: isActive=true</span></span
              >
            </div>
          </div>
        </div>
        <!-- /main -->
      </div>
      <!-- /body -->
    </div>
    <!-- /window -->
  </div>
</template>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */
.ap-root {
  margin: 48px 0 64px;
  user-select: none;
}

.ap-hint {
  text-align: center;
  font-size: 12px;
  color: #6a6a6e;
  margin-bottom: 16px;
  letter-spacing: 0.02em;
}

/* ── Window chrome ────────────────────────────────────────────── */
.ap-window {
  background: #0e0e10;
  border: 1px solid #2a2a2f;
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px #1f1f23,
    0 24px 80px -16px rgba(0, 0, 0, 0.9),
    0 8px 24px -8px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  max-height: 540px;
  font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
  font-size: 12px;
}

/* ── Title bar ────────────────────────────────────────────────── */
.ap-titlebar {
  height: 44px;
  background: #0e0e10;
  border-bottom: 1px solid #1f1f23;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  flex-shrink: 0;
}

.ap-wc {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ap-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: filter 0.15s;
}
.ap-dot-r {
  background: #ff5f57;
}
.ap-dot-y {
  background: #ffbd2e;
}
.ap-dot-g {
  background: #28c941;
}
.ap-window:hover .ap-dot {
  filter: brightness(1.15);
}

.ap-breadcrumb {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6a6a6e;
  font-size: 12px;
}
.ap-bc-app {
  color: #8a8880;
  font-weight: 500;
}
.ap-bc-sep {
  color: #3a3a40;
}
.ap-bc-route {
  color: #f2efe9;
  font-weight: 500;
}

.ap-tb-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ap-kbd {
  font-size: 10px;
  color: #6a6a6e;
  border: 1px solid #2a2a2f;
  border-radius: 5px;
  padding: 2px 6px;
  background: #161619;
  font-family: inherit;
}
.ap-kbd-b {
  opacity: 0.4;
}

/* ── Body ─────────────────────────────────────────────────────── */
.ap-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── Sidebar ──────────────────────────────────────────────────── */
.ap-sidebar {
  width: 188px;
  background: #0e0e10;
  border-right: 1px solid #1f1f23;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 6px 8px;
}

.ap-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ap-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  color: rgba(242, 239, 233, 0.4);
  text-decoration: none;
  font-size: 12px;
  font-weight: 450;
  cursor: pointer;
  transition:
    background 120ms,
    color 120ms;
}
.ap-nav-item:hover,
.ap-nav-item.is-active {
  background: #1c1c20;
  color: #f2efe9;
}
.ap-nav-item.is-active {
  color: #f2efe9;
  font-weight: 500;
}

.ap-nav-indicator {
  position: absolute;
  left: 0;
  top: 25%;
  bottom: 25%;
  width: 2px;
  background: #e87c5a;
  border-radius: 2px;
}

.ap-nav-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.7;
}
.ap-nav-item.is-active .ap-nav-icon {
  opacity: 1;
}
.ap-nav-label {
  flex: 1;
}

.ap-nav-footer {
  padding-top: 8px;
  border-top: 1px solid #1f1f23;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ap-device-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 8px;
  background: #161619;
  border: 1px solid #2a2a2f;
  margin-bottom: 2px;
}
.ap-device-name {
  font-size: 11px;
  color: #8a8880;
}

.ap-settings-item {
  margin-top: 2px;
}

/* ── Main pane ────────────────────────────────────────────────── */
.ap-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #121214;
  overflow: hidden;
  min-width: 0;
}

.ap-mod-header {
  height: 46px;
  background: #121214;
  border-bottom: 1px solid #1f1f23;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
}
.ap-mod-title {
  font-size: 13px;
  font-weight: 600;
  color: #f2efe9;
  flex: 1;
}
.ap-mod-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ap-action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 7px;
  border: 1px solid #2a2a2f;
  background: #161619;
  color: #8a8880;
  font-size: 11px;
  cursor: pointer;
  transition:
    color 120ms,
    background 120ms;
}
.ap-action-btn:hover {
  color: #f2efe9;
  background: #1c1c20;
}

/* ── Sub-nav tabs ─────────────────────────────────────────────── */
.ap-subnav {
  height: 44px;
  background: #121214;
  border-bottom: 1px solid rgba(42, 42, 47, 0.6);
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 10px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.ap-subnav::-webkit-scrollbar {
  display: none;
}

.ap-subnav-tab {
  display: inline-flex;
  align-items: center;
  padding: 4px 11px;
  border-radius: 10px;
  font-size: 11.5px;
  color: rgba(242, 239, 233, 0.35);
  text-decoration: none;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: all 120ms;
  cursor: pointer;
}
.ap-subnav-tab:hover {
  color: rgba(242, 239, 233, 0.65);
  background: #1c1c20;
}
.ap-subnav-tab.is-active {
  color: #f2efe9;
  font-weight: 500;
  background: #232328;
  border-color: rgba(42, 42, 47, 0.8);
}

/* ── Content area ─────────────────────────────────────────────── */
.ap-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Status dot */
.ap-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3a3a40;
  flex-shrink: 0;
}
.ap-status-dot.is-online {
  background: #4fb06a;
  box-shadow: 0 0 6px #4fb06a55;
}

/* Badge */
.ap-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  background: #232328;
  color: #6a6a6e;
  font-weight: 500;
  white-space: nowrap;
}
.ap-badge-green {
  background: rgba(79, 176, 106, 0.15);
  color: #4fb06a;
}
.ap-badge-brand {
  background: rgba(232, 124, 90, 0.15);
  color: #e87c5a;
}

/* ── Devices ──────────────────────────────────────────────────── */
.ap-device-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ap-device-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background 120ms,
    border-color 120ms;
}
.ap-device-row:hover {
  background: #1c1c20;
  border-color: #2a2a2f;
}
.ap-device-row.is-online:hover {
  border-color: rgba(79, 176, 106, 0.25);
}

.ap-device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ap-device-name-main {
  font-size: 12px;
  color: #f2efe9;
  font-weight: 500;
}
.ap-device-sub {
  font-size: 10px;
  color: #6a6a6e;
  font-family: "Cascadia Code", "Fira Code", monospace;
}

/* ── Storage ──────────────────────────────────────────────────── */
.ap-storage {
  display: flex;
  height: 100%;
}

.ap-tree {
  width: 156px;
  border-right: 1px solid #1f1f23;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
  flex-shrink: 0;
}
.ap-tree-db,
.ap-tree-store {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  color: #8a8880;
  cursor: pointer;
  transition: background 120ms;
}
.ap-tree-db {
  color: #f2efe9;
  font-weight: 500;
}
.ap-tree-db:hover,
.ap-tree-store:hover {
  background: #1c1c20;
}
.ap-tree-store.is-active {
  background: rgba(232, 124, 90, 0.12);
  color: #e87c5a;
}
.ap-tree-icon {
  font-size: 9px;
  color: #6a6a6e;
  flex-shrink: 0;
}
.ap-indent {
  margin-left: 10px;
}
.ap-tree-count {
  margin-left: auto;
  font-size: 10px;
  color: #6a6a6e;
  background: #232328;
  border-radius: 4px;
  padding: 1px 5px;
}

.ap-table-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ap-table-head,
.ap-table-row {
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 0;
  border-bottom: 1px solid #1f1f23;
}
.ap-table-head {
  padding: 6px 12px;
  background: #161619;
  flex-shrink: 0;
}
.ap-table-row {
  padding: 5px 12px;
}
.ap-table-row:hover {
  background: #161619;
}

.ap-th {
  font-size: 10px;
  color: #6a6a6e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  flex: 1;
}
.ap-th.ap-th-sm,
.ap-td.ap-th-sm {
  flex: 0 0 60px;
}

.ap-td {
  font-size: 11px;
  color: #f2efe9;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ap-td-mono {
  font-family: "Cascadia Code", "Fira Code", monospace;
}
.ap-td-muted {
  color: #6a6a6e;
}

.ap-skel {
  height: 8px;
  border-radius: 4px;
  background: #232328;
  flex: 1;
  opacity: 0.5;
}
.ap-skeleton-row {
  opacity: 0.4;
}
.ap-skel-input {
  height: 22px;
  flex: 0 0 120px;
}

/* ── Network ──────────────────────────────────────────────────── */
.ap-net-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ap-net-head,
.ap-net-row {
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 0;
  border-bottom: 1px solid #1f1f23;
}
.ap-net-head {
  padding: 6px 12px;
  background: #161619;
  flex-shrink: 0;
}
.ap-net-row {
  padding: 5px 12px;
  cursor: pointer;
}
.ap-net-row:hover {
  background: #161619;
}

.ap-net-h {
  font-size: 10px;
  color: #6a6a6e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  flex: 0 0 48px;
}
.ap-net-h.ap-net-url {
  flex: 1;
}
.ap-net-h.ap-net-sm {
  flex: 0 0 54px;
}

.ap-method {
  font-size: 10px;
  font-weight: 700;
  flex: 0 0 48px;
  font-family: "Cascadia Code", "Fira Code", monospace;
  letter-spacing: 0.02em;
}
.ap-m-get {
  color: #4fb06a;
}
.ap-m-post {
  color: #6c9be0;
}
.ap-m-put {
  color: #e0a528;
}
.ap-m-delete {
  color: #d75a4a;
}
.ap-m-ws {
  color: #e87c5a;
}

.ap-net-url {
  flex: 1;
}
.ap-net-sm {
  flex: 0 0 54px;
}
.ap-err {
  color: #d75a4a;
}
.ap-warn {
  color: #8a8880;
}

/* ── Inspect ──────────────────────────────────────────────────── */
.ap-dom-tree {
  padding: 10px 14px;
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ap-dom-row {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #8a8880;
  padding: 1px 0;
}
.ap-dom-i1 {
  padding-left: 16px;
}
.ap-dom-i2 {
  padding-left: 32px;
}
.ap-dom-i3 {
  padding-left: 48px;
}
.ap-dom-i4 {
  padding-left: 64px;
}
.ap-dom-tag {
  color: #6c9be0;
}
.ap-dom-str {
  color: #4fb06a;
}
.ap-dom-cmt {
  color: #3a3a40;
  font-style: italic;
}
.ap-dom-ellipsis {
  color: #6a6a6e;
}
.ap-dom-sel {
  background: rgba(232, 124, 90, 0.12);
  border-radius: 4px;
  padding-left: 32px !important;
}

/* ── App Inspector ────────────────────────────────────────────── */
.ap-app-overview {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background: #1f1f23;
  padding: 1px;
}
.ap-app-card {
  background: #121214;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ap-app-card-label {
  font-size: 10px;
  color: #6a6a6e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.ap-app-card-val {
  font-size: 12px;
  color: #f2efe9;
}

/* ── Capacitor ────────────────────────────────────────────────── */
.ap-plugin-list {
  display: flex;
  flex-direction: column;
}
.ap-plugin-head {
  display: grid;
  grid-template-columns: 1fr 80px 60px;
  padding: 6px 12px;
  background: #161619;
  font-size: 10px;
  color: #6a6a6e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  border-bottom: 1px solid #1f1f23;
}
.ap-plugin-row {
  display: grid;
  grid-template-columns: 1fr 80px 60px;
  padding: 5px 12px;
  border-bottom: 1px solid #1f1f23;
  cursor: pointer;
}
.ap-plugin-row:hover {
  background: #161619;
}

/* ── Recording ────────────────────────────────────────────────── */
.ap-recording {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.ap-rec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  opacity: 0.5;
}
.ap-rec-icon {
  color: #6a6a6e;
}
.ap-rec-label {
  font-size: 12px;
  color: #6a6a6e;
}
.ap-rec-btn {
  font-size: 11px;
  padding: 5px 14px;
  border-radius: 8px;
  background: rgba(232, 124, 90, 0.15);
  color: #e87c5a;
  border: 1px solid rgba(232, 124, 90, 0.3);
  cursor: pointer;
}

/* ── Settings ─────────────────────────────────────────────────── */
.ap-settings-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ap-setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #1f1f23;
}
.ap-setting-label {
  font-size: 12px;
  color: #8a8880;
  flex: 0 0 100px;
}

/* ── Dock ─────────────────────────────────────────────────────── */
.ap-dock {
  border-top: 1px solid #2a2a2f;
  background: #0e0e10;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 110px;
}
.ap-dock-tabs {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  border-bottom: 1px solid #1f1f23;
  flex-shrink: 0;
}
.ap-dock-tab {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 8px;
  color: rgba(242, 239, 233, 0.3);
  text-decoration: none;
  transition: all 120ms;
  white-space: nowrap;
}
.ap-dock-tab:hover {
  color: rgba(242, 239, 233, 0.6);
  background: #1c1c20;
}
.ap-dock-tab.is-active {
  color: #f2efe9;
  background: #1c1c20;
  font-weight: 500;
}
.ap-dock-spacer {
  flex: 1;
}
.ap-dock-close {
  font-size: 11px;
  color: #3a3a40;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 120ms;
}
.ap-dock-close:hover {
  color: #6a6a6e;
}

.ap-dock-body {
  flex: 1;
  overflow: hidden;
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ap-log-line {
  display: flex;
  gap: 8px;
  font-size: 10.5px;
  font-family: "Cascadia Code", "Fira Code", monospace;
  color: #6a6a6e;
  white-space: nowrap;
  overflow: hidden;
}
.ap-log-line.ap-log-warn .ap-log-msg {
  color: #e0a528;
}
.ap-log-tag {
  color: #e87c5a;
  flex-shrink: 0;
  min-width: 100px;
}
.ap-log-msg {
  color: #8a8880;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
