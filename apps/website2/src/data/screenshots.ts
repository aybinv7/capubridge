export type CaptureStatus = "clean" | "needs-recapture";

export interface Capture {
  key: string;
  src: string;
  alt: string;
  caption: string;
  status: CaptureStatus;
  /** Reason a capture cannot ship, shown in the placeholder frame during development. */
  blocker?: string;
  /** object-position for cropped frames. */
  focal?: string;
}

const path = (file: string) => `/screenshots/${encodeURIComponent(file)}`;

export const captures: Record<string, Capture> = {
  heroOverview: {
    key: "/hero-overview.png",
    src: "/hero-overview.png",
    alt: "Device overview with hardware panels, a live phone mirror and the console drawer open",
    caption:
      "Device, live mirror and console in one window - the whole session on a single screen.",
    status: "clean",
    focal: "50% 40%",
  },
  performance: {
    key: "performance",
    src: path("Screenshot 2026-04-28 203840.png"),
    alt: "Performance view with CPU timeline, native memory, JS heap and DOM node charts",
    caption: "CPU, native memory, JS heap, DOM nodes and thread count on one live timeline.",
    status: "clean",
    focal: "50% 20%",
  },
  recording: {
    key: "recording",
    src: path("Screenshot 2026-04-28 204330.png"),
    alt: "New recording dialog with DOM replay, network, console and performance tracks",
    caption: "Pick the tracks before you reproduce: DOM replay, network, console, performance.",
    status: "clean",
    focal: "50% 50%",
  },
  inspector: {
    key: "inspector",
    src: path("inspector-crop.png"),
    alt: "App inspector with package metadata, storage totals and runtime permissions",
    caption: "Package metadata, storage totals, permissions and the live device in one frame.",
    status: "clean",
    focal: "0% 15%",
  },
  devices: {
    key: "devices",
    src: path("Screenshot 2026-04-28 203728.png"),
    alt: "Device list with USB and Wi-Fi entries next to the discovered WebView targets",
    caption: "Every device ADB can see, and every debuggable target on the selected one.",
    status: "needs-recapture",
    blocker: "Private device IP addresses and device serial visible in the list itself",
    focal: "50% 40%",
  },
  overview: {
    key: "overview",
    src: path("Screenshot 2026-04-28 203716.png"),
    alt: "Device overview with display, CPU, storage, RAM and Android version",
    caption: "Display, CPU, storage, RAM and Android version before the investigation starts.",
    status: "needs-recapture",
    blocker: "Device serial and IP address printed inside the stat cards, not just the toolbar",
    focal: "50% 25%",
  },
  storage: {
    key: "storage",
    src: path("storage-crop.png"),
    alt: "IndexedDB explorer with database tree and a paginated record table",
    caption: "IndexedDB, Localforage, LocalStorage, Cache, OPFS and SQLite in one explorer.",
    status: "clean",
    focal: "0% 15%",
  },
  graph: {
    key: "graph",
    src: path("graph-crop.png"),
    alt: "Storage graph showing tables, inferred links and an attached note panel",
    caption: "Stores become a graph with inferred links and notes you can attach.",
    status: "clean",
    focal: "50% 30%",
  },
  elements: {
    key: "elements",
    src: path("elements-crop.png"),
    alt: "DOM inspector next to a live mirror of the phone screen",
    caption: "The DOM tree and the phone that produced it, side by side.",
    status: "clean",
    focal: "0% 10%",
  },
  network: {
    key: "network",
    src: path("network-crop.png"),
    alt: "Network request list with a selected request and its JSON response",
    caption: "Requests, websockets, throttling and mocks, with the response body inline.",
    status: "clean",
    focal: "0% 15%",
  },
  mirror: {
    key: "mirror",
    src: path("Screenshot 2026-04-28 203748.png"),
    alt: "Device overview beside a live scrcpy mirror of the phone screen",
    caption: "scrcpy mirroring with touch, keyboard and clipboard, docked next to the data.",
    status: "needs-recapture",
    blocker: "Device serial and IP address printed inside the stat cards, not just the toolbar",
    focal: "100% 40%",
  },
  vueDevtools: {
    key: "vueDevtools",
    src: path("vueDevtools-crop.png"),
    alt: "DOM inspector with computed styles and an element highlighted on the device",
    caption: "Hover the tree and the element highlights on the real phone, with its box model.",
    status: "clean",
    focal: "0% 20%",
  },
  replay: {
    key: "replay",
    src: path("replay-crop.png"),
    alt: "Recording replay with a scrubber and synchronised console, network and performance lanes",
    caption: "Replay a session frame by frame with console, network and performance in lanes.",
    status: "clean",
    focal: "0% 10%",
  },
};
