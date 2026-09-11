export interface Feature {
  key: string;
  label: string;
  title: string;
  body: string;
  /** One short line, shown under the label while the step is active. */
  value: string;
  metrics: string[];
  accent: string;
  capture: string;
}

export const features: Feature[] = [
  {
    key: "devices",
    label: "Devices",
    title: "Every device at once, cable optional",
    body: "USB and Wi-Fi devices appear as they connect, each with its own independent session, so two phones side by side is normal rather than a juggling act. Hand a device over to wireless in one click, or launch an emulator straight from the app and drive it the same way.",
    value: "Several phones at once, wireless in a click",
    metrics: ["Multi-device", "One-click Wi-Fi", "Emulators"],
    accent: "#e8765a",
    capture: "inspector",
  },
  {
    key: "targets",
    label: "Targets",
    title: "Found, forwarded, attached",
    body: "Every debuggable WebView on the device is listed with its origin, and the CDP port is allocated and forwarded for you. Local dev servers on your own machine attach through the same panel, so the browser you build in and the phone you ship to sit side by side.",
    value: "Ports forwarded for you, local sites included",
    metrics: ["Auto-forward", "Multi-target", "Local sites too"],
    accent: "#71cbff",
    capture: "network",
  },
  {
    key: "storage",
    label: "Storage",
    title: "Six engines, searchable and editable",
    body: "IndexedDB, Localforage, LocalStorage and Cache API, plus the two with no panel at all in remote DevTools: OPFS and SQLite-WASM, on OPFS or the sync-access-handle pool. Search every column, stack filters, edit or delete a record and watch the write land on the device, then export the store when you would rather open it in your editor.",
    value: "Six engines, searchable and editable",
    metrics: ["6 engines", "Search + filter", "Edit + export"],
    accent: "#8f86ff",
    capture: "storage",
  },
  {
    key: "graph",
    label: "Schema graph",
    title: "State you can navigate, annotate and keep",
    body: "Stores, fields and inferred relationships render as a graph you can pan and group. Attach notes to a table, alias a cryptic name into something human, and read row counts, field maps and change volume per store. The annotations are saved for the next session and the next person.",
    value: "Your schema as a map you can annotate",
    metrics: ["Inferred links", "Notes", "Per-store metrics"],
    accent: "#8f86ff",
    capture: "graph",
  },
  {
    key: "elements",
    label: "Elements",
    title: "Vue and React devtools, over the wire",
    body: "Inspect the tree, computed styles and the box model with the live phone next to it. Framework devtools work here too, which they do not over plain remote debugging: add one line to your Vite config and the component tree shows up.",
    value: "Vue and React devtools over the wire",
    metrics: ["DOM + styles", "Vue / React", "Live mirror"],
    accent: "#5ad39a",
    capture: "vueDevtools",
  },
  {
    key: "network",
    label: "Network & mock",
    title: "Watch it, throttle it, or fake it",
    body: "XHR, fetch and websocket traffic with headers, payload, timing and the response body inline. Throttle the connection to see what a field rep on 3G sees, or mock a response outright so a flow can be tested in isolation without touching the backend.",
    value: "Watch it, throttle it, or mock it",
    metrics: ["WS + XHR", "Throttle", "Mock panel"],
    accent: "#71cbff",
    capture: "network",
  },
  {
    key: "console",
    label: "Console & logs",
    title: "JS console, exceptions and logcat in one stream",
    body: "The WebView console, uncaught exceptions and the native Android log in a single timeline, filtered together. The native line that explains a JS error is finally on the same screen as the error, and Android Studio stays closed.",
    value: "Console, exceptions and logcat in one stream",
    metrics: ["Console", "Exceptions", "Native logcat"],
    accent: "#f0c36b",
    capture: "replay",
  },
  {
    key: "performance",
    label: "Performance",
    title: "Native and WebView on one clock",
    body: "CPU, the PSS breakdown, JS heap, DOM node count and thread count on a single timeline. A native regression and a WebView leak stop looking alike, because for the first time you are watching both at the same moment.",
    value: "Native and WebView on one clock",
    metrics: ["CPU + PSS", "JS heap", "DOM nodes"],
    accent: "#f0c36b",
    capture: "performance",
  },
  {
    key: "files",
    label: "Filesystem",
    title: "The paths recent Android hides",
    body: "Browse the device filesystem, including app-private and protected locations a file manager will not show you, and pull anything to the host to open locally. No helper APK, no second program on your machine.",
    value: "The paths recent Android hides",
    metrics: ["Protected paths", "Pull to host", "No helper app"],
    accent: "#e8765a",
    capture: "inspector",
  },
  {
    key: "mirror",
    label: "Mirror",
    title: "The phone on your desk, fully wired",
    body: "scrcpy mirroring with touch, swipe, scroll and keyboard injection, clipboard sync and a detachable window, so the screen keeps up while you drive the app and read the data next to it.",
    value: "scrcpy with input, clipboard and detach",
    metrics: ["scrcpy", "Input", "Detachable"],
    accent: "#e8765a",
    capture: "vueDevtools",
  },
];
